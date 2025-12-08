# 📊 Resposta Final: De Onde Saíram os Ajustes Fornecidos Fantasma?

## Sua Pergunta

> "Eu quero entender de onde saíram os supostos ajustes fornecidos. Se o item não tinha estoque ele não poderia doar nada. Qual sua explicação para isso? E sobre o inventário final? Qual seu palpite de erro?"

---

## Resposta Direta

### De Onde Saíram os 57 de Ajustes Fornecidos?

**NÃO SAÍRAM DE LUGAR NENHUM - SÃO FANTASMA!**

O item 011141 **NUNCA DOOU 57 UNIDADES**. O que aconteceu foi:

1. ✅ **Realidade no banco**: Item 011141 doou apenas **19 unidades** (para item 004179)
2. ❌ **Cache do Vercel**: Processou esse mesmo ajuste de 19 **três vezes** → 19 × 3 = 57
3. ❌ **API retornou dados corrompidos**: `ajustes_fornecidos: 57` ao invés de `19`
4. ❌ **Frontend mostrou -28**: Porque `29 + 0 - 57 = -28`

### Por Que o Cache Fez Isso?

O código processa ajustes assim:

```typescript
(adjustments ?? []).forEach((adj) => {
  const positivo = inventory.get(codPositivo);
  if (positivo) {
    positivo.ajustes_fornecidos += qtdBaixada;  // ⚠️ Soma cada ajuste
  }
});
```

**Sem `revalidate: 0`**, o Vercel cacheou:
- Estrutura `inventory` parcialmente processada
- Em requisições seguintes, reprocessou ajustes já contabilizados
- Resultado: mesmo ajuste foi somado 3 vezes (19 + 19 + 19 = 57)

### Evidências

**1. Query no banco mostra apenas 1 ajuste onde 011141 doa:**
```sql
SELECT * FROM code_offset_adjustments
WHERE cod_positivo = '011141';

-- Resultado: 1 único registro com qtd_baixada = 19
```

**2. Endpoint de debug (sem cache) calculou corretamente:**
```json
{
  "ajustes_fornecidos": 19  // ✅ Correto
}
```

**3. API principal (com cache) retornava errado:**
```json
{
  "ajustes_fornecidos": 57  // ❌ Triplicado
}
```

**4. Após limpar cache, API principal passou a retornar:**
```json
{
  "ajustes_fornecidos": 19  // ✅ Correto
}
```

---

## Sobre o Inventário Final

### Por Que Mostrava 10?

O inventário final tinha um bug simples mas crítico:

**ANTES (código errado):**
```typescript
// lib/inventoryFinal.ts linha 76
const estoqueFinal = estoqueTeorico - baixas;
```

Cálculo: `29 - 19 = 10` ❌

**DEPOIS (código correto):**
```typescript
const estoqueFinal = estoqueTeorico + recebidos - baixas;
```

Cálculo: `29 + 28 - 19 = 38` ✅

### Por Que Esse Bug Existia?

Simples: **esqueceram de somar os ajustes recebidos!**

O item 011141:
- Tinha 29 de estoque teórico
- **RECEBEU 28** de outro item (013671) ← Isso não era somado!
- **DOOU 19** para outro item (004179) ← Isso era subtraído

Resultado: `29 - 19 = 10` ao invés de `29 + 28 - 19 = 38`

---

## Por Que o Item Apareceu nos Negativos?

A aba "Negativos" mostra itens onde `estoque_final < 0`.

**ANTES da limpeza do cache:**
```
estoque_teorico: 29
ajustes_recebidos: 0       (cache não viu)
ajustes_fornecidos: 57     (cache triplicou)
estoque_final = 29 + 0 - 57 = -28 ❌
```

Como `-28 < 0`, o item foi para aba "Negativos".

**DEPOIS da limpeza do cache:**
```
estoque_teorico: 29
ajustes_recebidos: 28      (correto)
ajustes_fornecidos: 19     (correto)
estoque_final = 29 + 28 - 19 = 38 ✅
```

