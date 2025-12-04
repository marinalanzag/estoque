# 🔧 Solução: Múltiplos Períodos Ativos

## Problema Identificado

- Há múltiplos períodos com `is_active = TRUE` no banco
- A API `/api/periods/active` pode retornar qualquer um deles (não necessariamente o recém-criado)
- O frontend fica confuso sobre qual período está realmente ativo

## Soluções Propostas

### Solução 1: Melhorar API `/api/periods/active` (RECOMENDADA)
**O que fazer:**
- Se houver múltiplos períodos ativos, desativar todos os duplicados
- Retornar sempre o período mais recente (por `created_at` ou `updated_at`)
- Garantir que só um período fique ativo

**Vantagens:**
- Corrige o problema na raiz
- Previne que o problema aconteça novamente
- Funciona mesmo se alguém ativar múltiplos períodos manualmente

---

### Solução 2: Melhorar a Lógica de Criação
**O que fazer:**
- Garantir que TODOS os períodos sejam desativados ANTES de criar
- Verificar se a desativação realmente funcionou
- Se não funcionar, retornar erro

**Vantagens:**
- Previne a criação de múltiplos ativos
- Garante integridade desde a criação

---

### Solução 3: Frontend Usar Período Retornado pela Criação
**O que fazer:**
- Confiar apenas no período retornado pela API de criação
- Não buscar o período ativo depois
- Usar o período retornado diretamente

**Vantagens:**
- Mais simples e confiável
- Não depende de buscar depois
- Evita problemas de sincronização

---

### Solução 4: Limpar Múltiplos Ativos Automaticamente
**O que fazer:**
- Criar um script/endpoint para limpar períodos ativos duplicados
- Executar automaticamente quando detectar múltiplos
- Manter sempre apenas o mais recente ativo

**Vantagens:**
- Limpa o problema existente
- Previne no futuro

---

## Implementação Recomendada

**Combinar Soluções 1 + 2:**

1. **Melhorar `/api/periods/active`:**
   - Detectar múltiplos períodos ativos
   - Desativar todos exceto o mais recente
   - Retornar o mais recente

2. **Melhorar `/api/periods/create`:**
   - Verificar se desativação funcionou
   - Se não, tentar novamente ou retornar erro

3. **Opcional: Limpar banco existente:**
   - Desativar todos os períodos
   - Manter apenas o mais recente ativo

---

## Código Proposto

### 1. Melhorar `/api/periods/active`

```typescript
// Se houver múltiplos períodos ativos
const { data: activePeriods } = await supabaseAdmin
  .from("periods")
  .select("*")
  .eq("is_active", true)
  .order("created_at", { ascending: false });

if (activePeriods && activePeriods.length > 1) {
  // Desativar todos exceto o mais recente
  const mostRecent = activePeriods[0];
  const others = activePeriods.slice(1);
  
  for (const period of others) {
    await supabaseAdmin
      .from("periods")
      .update({ is_active: false })
      .eq("id", period.id);
  }
  
  return mostRecent;
}
```

### 2. Melhorar `/api/periods/create`

```typescript
// Desativar todos os períodos e VERIFICAR
const { count } = await supabaseAdmin
  .from("periods")
  .update({ is_active: false })
  .select("*", { count: 'exact', head: true });

console.log(`[periods/create] Períodos desativados: ${count}`);

// Verificar se realmente não há períodos ativos
const { data: stillActive } = await supabaseAdmin
  .from("periods")
  .select("id")
  .eq("is_active", true);

if (stillActive && stillActive.length > 0) {
  console.warn(`[periods/create] ⚠️ Ainda há ${stillActive.length} períodos ativos!`);
  // Tentar desativar novamente...
}
```

---

## Próximo Passo

Escolher qual solução implementar ou combinar múltiplas.




