# Debug: Item 00013 - Diferenças Entre Abas Após Correção

## 📊 Dados Reportados Após Implementação

| Aba | Saídas | Estoque Final | Status |
|-----|--------|---------------|--------|
| **Consolidado** | 385 | 395 | ✅ Mostrando |
| **Ajustes** | ? | 780 | ❌ Diferente |
| **Inventário Final** | ? | 394 | ❌ Diferente |

## 🔍 Análise das Diferenças

### Diferença 1: Consolidado vs Screenshot
- **Screenshot mostra**: 385 saídas, 395 estoque final
- **Esperado**: 385 saídas = XMLs base apenas
- **Antes tinha**: 1.321 saídas (todos os XMLs)
- **Conclusão**: ✅ Consolidado AGORA está usando XMLs base corretamente!

### Diferença 2: Ajustes = 780
- **Valor**: 780 unidades
- **Análise**: 780 = estoque inicial + entradas
- **Problema**: Está mostrando apenas entradas, sem subtrair saídas!
- **Causa possível**:
  - Aba Ajustes está mostrando `row.entradas` em vez de `row.qtd_final`?
  - Ou está filtrando errado (mostrando apenas positivos)?

### Diferença 3: Inventário Final = 394
- **Valor**: 394 unidades
- **Análise**: 394 vs 395 do Consolidado = 1 unidade de diferença
- **Causa possível**: Arredondamento ou ajuste manual aplicado?

## 🎯 Investigação Necessária

### 1. Verificar o que buildConsolidado() está retornando para item 00013

Adicionar log temporário em `lib/consolidado.ts` após linha 762:

```typescript
// Log temporário para debug
const item00013 = finalGroupedMap.get("000013");
if (item00013) {
  console.log("[CONSOLIDADO DEBUG 00013]", {
    qtd_inicial: item00013.qtd_inicial,
    entradas: item00013.entradas,
    saidas: item00013.saidas,
    qtd_final: item00013.qtd_final,
    formula: `${item00013.qtd_inicial} + ${item00013.entradas} - ${item00013.saidas} = ${item00013.qtd_final}`,
  });
}
```

### 2. Verificar o que a aba Ajustes está recebendo

Log já existe em `app/api/adjustments/inventory-data/route.ts` linha 100-109.

Verificar no console do servidor:
```
[inventory-data] 🎯 Item 00013 - Valores do Consolidado:
{
  estoque_inicial: ???,
  entradas: ???,
  saidas: ???,
  estoque_teorico: ???,
  ajustes_recebidos: ???,
  ajustes_fornecidos: ???,
  estoque_final: ???
}
```

### 3. Verificar SQL direto

```sql
-- Estoque inicial do item 00013
SELECT
  si.cod_item,
  si.qtd as estoque_inicial,
  si.import_id,
  p.label as periodo
FROM stock_initial si
LEFT JOIN periods p ON si.import_id = p.stock_import_id
WHERE si.cod_item LIKE '%13%'
  AND LENGTH(si.cod_item) <= 6
ORDER BY si.cod_item;

-- Entradas do item 00013
SELECT
  di.cod_item,
  SUM(COALESCE(dia.adjusted_qty, ABS(di.movement_qty), di.qtd)) as total_entradas,
  COUNT(*) as num_registros
FROM document_items di
LEFT JOIN document_item_adjustments dia ON di.id = dia.document_item_id
JOIN documents d ON di.document_id = d.id
WHERE di.cod_item LIKE '%13%'
  AND LENGTH(di.cod_item) <= 6
  AND di.movement_type = 'entrada'
GROUP BY di.cod_item;

-- Saídas do item 00013 (apenas XMLs base)
SELECT
  di.cod_item,
  xsi.is_base,
  xsi.label as xml_nome,
  COUNT(*) as num_registros,
  SUM(ABS(COALESCE(di.movement_qty, di.qtd))) as total_saidas
FROM document_items di
JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE di.cod_item LIKE '%13%'
  AND LENGTH(di.cod_item) <= 6
  AND di.movement_type = 'saida'
GROUP BY di.cod_item, xsi.is_base, xsi.label
ORDER BY xsi.is_base DESC, di.cod_item;

-- Total de saídas apenas de XMLs base
SELECT
  di.cod_item,
  SUM(ABS(COALESCE(di.movement_qty, di.qtd))) as total_saidas_base,
  COUNT(*) as num_registros
FROM document_items di
JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE di.cod_item LIKE '%13%'
  AND LENGTH(di.cod_item) <= 6
  AND di.movement_type = 'saida'
  AND xsi.is_base = true
GROUP BY di.cod_item;
```

## 🤔 Hipóteses

### Hipótese 1: Aba Ajustes está mostrando campo errado
**Se valor = 780 (entradas)**:
- Frontend está exibindo `item.entradas` em vez de `item.estoque_final`
- Verificar: `components/adjustments/AdjustmentsTable.tsx` ou similar

### Hipótese 2: buildConsolidado() retornando valores diferentes
**Se Ajustes recebe valores diferentes do Consolidado**:
- Problema na passagem de parâmetros
- Verificar se `periodId` e `xmlImportIds: null` estão corretos

### Hipótese 3: Filtro de "negativos" excluindo o item
**Se item 00013 tem 395 positivo mas Ajustes mostra 780**:
- Item pode estar aparecendo na lista errada
- Verificar lógica de filtro: `items.filter((item) => item.estoque_final < 0)`

### Hipótese 4: Ajustes manuais sendo aplicados duas vezes
**Se diferença de 1 unidade (394 vs 395)**:
- Inventário Final pode estar aplicando ajustes que já estão no consolidado
- Verificar se `consolidado.ajustes` já está incluído em `row.qtd_final`

## 📝 Próximos Passos

1. ✅ Acessar o sistema e verificar console do navegador (F12)
2. ✅ Acessar terminal do servidor e ver logs
3. ✅ Executar queries SQL acima para confirmar dados brutos
4. ✅ Comparar logs entre:
   - `[CONSOLIDADO DEBUG 00013]`
   - `[inventory-data] 🎯 Item 00013`
   - `[inventory-final/data]` logs
5. ✅ Identificar onde os valores divergem
6. ✅ Corrigir o problema específico

## ⚠️ Observação Importante

A correção implementada DEVE fazer com que:
```
Consolidado.qtd_final = Ajustes.estoque_final = InventarioFinal.estoque_teorico
```

Se isso não está acontecendo, há um dos seguintes problemas:
1. buildConsolidado() está retornando valores diferentes em cada chamada (cache?)
2. Parâmetros sendo passados de forma diferente
3. Frontend mostrando campos errados
4. Ajustes sendo aplicados em momentos diferentes
