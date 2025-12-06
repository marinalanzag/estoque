# Diagnóstico do Problema de Cache - Ajustes

## 🔍 Problema Identificado

### Sintomas:
- Ajustes alternam entre 2 e 10 (parece cache)
- Todos os ajustes foram feitos no mesmo `period_id`
- Ao sair e voltar, volta para 2 ajustes
- Ao clicar em "Atualizar", mostra 10 ajustes

## 🔎 Causas Possíveis

### 1. Cache do Next.js na Página Servidor
- A página `app/ajustes/page.tsx` é um Server Component
- Next.js pode estar usando cache da renderização anterior
- `router.refresh()` pode não estar invalidando o cache corretamente

### 2. useEffect Sobrescrevendo Estado Local
- Linha 64: `setAdjustments(initialAdjustments)` sempre sobrescreve
- Quando `router.refresh()` retorna dados em cache, sobrescreve os ajustes novos

### 3. Timing do Banco de Dados
- Ajustes podem estar sendo salvos, mas a query do servidor executa antes do commit ser visível
- Isso causa inconsistência temporária

## 🧪 Queries para Verificar

Execute `db/verificar_ajustes_period_id.sql` para verificar:
1. Se todos os ajustes têm `period_id` correto
2. Se há ajustes duplicados
3. Se há inconsistências de timing

## 💡 Soluções a Implementar

### 1. Adicionar `dynamic = 'force-dynamic'` na página servidor
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```

### 2. Proteger useEffect para não sobrescrever ajustes locais
```typescript
// Não sobrescrever se estado local tem mais ajustes
if (adjustments.length > initialAdjustments.length) {
  // Preservar ajustes locais que ainda não estão no servidor
  return;
}
```

### 3. Adicionar funcionalidade de exclusão
- Botão de excluir na tabela "Ajustes Realizados e Salvos"
- Confirmar antes de excluir
- Atualizar estado após exclusão

