# Debug: Por Que Inventário Final do Item 00013 Está Errado?

## Dados do Problema

| Aba | Valor Esperado | Valor Real | Status |
|-----|----------------|------------|--------|
| **Consolidado** | -541 | -541 | ✅ CORRETO |
| **Inventário Final** | -541 | **+394** | ❌ ERRADO (+935 de diferença!) |

## Diferença Crítica

```
394 - (-541) = +935
```

**O Inventário Final está mostrando 935 unidades A MAIS do que deveria!**

---

## Investigação Passo a Passo

### 1. Como o Inventário Final É Calculado

**Arquivo**: `lib/inventoryFinal.ts` (linhas 72-108)

```typescript
const items: InventoryFinalItem[] = consolidado.rows.map((row) => {
  const recebidos = consolidado.ajustes.recebidos[row.cod_item] ?? 0;
  const baixas = consolidado.ajustes.baixasPositivas[row.cod_item] ?? 0;
  const estoqueTeorico = row.qtd_final; // ← VEM DO CONSOLIDADO
  const estoqueFinal = estoqueTeorico + recebidos - baixas;

  return {
    cod_item: row.cod_item,
    estoque_inicial: row.qtd_inicial,
    entradas: row.entradas,
    saidas: row.saidas,
    estoque_teorico: estoqueTeorico,
    ajustes_recebidos: recebidos,
    ajustes_fornecidos: baixas,
    estoque_final: estoqueFinal, // ← AQUI ESTÁ O PROBLEMA?
  };
});
```

### 2. Fórmula do Inventário Final

```
estoque_final = estoque_teorico + ajustes_recebidos - ajustes_fornecidos
```

**Para o item 00013:**
```
394 = estoque_teorico + recebidos - baixas
394 = -541 + recebidos - baixas
```

**Resolvendo:**
```
recebidos - baixas = 394 - (-541) = 935
```

**Isso significa que:**
- O item 00013 recebeu **935 unidades** de ajustes
- OU forneceu **-935 unidades** (o que não faz sentido)
- OU há um **bug no cálculo**

---

## Hipóteses

### Hipótese 1: Ajustes Incorretos Sendo Aplicados

**Verificação**: O item 00013 tem ajustes registrados?

**Você disse**: "esse item não recebeu nenhum saldo" (ajustes = 0)

**Se ajustes = 0**, então:
```
estoque_final = -541 + 0 - 0 = -541
```

**MAS está mostrando 394!**

**Conclusão**: Há ajustes sendo aplicados INCORRETAMENTE ou há outro bug.

---

### Hipótese 2: Consolidado.rows Retornando Valor Errado

**Possível problema**: `row.qtd_final` do Consolidado pode estar errado para o item 00013.

**Verificação necessária**:

```typescript
// Em lib/inventoryFinal.ts, adicionar log:
console.log("[DEBUG 00013] Row do consolidado:", {
  cod_item: row.cod_item,
  qtd_inicial: row.qtd_inicial,
  entradas: row.entradas,
  saidas: row.saidas,
  qtd_final: row.qtd_final,
  custo_medio: row.custo_medio,
});

// Verificar ajustes:
console.log("[DEBUG 00013] Ajustes:", {
  recebidos: consolidado.ajustes.recebidos['000013'],
  baixas: consolidado.ajustes.baixasPositivas['000013'],
});
```

---

### Hipótese 3: Normalização de Código Diferente

**Possível problema**: O código está como "13" em um lugar e "00013" em outro.

**Verificação**:
- Consolidado usa: `000013` (normalizado)
- Ajustes usa: `00013` ou `13`?

**Resultado**: Ajustes de outro código sendo aplicados ao 00013.

**Exemplo**:
```typescript
// Se houver ajuste para código "13" (não normalizado)
consolidado.ajustes.recebidos['13'] = 935

// Mas o item é "000013"
consolidado.ajustes.recebidos['000013'] = undefined

// OU ao contrário:
consolidado.ajustes.recebidos['000013'] = 935
// Mas o map busca por '00013' (sem zeros à esquerda)
```

---

### Hipótese 4: Código Duplicado no Consolidado

**Possível problema**: Há 2 rows no `consolidado.rows` para o item 00013:
- Uma com código `013`
- Outra com código `00013`

**Resultado**: Somas duplicadas ou valores errados.

**Verificação**:
```typescript
// Buscar duplicatas
const item13 = consolidado.rows.filter(r =>
  r.cod_item === '13' ||
  r.cod_item === '013' ||
  r.cod_item === '0013' ||
  r.cod_item === '00013' ||
  r.cod_item === '000013'
);
console.log("Items encontrados:", item13.length);
```

---

### Hipótese 5: Bug na Soma de Saídas

**Possível problema**: As saídas do item 00013 estão sendo calculadas incorretamente no Consolidado.

**Verificação no Consolidado** (`lib/consolidado.ts` linha 762):

```typescript
const qtdFinal = qtdInicial + qtdEntradas - qtdSaidas;
```