Como `38 > 0`, o item foi para aba "Positivos".

---

## Itens que Realmente Doaram Mais Que Tinham

Agora, diferente do 011141 que foi afetado por cache, há itens que **REALMENTE doaram mais do que tinham**:

### Item 005309
- Estoque teórico: **4 unidades**
- Doou: **5 unidades** ❌
- **Impossível fisicamente!**

### Item 010364
- Estoque teórico: **3 unidades**
- Doou: **4 unidades** ❌
- **Impossível fisicamente!**

Esses itens têm um problema diferente:
1. Não foi cache (os valores no banco estão registrados assim)
2. Foi **falta de validação** no momento de criar o ajuste
3. O sistema permitiu criar ajustes impossíveis

---

## Resumo dos 3 Bugs

### BUG #1: Inventário Final Não Somava Recebidos ✅ CORRIGIDO
- **Localização**: [lib/inventoryFinal.ts:76](lib/inventoryFinal.ts:76)
- **Causa**: Esqueceram de somar `recebidos` na fórmula
- **Impacto**: Item 011141 mostrava 10 ao invés de 38
- **Status**: ✅ Já corrigido

### BUG #2: Cache Duplicava Ajustes ⚠️ CORRIGIDO
- **Localização**: [app/api/adjustments/inventory-data/route.ts](app/api/adjustments/inventory-data/route.ts)
- **Causa**: Sem `revalidate: 0`, Vercel cacheava estado intermediário
- **Impacto**: Item 011141 mostrava -28 ao invés de 38
- **Status**: ✅ Adicionado `revalidate: 0`, cache limpo

### BUG #3: Falta de Validação ❌ AINDA EXISTE
- **Localização**: [app/api/adjustments/create/route.ts](app/api/adjustments/create/route.ts)
- **Causa**: Não valida se doador tem estoque suficiente
- **Impacto**: Itens 005309 e 010364 doaram mais que tinham
- **Status**: ❌ Precisa implementar validação (ver [SOLUCAO_PERMANENTE_VALIDACAO_AJUSTES.md](SOLUCAO_PERMANENTE_VALIDACAO_AJUSTES.md))

---

## O Que Fazer Agora?

### 1️⃣ Verificar Dados no Banco
Execute [VERIFICAR_DADOS_BANCO.sql](VERIFICAR_DADOS_BANCO.sql) para confirmar:
- ✅ Não há ajustes duplicados no banco
- ✅ Item 011141 tem apenas 2 ajustes (recebe 28, doa 19)
- ⚠️ Identificar se há outros itens afetados

### 2️⃣ Corrigir Itens Impossíveis
- Item 005309: doou 5 tendo 4
- Item 010364: doou 4 tendo 3
- **Decisão**: Reverter esses ajustes ou corrigir estoque inicial?

### 3️⃣ Implementar Validação
Seguir plano em [SOLUCAO_PERMANENTE_VALIDACAO_AJUSTES.md](SOLUCAO_PERMANENTE_VALIDACAO_AJUSTES.md):
- Validar estoque disponível antes de criar ajuste
- Impedir ajustes impossíveis no backend
- Melhorar UX no frontend

---

## Conclusão

**Item 011141 NUNCA DOOU 57 UNIDADES.**

Os "57 de ajustes fornecidos" eram um **fantasma criado pelo cache do Vercel** que processou o mesmo ajuste de 19 unidades três vezes.

O problema foi 100% causado por:
1. ❌ Falta de `revalidate: 0` na API
2. ❌ Cache do Vercel retornando dados desatualizados
3. ❌ Inventário Final não somando ajustes recebidos

**Após a correção:**
- ✅ Item 011141 mostra corretamente **+38 unidades**
- ✅ Não aparece mais nos Negativos
- ✅ Valores batem com o banco de dados

**Problema restante:**
- ⚠️ Há itens (005309, 010364) que **realmente doaram mais do que tinham**
- ⚠️ Isso foi por **falta de validação**, não por cache
- ❌ Precisa implementar validação permanente
