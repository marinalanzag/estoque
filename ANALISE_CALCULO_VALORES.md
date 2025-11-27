# Análise: Como os Valores de Entradas são Calculados

## 📋 Resumo Executivo

A diferença no "Valor total de entradas" entre a página **Entradas** e a página **Consolidação** vem de uma **regra de negócio diferente** para calcular valores quando há ajustes de quantidade.

- **Página Entradas**: Usa o valor original da NF (`custo_total`) mesmo quando há ajuste de quantidade
- **Página Consolidação**: Recalcula o valor proporcionalmente quando há ajuste de quantidade

---

## 🔍 1. Como o Total é Calculado na Aba Entradas

### Arquivo: `components/entries/EntriesTable.tsx`

```typescript
const totalCusto = useMemo(
  () => rows.reduce((acc, row) => acc + row.custo_total, 0),
  [rows]
);
```

### Campos Utilizados:
- **`row.custo_total`**: Valor original da nota fiscal (campo `vl_item` do `document_item`)
- **Valor total permanece constante**: Mesmo quando há ajuste de quantidade, o `custo_total` (valor da NF) não muda
- **Custo unitário é recalculado**: Quando há ajuste, o custo unitário é recalculado para manter o valor total constante

### Cálculo do Custo Unitário Ajustado:
```typescript
const qtdUsada = isAdjusted ? (row.adjusted_qty ?? row.quantidade_nf) : row.quantidade_nf;
const custoUnitarioAjustado = qtdUsada > 0 ? row.custo_total / qtdUsada : row.custo_unitario;
```

**Regra**: `custo_unitario_ajustado = custo_total / qtd_ajustada`

**Exemplo**:
- `qtd_original = 5`, `custo_total = 332.60`, `adjusted_qty = 100`
- `custo_unitario_ajustado = 332.60 / 100 = 3.326`
- **Valor total permanece**: `332.60` (não muda)

### Fonte dos Dados:
O `custo_total` vem de `lib/entradas.ts` (função `buildEntradasItems`):

```typescript
const quantidadeNF = item.qtd ?? 0;
const custoTotal = item.vl_item ?? 0;  // Valor original da NF
const custoUnitario = quantidadeNF !== 0 ? custoTotal / quantidadeNF : custoTotal;
const adjustedQty = adjustments.get(item.id) ?? null;

return {
  // ...
  quantidade_nf: quantidadeNF,
  custo_unitario: custoUnitario,
  custo_total: custoTotal,  // ← Valor original, NÃO recalculado
  adjusted_qty: adjustedQty,
};
```

### Regra de Negócio:
**Sempre usa o valor original da NF, independente de ajustes de quantidade.**

---

## 🔍 2. Como o Total é Calculado na Consolidação

### Arquivo: `app/movimentacoes/consolidado/page.tsx` (função `fetchEntryAggregates`)

```typescript
// Calcular valor baseado em qtyUsada
const valorOriginal = item.vl_item ?? 0;
let valorUsado: number;

if (adjustedQty !== null && qtdOriginal > 0) {
  // Recalcular valor proporcionalmente ao ajuste de quantidade
  const custoUnitario = valorOriginal / qtdOriginal;
  valorUsado = custoUnitario * adjustedQty;
} else {
  // Sem ajuste, usar valor original
  valorUsado = valorOriginal;
}

// SOMAR (nunca sobrescrever)
agg.qty += qtyUsada;
agg.valor += valorUsado;
```

### Campos Utilizados:
- **`valorOriginal`**: `item.vl_item` (valor original da NF)
- **`qtdOriginal`**: Quantidade original (`item.movement_qty` ou `item.qtd`)
- **`adjustedQty`**: Quantidade ajustada (se houver)

### Regra de Negócio:
1. **Se há ajuste** (`adjustedQty !== null` e `qtdOriginal > 0`):
   - Calcula custo unitário original: `custoUnitario = valorOriginal / qtdOriginal`
   - **Recalcula valor total**: `valorUsado = custoUnitario * adjustedQty`
   - ⚠️ **INCONSISTÊNCIA**: Mantém o custo unitário original e recalcula o valor total para cima
   
2. **Se não há ajuste**:
   - Usa valor original: `valorUsado = valorOriginal`