**Para o item 00013:**
```
-541 = qtdInicial + qtdEntradas - 1321
```

**Resolvendo**:
```
qtdInicial + qtdEntradas = -541 + 1321 = 780
```

**Então**:
- Estoque Inicial + Entradas = 780
- Saídas = 1.321
- Estoque Final = 780 - 1.321 = **-541** ✅ (Consolidado correto)

**Mas Inventário Final mostra 394!**

**Possível explicação**:
```
394 = 780 - X
X = 780 - 394 = 386
```

**O Inventário Final está usando apenas 386 de saídas em vez de 1.321!**

**Diferença**: 1.321 - 386 = **935** (mesma diferença entre -541 e 394!)

---

## 🎯 CAUSA RAIZ MAIS PROVÁVEL

### Bug: Saídas Duplicadas ou Filtradas Incorretamente

**Cenário 1**: Consolidado usa TODOS os XMLs (1.321 saídas)
**Cenário 2**: Inventário Final usa MENOS XMLs (386 saídas)

**Resultado**: Diferença de 935 unidades!

**Verificação necessária**:

```typescript
// Em lib/inventoryFinal.ts linha 39
const consolidado = await buildConsolidado(periodId ?? null, spedFileId, {
  xmlImportIds: options?.xmlImportIds ?? null, // ← AQUI!
});
```

**Se `options.xmlImportIds` filtrar alguns XMLs**, o Consolidado usado pelo Inventário Final terá **menos saídas**!

---

## Código para Debugar

### Adicionar em `lib/inventoryFinal.ts` após linha 41:

```typescript
// DEBUG: Verificar item 00013
const row13 = consolidado.rows.find(r => r.cod_item === '000013');
if (row13) {
  console.log("[INV-FINAL DEBUG 00013] Row do consolidado:", {
    cod_item: row13.cod_item,
    qtd_inicial: row13.qtd_inicial,
    entradas: row13.entradas,
    saidas: row13.saidas,
    qtd_final: row13.qtd_final,
  });

  console.log("[INV-FINAL DEBUG 00013] Ajustes:", {
    recebidos: consolidado.ajustes.recebidos['000013'] ?? 0,
    baixas: consolidado.ajustes.baixasPositivas['000013'] ?? 0,
  });

  console.log("[INV-FINAL DEBUG 00013] XMLs usados:", {
    xmlImportIds: options?.xmlImportIds,
    total_xmls: options?.xmlImportIds?.length || 'null (todos)',
  });
}
```

### Adicionar em `lib/inventoryFinal.ts` após linha 108:

```typescript
// DEBUG: Verificar item 00013 no resultado final
const item13final = items.find(i => i.cod_item === '000013');
if (item13final) {
  console.log("[INV-FINAL DEBUG 00013] Item final mapeado:", {
    cod_item: item13final.cod_item,
    estoque_inicial: item13final.estoque_inicial,
    entradas: item13final.entradas,
    saidas: item13final.saidas,
    estoque_teorico: item13final.estoque_teorico,
    ajustes_recebidos: item13final.ajustes_recebidos,
    ajustes_fornecidos: item13final.ajustes_fornecidos,
    estoque_final: item13final.estoque_final,
    formula: `${item13final.estoque_teorico} + ${item13final.ajustes_recebidos} - ${item13final.ajustes_fornecidos} = ${item13final.estoque_final}`,
  });
}
```

---

## Teste SQL para Verificar

```sql
-- Ver todas as saídas do item 00013
SELECT
  di.cod_item,
  di.movement_qty,
  di.qtd,
  di.vl_item,
  xsi.label as xml_nome,
  xsi.is_base,
  xsi.period_id
FROM document_items di
JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE di.movement_type = 'saida'
  AND (di.cod_item = '13' OR di.cod_item = '013' OR di.cod_item = '0013' OR di.cod_item = '00013' OR di.cod_item = '000013')
ORDER BY di.created_at DESC;
```

**Verificar**:
1. Quantos XMLs diferentes aparecem?
2. Todos são `is_base = true`?
3. Soma das saídas dá 1.321?
4. Há XMLs que NÃO são base?

---

## Próximos Passos

1. ✅ **Adicionar logs de debug** em `lib/inventoryFinal.ts`
2. ✅ **Executar query SQL** acima para ver XMLs
3. ✅ **Verificar se `options.xmlImportIds`** está filtrando XMLs
4. ✅ **Comparar XMLs** usados no Consolidado vs Inventário Final
5. ✅ **Verificar normalização** de código (13 vs 00013)

---

## Conclusão Preliminar

**O Inventário Final está usando MENOS saídas (386) do que o Consolidado (1.321).**

**Diferença**: 1.321 - 386 = 935 unidades

**Isso explica perfeitamente**:
- Consolidado: 780 - 1.321 = -541 ✅
- Inventário Final: 780 - 386 = 394 ❌

**Causa mais provável**: `options.xmlImportIds` está filtrando alguns XMLs no Inventário Final.

**Solução**: Garantir que Inventário Final use os MESMOS XMLs que o Consolidado.
