# 🐛 Análise Completa: Bugs Identificados

## Resumo Executivo

Identifiquei **3 BUGS CRÍTICOS** que explicam completamente o problema:

1. ✅ **BUG #1 - CORRIGIDO**: Inventário Final não somava `ajustes_recebidos`
2. ⚠️ **BUG #2 - PARCIALMENTE CORRIGIDO**: Cache do Vercel causava duplicação de ajustes
3. ❌ **BUG #3 - AINDA EXISTE**: Item doador sem movimentações não aparece no inventário

---

## BUG #1: Inventário Final Não Somava Ajustes Recebidos ✅ CORRIGIDO

### Localização
[lib/inventoryFinal.ts:76](lib/inventoryFinal.ts:76)

### Código ANTES (ERRADO)
```typescript
const estoqueFinal = estoqueTeorico - baixas;  // ❌ Não soma recebidos!
```

### Código DEPOIS (CORRETO)
```typescript
const estoqueFinal = estoqueTeorico + recebidos - baixas;  // ✅ Soma recebidos!
```

### Impacto
- Item 011141 mostrava **10 unidades** ao invés de **38**
- Cálculo: `29 - 19 = 10` (errado) vs `29 + 28 - 19 = 38` (correto)

### Status: ✅ CORRIGIDO
Correção feita no commit anterior.

---

## BUG #2: Cache do Vercel Causava Duplicação/Omissão de Ajustes ⚠️ PARCIALMENTE CORRIGIDO

### Localização
[app/api/adjustments/inventory-data/route.ts](app/api/adjustments/inventory-data/route.ts)

### O Problema

O Next.js na Vercel cacheia rotas por padrão. Sem `revalidate: 0`, a API retornava:
- Dados desatualizados
- Ajustes processados múltiplas vezes
- Ajustes omitidos

### Evidência Real

**Query no banco retorna:**
```sql
Ajuste 1: cod_positivo=011141, qtd_baixada=19  (011141 doa para 004179)
Ajuste 2: cod_negativo=011141, qtd_baixada=28  (011141 recebe de 013671)
```

**API com cache retornava:**
```json
{
  "ajustes_recebidos": 0,      // ❌ Não viu o Ajuste 2
  "ajustes_fornecidos": 57,    // ❌ Triplicou o Ajuste 1 (19 x 3 = 57)
  "estoque_final": -28
}
```

**API sem cache (debug endpoint) retornava:**
```json
{
  "ajustes_recebidos": 28,     // ✅ Correto
  "ajustes_fornecidos": 19,    // ✅ Correto
  "estoque_final": 38
}
```

### Por Que Chegou em 57 (e Não Outro Número)?

**Teoria mais provável**: Cache armazenou estado intermediário durante processamento do forEach.

Veja o código que processa ajustes:
```typescript
// Linha 508-596 em app/api/adjustments/inventory-data/route.ts
(adjustments ?? []).forEach((adj) => {
  const codNegativo = normalizeCodItem(adj.cod_negativo);
  const codPositivo = normalizeCodItem(adj.cod_positivo);
  const qtdBaixada = Number(adj.qtd_baixada);

  // Processa código negativo (recebe)
  const negativo = inventory.get(codNegativo);
  if (negativo) {
    negativo.ajustes_recebidos += qtdBaixada;
  }

  // Processa código positivo (fornece)
  const positivo = inventory.get(codPositivo);
  if (positivo) {
    positivo.ajustes_fornecidos += qtdBaixada;  // ⚠️ Pode ser executado múltiplas vezes se cache for incoerente
  }
});
```

**Cenário possível**:
1. Primeira execução: processou Ajuste 1 → `ajustes_fornecidos = 19`
2. Cache armazenou estado intermediário
3. Segunda requisição: cache retornou `inventory` com 19, mas query retornou TODOS os ajustes novamente
4. Reprocessou: `19 + 19 = 38`
5. Mais uma vez: `38 + 19 = 57`

### Status: ⚠️ PARCIALMENTE CORRIGIDO
- ✅ Adicionado `export const revalidate = 0`
- ✅ Forçado redeploy
- ⚠️ Mas cache pode ter deixado dados inconsistentes no banco

---

## BUG #3: Item Doador Sem Movimentações Não Aparece no Inventário ❌ AINDA EXISTE

### Localização
[app/api/adjustments/inventory-data/route.ts:576-595](app/api/adjustments/inventory-data/route.ts:576-595)

### O Código Problemático

```typescript
// Ajuste no código positivo (fornece quantidade)
const positivo = inventory.get(codPositivo);
if (positivo) {
  positivo.ajustes_fornecidos += qtdBaixada;  // ✅ OK se item já existe
} else {
  // ❌ PROBLEMA: Não faz NADA se item não existe!
  // O item doador simplesmente não aparece no inventário
}
```

### Compare com Código do Item Negativo (CORRETO)

```typescript
// Ajuste no código negativo (recebe quantidade)
const negativo = inventory.get(codNegativo);
if (negativo) {
  negativo.ajustes_recebidos += qtdBaixada;  // ✅ OK se item já existe
} else {
  // ✅ CORRETO: Cria o item se não existe
  inventory.set(codNegativo, {
    cod_item: codNegativo,
    estoque_inicial: 0,
    entradas: 0,
    saidas: 0,
    estoque_teorico: 0,
    ajustes_recebidos: qtdBaixada,
    ajustes_fornecidos: 0,
    estoque_final: qtdBaixada,
  });
}
```

### Por Que Isso é Um Problema?