### Exemplo Prático:
- Item com `qtd_original = 5`, `valorOriginal = 332.60`, `adjustedQty = 100`
- Cálculo:
  - `custoUnitario = 332.60 / 5 = 66.52` (mantém custo unitário original)
  - `valorUsado = 66.52 * 100 = 6652.00` (recalcula valor total para cima)
- **Resultado**: Valor total aumenta proporcionalmente à quantidade ajustada
- ⚠️ **DIFERENTE da Entradas**: Na Entradas, o valor total permanece constante (332.60) e o custo unitário é recalculado para baixo (3.326)

---

## 📊 3. Comparação: Exemplo do Código 004616

### Na Aba Entradas:
- **Item 1**: `qtd_nf = 3`, `custo_total = 199.56` → **Valor usado: 199.56**
- **Item 2**: `qtd_nf = 5`, `custo_total = 332.60`, `adjusted_qty = 100` → **Valor usado: 332.60** (original)
- **Total em Entradas**: `199.56 + 332.60 = 532.16`

### Na Consolidação:
- **Item 1**: `qtd_original = 3`, `valorOriginal = 199.56`, sem ajuste → **Valor usado: 199.56**
- **Item 2**: `qtd_original = 5`, `valorOriginal = 332.60`, `adjustedQty = 100`
  - `custoUnitario = 332.60 / 5 = 66.52`
  - `valorUsado = 66.52 * 100 = 6652.00`
- **Total na Consolidação**: `199.56 + 6652.00 = 6851.56`

### Diferença:
- **Valor em Entradas**: 532.16
- **Valor na Consolidação**: 6851.56
- **Diferença**: 6319.40

**Causa**: O item 2 tem ajuste de 5 para 100, e a Consolidação recalcula o valor proporcionalmente, enquanto a Entradas mantém o valor original.

---

## 🎯 4. Conclusão - INCONSISTÊNCIA DE REGRA DE NEGÓCIO

A diferença no "Valor total de entradas" entre as duas telas vem de uma **inconsistência na regra de negócio** para calcular valores quando há ajustes de quantidade:

### Na Aba Entradas:
- **Valor total permanece constante**: `custo_total` não muda (332.60)
- **Custo unitário é recalculado**: `custo_unitario_ajustado = custo_total / qtd_ajustada`
- **Lógica**: "O valor pago na NF não muda, apenas o custo unitário se ajusta"

### Na Consolidação:
- **Custo unitário permanece constante**: Mantém o custo unitário original (66.52)
- **Valor total é recalculado**: `valorUsado = custoUnitario * adjustedQty`
- **Lógica**: "O custo unitário não muda, o valor total aumenta proporcionalmente"

### ⚠️ PROBLEMA IDENTIFICADO:
As duas telas usam **lógicas opostas**:
- **Entradas**: Valor total constante → Custo unitário ajustado
- **Consolidação**: Custo unitário constante → Valor total ajustado

**Impacto**: Para itens com ajustes significativos (ex: 5 → 100), a diferença de valor pode ser muito grande:
- Entradas: 332.60 (valor original mantido)
- Consolidação: 6652.00 (valor recalculado proporcionalmente)
- Diferença: 6319.40

---

## 📝 Notas Técnicas

### Por que essa diferença existe?
- A **Entradas** mostra o valor que foi pago na NF (valor original)
- A **Consolidação** precisa refletir o valor proporcional à quantidade ajustada para cálculos de estoque e custo médio

### Qual está correto?
**A lógica da Entradas parece ser a correta**:
- O valor pago na NF não muda quando você ajusta a quantidade
- O que muda é o custo unitário (quanto custa cada unidade após o ajuste)
- Exemplo: Se você pagou R$ 332,60 por 5 unidades e ajusta para 100 unidades, você ainda pagou R$ 332,60, mas agora o custo unitário é R$ 3,326 (não R$ 66,52)

**A Consolidação deveria seguir a mesma lógica**:
- Manter o valor total constante
- Recalcular o custo unitário proporcionalmente

### Próximos Passos
Os logs adicionados mostrarão exatamente quanto da diferença total vem dessa reprecificação dos itens ajustados.

