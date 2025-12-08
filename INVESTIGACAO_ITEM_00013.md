# Investigação: Inconsistência do Item 00013

## Dados Reportados pelo Usuário

| Aba | Valor | Status |
|-----|-------|--------|
| **Saídas** | 1.321 | ✅ OK |
| **Consolidado - Saídas** | 1.321 | ✅ OK (igual à aba Saídas) |
| **Consolidado - Estoque Final** | -541 | ⚠️ Negativo |
| **Ajustes - Saldo Negativo** | -1.282 | ❌ DIFERENTE do Consolidado (-541) |
| **Inventário Final** | 394 | ❌ POSITIVO (deveria ser negativo?) |
| **Ajustes Recebidos** | 0 | Nenhum ajuste foi feito |

## Problema Identificado

**O item aparece com valores DIFERENTES em cada aba**, indicando inconsistência nos cálculos.

---

## Hipóteses

### Hipótese 1: Cálculo Incorreto no Inventário Final

**Fórmula esperada:**
```
Estoque Final = Estoque Inicial + Entradas - Saídas + Ajustes Recebidos - Ajustes Fornecidos
```

**Dados conhecidos:**
- Saídas = 1.321
- Consolidado Estoque Final = -541
- Inventário Final = 394
- Ajustes = 0

**Cálculo reverso para encontrar Estoque Inicial + Entradas:**
```
Consolidado: Estoque Inicial + Entradas - 1.321 = -541
Estoque Inicial + Entradas = -541 + 1.321 = 780
```

**Verificação no Inventário Final (se estiver correto):**
```
Inventário Final = 780 + 0 - 0 = 780 ≠ 394 ❌
```

**Conclusão Hipótese 1:** O cálculo está ERRADO em algum lugar.

---

### Hipótese 2: Aba "Ajustes" Mostra Valor Incorreto

**Esperado na aba Ajustes (códigos negativos):**
- Deveria mostrar o estoque final do Consolidado = -541

**Atual na aba Ajustes:**
- Mostra -1.282

**Diferença:**
```
-1.282 - (-541) = -741
```

**Possíveis causas:**
1. Aba Ajustes está usando **dados de cache antigos**
2. Aba Ajustes está calculando com **fórmula diferente**
3. Aba Ajustes está usando **período/filtro diferente**

---

### Hipótese 3: Inventário Final Positivo Está Errado

**Se Consolidado = -541**, o Inventário Final deveria ser:
```
Inventário Final = -541 + 0 - 0 = -541
```

**Mas mostra 394** (positivo!)

**Diferença:**
```
394 - (-541) = 935
```

**Possíveis causas:**
1. Bug na função `getInventoryFinalData()` (lib/inventoryFinal.ts)
2. Ajustes sendo aplicados incorretamente
3. Estoque inicial ou entradas sendo duplicadas
4. Cache retornando dados antigos

---

## Verificações Necessárias

### 1. Verificar Dados Brutos no Banco

```sql
-- Estoque Inicial (tabela stock_items)
SELECT
  cod_item,
  qtd as estoque_inicial,
  valor as valor_inicial
FROM stock_items
WHERE sped_file_id = 'SEU_SPED_FILE_ID'
  AND cod_item = '000013';
```

### 2. Verificar Entradas

```sql
-- Entradas agregadas
SELECT
  ei.cod_item,
  SUM(ei.qtd_produto) as total_entradas,
  SUM(ei.custo_total) as valor_entradas
FROM document_items ei
WHERE ei.cod_item = '000013'
  AND ei.sped_file_id = 'SEU_SPED_FILE_ID'
  AND ei.movement_type = 'entrada'
GROUP BY ei.cod_item;
```

### 3. Verificar Saídas

```sql
-- Saídas agregadas (deve dar 1.321)
SELECT
  di.cod_item,
  SUM(COALESCE(di.movement_qty, di.qtd, 0)) as total_saidas,
  SUM(di.vl_item) as valor_saidas
FROM document_items di
JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE di.cod_item = '000013'
  AND di.movement_type = 'saida'
  AND xsi.sped_file_id = 'SEU_SPED_FILE_ID'
GROUP BY di.cod_item;
```

### 4. Verificar Ajustes

```sql
-- Ajustes do item (deveria ser 0)
SELECT
  cod_negativo,
  cod_positivo,
  qtd_baixada
FROM code_offset_adjustments
WHERE (cod_negativo = '000013' OR cod_positivo = '000013')
  AND sped_file_id = 'SEU_SPED_FILE_ID';
```

### 5. Verificar Consolidado

