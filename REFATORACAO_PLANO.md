# 📋 Plano de Refatoração - Fluxo de Períodos

## Status Atual

✅ **Completado:**
1. Helpers centralizados em `lib/periods.ts` (getAllPeriods, getActivePeriod)
2. Server Actions criadas em `app/periodos/configuracao/actions.ts`

🔄 **Em andamento:**
3. Criando PeriodSelectorServer e refatorando PeriodSelector

⏳ **Pendente:**
4. Integrar no layout
5. Ajustar componentes que fazem fetch
6. Limpeza de código

## Estratégia de Refatoração

Dado o tamanho do arquivo PeriodSelector.tsx (795 linhas), a refatoração será feita preservando a UI/UX mas simplificando a lógica:

### PeriodSelectorClient (novo)
- Recebe `initialPeriods` e `initialActivePeriod` via props
- Remove todos os fetches (`loadPeriods`, `loadActivePeriod`)
- Remove eventos customizados (`window.addEventListener`)
- Remove `window.location.href/reload`
- Usa Server Actions para mutações
- Usa `router.refresh()` após mutações (já tem revalidatePath nas actions)

### Mudanças Principais:
1. **Remover:** Todos os `useEffect` que fazem fetch
2. **Remover:** Funções `loadPeriods()` e `loadActivePeriod()`
3. **Remover:** Eventos customizados
4. **Adicionar:** Props `initialPeriods` e `initialActivePeriod`
5. **Substituir:** Fetch por Server Actions em `handleCreatePeriod` e `handleActivatePeriod`
6. **Simplificar:** Usar `router.refresh()` após Server Actions (revalidatePath já está nas actions)

Vou criar o PeriodSelectorClient agora com essas mudanças.

