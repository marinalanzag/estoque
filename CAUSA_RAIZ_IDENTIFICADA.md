# Causa Raiz do Problema Identificada

## 📊 Análise dos Dados

### Ajustes no Banco:
1. **1 ajuste recente (hoje):**
   - `period_id = 6d4abba3-fc54-4946-a248-5e5370693a92` ✅ (período ativo)
   - Criado há 37 minutos

2. **8 ajustes antigos:**
   - Todos têm `period_id = null` ❌
   - Criados há ~23-25 horas atrás
   - **Estes são os que desaparecem!**

## 🔍 Causa Raiz

### Problema 1: Ajustes com `period_id = null`
- Os 8 ajustes foram criados quando **não havia período ativo** ou antes de implementar `period_id`
- A query na página servidor filtra por: `period_id.eq.${activePeriod.id},period_id.is.null`
- Isso **DEVERIA** incluir os ajustes com `period_id = null`
- **MAS** o Next.js pode estar usando cache e retornando apenas os ajustes com `period_id` correto

### Problema 2: Cache do Next.js
- Quando `router.refresh()` é chamado, a página servidor pode estar retornando dados em cache
- O cache pode ter sido criado quando havia apenas 2 ajustes (os com `period_id` correto)
- Mesmo com o filtro `period_id.is.null`, o cache pode não estar incluindo esses ajustes

### Problema 3: Timing
- Os ajustes com `period_id = null` foram criados há muito tempo
- O cache pode ter sido criado antes desses ajustes existirem
- Quando o cache é invalidado, pode não estar incluindo todos os ajustes

## 💡 Soluções Implementadas

### 1. `dynamic = 'force-dynamic'` na página servidor
- Força Next.js a sempre buscar dados atualizados do banco
- Não usa cache da renderização anterior

### 2. Merge no useEffect
- Preserva ajustes locais que ainda não estão no servidor
- Evita sobrescrever ajustes recém-criados

### 3. Funcionalidade de Exclusão
- Permite excluir ajustes indesejados
- Útil para limpar ajustes de teste ou incorretos

## 🎯 Solução Adicional Recomendada

### Atualizar `period_id` dos ajustes antigos:
```sql
-- Atualizar period_id dos ajustes com null para o período ativo
UPDATE code_offset_adjustments
SET period_id = '6d4abba3-fc54-4946-a248-5e5370693a92'
WHERE period_id IS NULL
  AND sped_file_id = 'eabc99dc-1fa7-4a8e-b4d6-7fe8db6e2a14';
```

**IMPORTANTE:** Execute esta query apenas se você quiser que esses 8 ajustes sejam vinculados ao período ativo. Se eles são de outro período ou são ajustes de teste que devem ser excluídos, não execute.

## 📋 Próximos Passos

1. **Testar as correções implementadas:**
   - As correções de cache devem resolver o problema
   - Os ajustes com `period_id = null` devem aparecer

2. **Decidir sobre os 8 ajustes antigos:**
   - Se são válidos: Atualizar `period_id` para o período ativo
   - Se são de teste: Excluir usando a nova funcionalidade
   - Se são de outro período: Deixar como estão (não aparecerão)

3. **Verificar se o problema persiste:**
   - Se após as correções os ajustes ainda alternam, pode ser necessário investigar mais