```sql
-- Verificar se há duplicação de dados
SELECT
  'stock' as fonte,
  cod_item,
  qtd,
  valor
FROM stock_items
WHERE cod_item = '000013'
  AND sped_file_id = 'SEU_SPED_FILE_ID'

UNION ALL

SELECT
  'entradas' as fonte,
  cod_item,
  SUM(qtd_produto) as qtd,
  SUM(custo_total) as valor
FROM document_items
WHERE cod_item = '000013'
  AND sped_file_id = 'SEU_SPED_FILE_ID'
  AND movement_type = 'entrada'
GROUP BY cod_item

UNION ALL

SELECT
  'saidas' as fonte,
  di.cod_item,
  SUM(COALESCE(di.movement_qty, di.qtd, 0)) as qtd,
  SUM(di.vl_item) as valor
FROM document_items di
JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE di.cod_item = '000013'
  AND di.movement_type = 'saida'
  AND xsi.sped_file_id = 'SEU_SPED_FILE_ID'
GROUP BY di.cod_item;
```

---

## ✅ CAUSA RAIZ ENCONTRADA

### Problema: Aba Ajustes Usa API Diferente!

**Arquivo**: `app/api/adjustments/inventory-data/route.ts`

**O QUE ESTÁ ACONTECENDO:**

A aba **Ajustes** NÃO usa o Consolidado! Ela tem sua **própria lógica de cálculo** que:

1. Busca estoque inicial de `stock_initial` (filtrado por `import_id` do período)
2. Busca entradas de `document_items` (filtrado por `sped_file_id`)
3. Busca saídas de `document_items` via `xml_import_id` (XMLs base do período)
4. Calcula **manualmente**: `estoque_teorico = inicial + entradas - saídas`
5. Aplica ajustes: `estoque_final = teorico + recebidos - fornecidos`

**DIFERENÇAS EM RELAÇÃO AO CONSOLIDADO:**

| Aspecto | Consolidado (`lib/consolidado.ts`) | Ajustes (`/api/adjustments/inventory-data`) |
|---------|-----------------------------------|---------------------------------------------|
| **Estoque Inicial** | `stock_items` table | `stock_initial` table (por `import_id`) |
| **Entradas** | `buildEntradasItems()` (complexo) | `document_items` direto (simples) |
| **Saídas** | `fetchExitAggregates()` | `document_items` + `xml_import_id` |
| **Filtro Período** | `period_id` em ajustes | `import_id` + `xml_import_id` base |
| **Custo** | Custo médio ponderado complexo | Custo médio simples |

**POR QUE OS VALORES SÃO DIFERENTES:**

1. **Tabelas diferentes**: `stock_items` vs `stock_initial`
2. **Lógica de entradas diferente**: `buildEntradasItems()` é muito mais complexo
3. **Agregação diferente**: Consolidado usa paginação e batch
4. **Filtros diferentes**: Consolidado pode estar usando XMLs diferentes

### Bug Confirmado: Duplicação de Lógica

**CRÍTICO**: Há **DUAS implementações diferentes** de cálculo de inventário:

1. ✅ **Consolidado** (`lib/consolidado.ts`) - USADO por Inventário Final
2. ❌ **Ajustes** (`/api/adjustments/inventory-data/route.ts`) - CÁLCULO PRÓPRIO

**Isso GARANTE inconsistências!**

### Bug 2: Inventário Final Aplicando Ajustes Duas Vezes

**Arquivo**: `lib/inventoryFinal.ts` (linha 76)

```typescript
const estoqueFinal = estoqueTeorico + recebidos - baixas;
```

**Possível problema**: Se `estoqueTeorico` já incluir ajustes E ainda somar/subtrair ajustes, haverá duplicação.

### Bug 3: Normalização de Código Inconsistente

**Possível problema**: Em algum lugar o código está como "13" e em outro como "00013" ou "000013".

**Verificação**:
```sql
-- Ver todas as variações do código 13
SELECT DISTINCT cod_item
FROM (
  SELECT cod_item FROM stock_items WHERE cod_item LIKE '%13%'
  UNION
  SELECT cod_item FROM document_items WHERE cod_item LIKE '%13%'
  UNION
  SELECT cod_negativo as cod_item FROM code_offset_adjustments WHERE cod_negativo LIKE '%13%'
  UNION
  SELECT cod_positivo as cod_item FROM code_offset_adjustments WHERE cod_positivo LIKE '%13%'
) as all_codes
WHERE LENGTH(cod_item) <= 6
ORDER BY cod_item;
```

---

## Próximos Passos

1. ✅ **Execute as queries SQL** acima para verificar os dados brutos
2. ⏳ Verificar se há **cache** interferindo
3. ⏳ Comparar cálculo do **Consolidado** vs **Inventário Final**
4. ⏳ Verificar se aba **Ajustes** está usando API correta
5. ⏳ Verificar **normalização de códigos** em todas as tabelas

---

## Resultado Esperado

Após correção, **TODAS as abas** devem mostrar:

- **Consolidado Estoque Final** = X
- **Ajustes - Saldo Negativo** = X (mesmo valor)
- **Inventário Final** = X + ajustes recebidos - ajustes fornecidos

**Se não houver ajustes**, os três valores devem ser **IDÊNTICOS**.

---

## Urgência

🔴 **CRÍTICO**: Inconsistência entre abas indica **bug grave** que pode:
- Gerar inventários incorretos
- Causar ajustes errados
- Quebrar relatórios fiscais
- Perder confiança nos dados do sistema

**Precisa ser investigado e corrigido IMEDIATAMENTE.**

---

## 🔧 SOLUÇÃO RECOMENDADA

### Opção 1: Aba Ajustes Usar o Consolidado (RECOMENDADO)

**Modificar**: `/api/adjustments/inventory-data/route.ts`

**Substituir toda a lógica manual por**:

```typescript
import { buildConsolidado } from "@/lib/consolidado";

export async function GET(req: NextRequest) {
  // ... código de validação ...

  // ✅ USAR O CONSOLIDADO (mesma fonte que Inventário Final)
  const consolidado = await buildConsolidado(
    periodId ?? null,
    spedFileId,
    { xmlImportIds: null }
  );

  // Separar em negativos e positivos
  const negativos = consolidado.rows
    .filter(row => row.qtd_final < 0)
    .map(row => ({
      cod_item: row.cod_item,
      descr_item: row.descr_item,
      unidade: row.unidade,
      estoque_inicial: row.qtd_inicial,
      entradas: row.entradas,
      saidas: row.saidas,
      estoque_teorico: row.qtd_final,
      unit_cost: row.custo_medio ?? 0,
      valor_estoque: row.valor_total,
      ajustes_recebidos: consolidado.ajustes.recebidos[row.cod_item] ?? 0,
      ajustes_fornecidos: consolidado.ajustes.baixasPositivas[row.cod_item] ?? 0,
      estoque_final: row.qtd_final +
        (consolidado.ajustes.recebidos[row.cod_item] ?? 0) -
        (consolidado.ajustes.baixasPositivas[row.cod_item] ?? 0),
    }))
    .sort((a, b) => a.estoque_final - b.estoque_final);

  const positivos = consolidado.rows
    .filter(row => row.qtd_final > 0)
    .map(row => ({
      // ... mesmo mapeamento ...
    }))
    .sort((a, b) => b.estoque_final - a.estoque_final);

  return NextResponse.json({
    ok: true,
    negativos,
    positivos,
    // ...
  });
}
```

**VANTAGENS:**
- ✅ Garante consistência entre TODAS as abas
- ✅ Elimina duplicação de código
- ✅ Usa custo médio ponderado correto
- ✅ Aplica ajustes corretamente
- ✅ Menos bugs futuros

**DESVANTAGENS:**
- ⚠️ Pode ser mais lento (mas mais correto)

---

### Opção 2: Documentar as Diferenças e Aceitar

**Se a lógica da aba Ajustes precisa ser diferente por algum motivo de negócio:**

1. Documentar POR QUE são diferentes
2. Adicionar warning na interface:
   ```
   ⚠️ Os valores podem diferir do Consolidado pois usam filtros diferentes
   ```
3. Adicionar log explicando a diferença

**DESVANTAGENS:**
- ❌ Confusão para usuários
- ❌ Difícil manutenção
- ❌ Mais bugs futuros

---

## 📊 TESTE PARA VERIFICAR CORREÇÃO

Após implementar a solução, executar este teste:

```sql
-- 1. Ver item 00013 no consolidado
SELECT * FROM inventory_data
WHERE cod_item = '000013'
  AND sped_file_id = 'SEU_SPED_FILE_ID';

-- 2. Acessar aba Ajustes e verificar saldo
-- 3. Acessar aba Consolidado e verificar estoque final
-- 4. Acessar aba Inventário Final e verificar estoque

-- TODOS devem mostrar o MESMO valor de estoque final
```

**Valores esperados (após correção):**
- ✅ Consolidado Estoque Final = X
- ✅ Ajustes Saldo = X
- ✅ Inventário Final = X (+ ajustes se houver)

---

## ⚡ IMPLEMENTAÇÃO IMEDIATA

**Arquivo a modificar**: `/Users/marinalanza/Desktop/ESTOQUE 2/app/api/adjustments/inventory-data/route.ts`

**Ações**:
1. ✅ Importar `buildConsolidado`
2. ✅ Substituir toda lógica manual (linhas 364-673)
3. ✅ Mapear `consolidado.rows` para formato esperado
4. ✅ Testar com item 00013
5. ✅ Verificar se valores batem

**Tempo estimado**: 30-60 minutos
**Complexidade**: Média
**Impacto**: Alto (resolve inconsistências críticas)