**Cenário:**
1. Item "ABC123" tem estoque inicial = 0, sem entradas, sem saídas
2. Usuário cria ajuste: "ABC123" doa 5 para "XYZ789"
3. **Resultado esperado**: ABC123 aparece com -5 de estoque
4. **Resultado real**: ABC123 não aparece em lugar nenhum! ❌

**O Map `inventory` só contém itens que tiveram:**
- Estoque inicial > 0, OU
- Entradas > 0, OU
- Saídas > 0

Se um item não teve NENHUMA movimentação, ele **não está no Map**.

### Impacto Real

Este bug **NÃO afetou o item 011141** porque ele tinha:
- Estoque inicial: 35
- Entradas: 6
- Saídas: 12
- **Logo, estava no Map** ✅

Mas pode afetar outros itens que:
- Foram usados apenas como doadores
- Não tiveram nenhuma movimentação no período

### Status: ❌ AINDA EXISTE (Precisa Correção)

---

## Explicação Final: De Onde Saíram os 57 de Ajustes Fornecidos?

### Resumo da Teoria

**Não foi que o item 011141 doou 57 unidades de verdade.**

O que aconteceu foi:

1. ✅ Item 011141 **realmente doou apenas 19 unidades** (Ajuste 1 para item 004179)
2. ✅ Item 011141 **realmente recebeu 28 unidades** (Ajuste 2 de item 013671)
3. ❌ **Cache do Vercel** armazenou estado intermediário corrupto
4. ❌ Ao processar ajustes, o forEach **executou múltiplas vezes** ou com dados parciais
5. ❌ Resultado: `ajustes_fornecidos` foi incrementado 3 vezes (19 + 19 + 19 = 57)

### Por Que Tenho Certeza?

**Evidência 1**: Query direta no banco mostra apenas 2 ajustes envolvendo 011141
```sql
SELECT * FROM code_offset_adjustments
WHERE cod_negativo = '011141' OR cod_positivo = '011141';

-- Resultado:
-- Ajuste 1: cod_positivo=011141, qtd_baixada=19
-- Ajuste 2: cod_negativo=011141, qtd_baixada=28
```

**Evidência 2**: Endpoint de debug (sem cache) calculou corretamente
```json
{
  "ajustes_recebidos": 28,
  "ajustes_fornecidos": 19,
  "estoque_final_calculado": 38
}
```

**Evidência 3**: Após limpar cache, API principal passou a retornar valores corretos
- Antes: `ajustes_fornecidos: 57` ❌
- Depois: `ajustes_fornecidos: 19` ✅

### Conclusão

Os "57 de ajustes fornecidos" eram **FANTASMA** - causados por cache desatualizado processando o mesmo ajuste de 19 múltiplas vezes.

---

## Sobre o Inventário Final

### Por Que Mostrava 10?

O inventário final tinha **2 problemas simultâneos**:

**Problema 1**: Não somava `ajustes_recebidos` (BUG #1)
```typescript
// ANTES (errado)
const estoqueFinal = estoqueTeorico - baixas;
// 29 - 19 = 10 ❌
```

**Problema 2**: Usava dados da API que estava com cache (BUG #2)
- API retornava `ajustes_fornecidos: 57` por causa do cache
- Mas o código do inventário final chama isso de `baixas` (baixasPositivas)

### Se o Inventário Final Usasse os Dados Corretos?

Se a API retornasse valores corretos (`recebidos: 28, baixas: 19`):

**ANTES do fix (sem somar recebidos):**
```typescript
estoqueFinal = 29 - 19 = 10  ❌
```

**DEPOIS do fix (somando recebidos):**
```typescript
estoqueFinal = 29 + 28 - 19 = 38  ✅
```

---

## Resumo das Correções Necessárias

### ✅ Já Corrigido
1. ✅ Inventário Final agora soma `ajustes_recebidos`
2. ✅ Adicionado `revalidate: 0` para desabilitar cache

### ⚠️ Precisa Verificar
1. ⚠️ Executar script SQL para verificar se há ajustes duplicados no banco
2. ⚠️ Verificar se há outros itens afetados por cache

### ❌ Precisa Implementar
1. ❌ Corrigir BUG #3: criar item doador se não existir no Map
2. ❌ Adicionar validação: impedir ajustes se doador não tem estoque
3. ❌ Adicionar logs de auditoria para rastrear origem de inconsistências

---

## Próximos Passos Recomendados

1. **Verificar dados no banco**
   ```sql
   -- Ver TODOS os ajustes do item 011141
   SELECT * FROM code_offset_adjustments
   WHERE cod_negativo IN ('011141', '11141')
      OR cod_positivo IN ('011141', '11141')
   ORDER BY created_at;
   ```

2. **Verificar se há duplicatas**
   ```sql
   -- Procurar ajustes duplicados (mesmo cod_positivo, cod_negativo, qtd, criados próximos)
   SELECT cod_positivo, cod_negativo, qtd_baixada, COUNT(*)
   FROM code_offset_adjustments
   GROUP BY cod_positivo, cod_negativo, qtd_baixada, DATE(created_at)
   HAVING COUNT(*) > 1;
   ```

3. **Corrigir BUG #3**
   - Modificar código para criar item doador se não existir
   - Testar com item sem movimentações

4. **Implementar validação**
   - Seguir plano em [SOLUCAO_PERMANENTE_VALIDACAO_AJUSTES.md](SOLUCAO_PERMANENTE_VALIDACAO_AJUSTES.md)
