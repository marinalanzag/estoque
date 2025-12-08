# Como as Saídas são Calculadas em Cada Aba

## Resumo Executivo

As **saídas** (vendas) são obtidas da tabela `document_items` filtrando por `movement_type = 'saida'` e agregando por código de item normalizado.

## Fluxo de Dados

```
XML de Vendas Importado
         ↓
   document_items (movement_type='saida')
         ↓
   Agregação por cod_item (normalizado)
         ↓
   Usado em: Saídas, Consolidado, Inventário Final
```

---

## 1. Aba SAÍDAS (`/movimentacoes/saidas`)

### Arquivo: `app/movimentacoes/saidas/page.tsx`

### Como Funciona:

1. **Fonte de Dados**: Tabela `document_items`
2. **Filtro Principal**: `movement_type = 'saida'`
3. **Filtro Adicional**: Por `xml_import_id` (importações de XML de vendas)

### Query SQL Equivalente:

```sql
SELECT
  cod_item,
  movement_qty,
  qtd,
  vl_item,
  descr_compl,
  unid
FROM document_items
WHERE movement_type = 'saida'
  AND xml_import_id IN (lista_de_importacoes)
```

### Agregação:

- **Quantidade**: `movement_qty` (se disponível) OU `qtd` (valor absoluto)
- **Valor**: `vl_item`
- Normaliza `cod_item` (padding com zeros à esquerda para 6 dígitos)
- Agrupa por código normalizado

### Exibição:

Mostra lista detalhada de **todos os itens** vendidos com:
- Código
- Descrição
- Quantidade total vendida
- Valor total
- Unidade

---

## 2. Aba CONSOLIDADO (`/movimentacoes/consolidado`)

### Arquivo: `lib/consolidado.ts` → função `fetchExitAggregates()`

### Como Funciona:

1. **Busca XMLs de Vendas**:
   - Tabela: `xml_sales_imports`
   - Filtro: `sped_file_id` (período ativo)
   - Resultado: Lista de `xml_import_id`

2. **Busca Itens de Saída**:
   - Tabela: `document_items`
   - Filtro: `xml_import_id IN (lista)` E `movement_type = 'saida'`
   - Paginação: 1000 itens por página
   - Lotes: 50 importações por vez

### Query (linhas 396-401):

```typescript
.from("document_items")
.select("cod_item, movement_qty, movement_type, qtd, vl_item, descr_compl, unid")
.in("xml_import_id", batchIds)
.eq("movement_type", "saida")
```

### Agregação (linhas 424-437):

```typescript
const qty = item.movement_qty !== null
  ? Math.abs(Number(item.movement_qty))
  : Math.abs(item.qtd ?? 0);
const valor = Number(item.vl_item ?? 0);

// Agrega por código normalizado
aggregate.set(codItemNormalizado, {
  qty: current.qty + qty,
  valor: current.valor + valor,
  descr: item.descr_compl,
  unid: item.unid
});
```

### Uso no Consolidado (linha 741-762):

```typescript
const saidas = saidaAggregates.get(cod);
const qtdSaidas = saidas?.qty ?? 0;
const valorSaidas = saidas?.valor ?? 0;
const qtdFinal = qtdInicial + qtdEntradas - qtdSaidas;
```

### Fórmula Final:

```
Estoque Final = Estoque Inicial + Entradas - Saídas
```

---

## 3. Aba INVENTÁRIO FINAL (`/inventario-final`)

### Arquivo: `lib/inventoryFinal.ts`

### Como Funciona:

**IMPORTANTE**: O Inventário Final **NÃO busca as saídas diretamente**. Ele usa o **Consolidado** como fonte.

### Fluxo (linhas 39-41):

```typescript
const consolidado = await buildConsolidado(periodId ?? null, spedFileId, {
  xmlImportIds: options?.xmlImportIds ?? null,
});
```

### Mapeamento (linhas 72-108):

```typescript
const items: InventoryFinalItem[] = consolidado.rows.map((row) => {
  const recebidos = consolidado.ajustes.recebidos[row.cod_item] ?? 0;
  const baixas = consolidado.ajustes.baixasPositivas[row.cod_item] ?? 0;
  const estoqueTeorico = row.qtd_final; // Já considera saídas!
  const estoqueFinal = estoqueTeorico + recebidos - baixas;

  return {
    cod_item: row.cod_item,
    descr_item: row.descr_item,
    estoque_inicial: row.qtd_inicial,
    entradas: row.entradas,
    saidas: row.saidas, // ← VEM DO CONSOLIDADO
    estoque_teorico: estoqueTeorico,
    ajustes_recebidos: recebidos,
    ajustes_fornecidos: baixas,
    estoque_final: estoqueFinal,
  };
});
```

### Fonte das Saídas no Inventário Final:

```
Inventário Final
    ↓ chama
buildConsolidado()
    ↓ chama
fetchExitAggregates()
    ↓ busca
document_items (movement_type='saida')
```

---

## Comparação Entre as Abas

| Aspecto | Saídas | Consolidado | Inventário Final |
|---------|--------|-------------|------------------|
| **Fonte Direta** | `document_items` | `document_items` via `fetchExitAggregates()` | `buildConsolidado()` |
| **Filtro** | `movement_type='saida'` + `xml_import_id` | `movement_type='saida'` + `xml_import_id` | Herdado do Consolidado |
| **Agregação** | Por `cod_item` | Por `cod_item` | Usa agregação do Consolidado |
| **Campo Qty** | `movement_qty` OU `qtd` | `movement_qty` OU `qtd` | `row.saidas` (do Consolidado) |
| **Campo Valor** | `vl_item` | `vl_item` | `valorSaidas` (do Consolidado) |
| **Normalização** | `normalizeCodItem()` | `normalizeCodItem()` | Já normalizado |
| **Ajustes** | ❌ Não considera | ❌ Não considera | ✅ Considera ajustes |

---

## Pontos Importantes

### 1. **Fonte Única de Verdade**

As saídas vêm **SEMPRE** de `document_items` com `movement_type = 'saida'`:
- Inseridos via importação de XML de vendas
- Tabela: `xml_sales_imports` → `document_items`
- API: `/api/sped/import-xml-sales/route.ts`

### 2. **Normalização de Código**

Todos os códigos são normalizados usando `normalizeCodItem()`:
```typescript
// Exemplo: "842" → "000842"
// Garante agregação correta
```

### 3. **Prioridade de Quantidade**

```typescript
const qty = item.movement_qty !== null
  ? Math.abs(Number(item.movement_qty))
  : Math.abs(item.qtd ?? 0);
```

- **Preferência**: `movement_qty` (quantidade de movimentação)
- **Fallback**: `qtd` (quantidade da NF)
- **Sempre positivo**: `Math.abs()`

### 4. **Períodos**

- **Com período ativo**: Usa `xml_import_id` vinculados ao período
- **Sem período**: Usa todos os XMLs do `sped_file_id`

### 5. **Paginação**

- **PAGE_SIZE**: 1000 itens por página
- **BATCH_SIZE**: 50 importações por lote
- Evita timeouts em grandes volumes

---

## Diagrama de Fluxo Completo

```
┌─────────────────────────────────────┐
│ XML de Vendas (NF-e de Saída)     │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ Importação via API                 │
│ /api/sped/import-xml-sales         │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ Tabela: xml_sales_imports          │
│ - id (xml_import_id)               │
│ - sped_file_id                     │
│ - period_id                        │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ Tabela: document_items             │
│ - cod_item                         │
│ - movement_type = 'saida'          │
│ - movement_qty / qtd               │
│ - vl_item                          │
│ - xml_import_id (FK)               │
└────────────────┬────────────────────┘
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
┌──────────────┐   ┌──────────────┐
│ Aba SAÍDAS   │   │ Consolidado  │
│ - Lista      │   │ fetchExit    │
│   detalhada  │   │ Aggregates() │
└──────────────┘   └──────┬───────┘
                          ↓
                  ┌──────────────┐
                  │ Inventário   │
                  │ Final        │
                  │ (usa rows    │
                  │  do          │
                  │  Consolidado)│
                  └──────────────┘
```

---

## Verificação de Dados

### Para Verificar Saídas no Banco:

```sql
-- Ver todas as saídas de um código específico
SELECT
  di.cod_item,
  di.movement_qty,
  di.qtd,
  di.vl_item,
  di.descr_compl,
  xsi.sped_file_id,
  xsi.file_name
FROM document_items di
JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE di.movement_type = 'saida'
  AND di.cod_item = '011141'
ORDER BY di.created_at DESC;
```

### Para Verificar Agregação:

```sql
-- Ver total de saídas agregadas por código
SELECT
  di.cod_item,
  SUM(COALESCE(di.movement_qty, di.qtd, 0)) as total_qty,
  SUM(di.vl_item) as total_valor,
  COUNT(*) as num_notas
FROM document_items di
JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE di.movement_type = 'saida'
  AND xsi.sped_file_id = 'seu-sped-file-id'
GROUP BY di.cod_item
ORDER BY total_qty DESC;
```

---

## Conclusão

As **saídas são consistentes** entre todas as abas porque:

1. ✅ Mesma fonte de dados (`document_items`)
2. ✅ Mesmo filtro (`movement_type = 'saida'`)
3. ✅ Mesma normalização de código
4. ✅ Mesma lógica de agregação
5. ✅ Inventário Final usa Consolidado (não busca direto)

**Qualquer divergência** seria causada por:
- ❌ Filtros diferentes de período/importação
- ❌ Cache desatualizado
- ❌ Dados corrompidos na tabela
