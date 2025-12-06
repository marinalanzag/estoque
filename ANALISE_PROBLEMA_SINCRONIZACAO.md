# Análise do Problema de Sincronização

## 🔍 Problema Identificado

### Sintomas:
1. ✅ Ajuste é criado e aparece nas tabelas (estado local)
2. ❌ Ao ir para aba "Relatório", não aparece (continua com 2)
3. ❌ Ao voltar para "Ajustes de Códigos", ajustes voltam para 2 (novos desaparecem)
4. ✅ Ao clicar em "Atualizar ajustes", aparece correto (10 ajustes)
5. ❌ Ao sair da página, volta para 2

### Por que os 2 ajustes antigos ficam salvos?
- Eles provavelmente têm `period_id = null` ou `period_id = período_ativo`
- Estão sendo filtrados corretamente pela query

### Por que os 8 novos ajustes desaparecem?

## 🔄 Fluxo Atual (PROBLEMÁTICO)

### 1. Quando cria um ajuste:
```
handleCreateAdjustment() 
  → Salva no banco (✅)
  → Atualiza estado local (✅)
  → loadAdjustments() - busca da API /api/adjustments/list (✅)
  → router.refresh() - revalida página servidor (⚠️ PROBLEMA AQUI)
```

### 2. router.refresh() revalida a página servidor:
```
app/ajustes/page.tsx (Server Component)
  → Busca ajustes do banco (linha 123-135)
  → Passa como initialAdjustments para AdjustmentsPageClient
```

### 3. useEffect sobrescreve estado local:
```
AdjustmentsTable.tsx (linha 54-69)
  → useEffect detecta mudança em initialAdjustments
  → setAdjustments(initialAdjustments) - SOBRESCREVE estado local
  → Se initialAdjustments não tem os novos ajustes, eles desaparecem!
```

## 🐛 Causa Raiz

### Problema 1: Cache/Timing do router.refresh()
- `router.refresh()` pode não estar buscando dados atualizados imediatamente
- Next.js pode estar usando cache da página servidor
- A query do banco pode estar executando antes do commit do ajuste ser visível

### Problema 2: Filtro pode estar diferente
- A página servidor usa: `period_id.eq.${activePeriod.id},period_id.is.null`
- A API `/api/adjustments/list` usa: `period_id.eq.${activePeriod.id},period_id.is.null`
- **MAS:** Se os novos ajustes foram criados sem `period_id` quando não havia período ativo, eles podem não aparecer

### Problema 3: useEffect sempre sobrescreve
- O `useEffect` na linha 64 **sempre** sobrescreve o estado local
- Não verifica se os novos ajustes já estão no estado local
- Se `initialAdjustments` vier com dados antigos (cache), sobrescreve os novos

## 💡 Soluções Possíveis

### Solução 1: Não sobrescrever se estado local tem mais ajustes
```typescript
useEffect(() => {
  // Se o estado local tem mais ajustes que initialAdjustments, não sobrescrever
  // Isso preserva ajustes recém-criados que ainda não estão no servidor
  if (adjustments.length > initialAdjustments.length) {
    console.log("[AdjustmentsTable] Estado local tem mais ajustes, mantendo estado local");
    return;
  }
  setAdjustments(initialAdjustments);
}, [initialAdjustments]);
```

### Solução 2: Fazer merge ao invés de sobrescrever
```typescript
useEffect(() => {
  // Fazer merge: manter ajustes locais que não estão em initialAdjustments
  const merged = [...initialAdjustments];
  adjustments.forEach(localAdj => {
    if (!merged.find(a => a.id === localAdj.id)) {
      merged.push(localAdj);
    }
  });
  setAdjustments(merged);
}, [initialAdjustments]);
```

### Solução 3: Adicionar revalidatePath() antes do refresh
```typescript
import { revalidatePath } from 'next/cache';
// ...
revalidatePath('/ajustes');
router.refresh();
```

### Solução 4: Usar cache: 'no-store' na página servidor
- Adicionar `export const dynamic = 'force-dynamic'` na página
- Isso força Next.js a não usar cache

### Solução 5: Verificar period_id dos novos ajustes
- Se os novos ajustes foram criados sem `period_id` quando não havia período ativo
- E agora há período ativo, eles podem não aparecer no filtro
- Verificar se `period_id` está sendo salvo corretamente

## 🎯 Solução Recomendada

**Combinar Solução 1 + Solução 4:**

1. **Não sobrescrever se estado local tem mais ajustes** (preserva ajustes recém-criados)
2. **Adicionar `dynamic = 'force-dynamic'`** na página servidor (evita cache)
3. **Verificar se period_id está sendo salvo** corretamente nos novos ajustes

## 📊 Sobre o Relatório

O usuário esclareceu que:
- **A aba "Relatório de Ajustes" deve ser apenas um relatório/exportação da tabela "AJUSTES REALIZADOS E SALVOS"**
- Ou seja, deve mostrar **exatamente os mesmos dados** da tabela

**Isso significa:**
- O relatório deve usar a mesma fonte de dados (mesma API ou mesmo estado)
- Não deve ter filtros diferentes
- Deve ser apenas uma visualização/exportação dos mesmos dados

**Solução:**
- O relatório já usa `/api/adjustments/report` que tem os mesmos filtros
- O problema é que os ajustes não estão aparecendo porque não estão sendo salvos com `period_id` correto ou não estão sendo buscados corretamente

