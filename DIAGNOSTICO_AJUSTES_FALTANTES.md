# Diagnóstico: Ajustes Não Aparecem na Interface

## Problema Identificado

**Servidor retorna 184 ajustes**, mas **interface mostra apenas 2 ajustes**.

### Logs do Console

```
[AdjustmentsPageClient] initialAdjustments atualizados: 184
[AdjustmentsTable] ✅ Ajustes recarregados do banco: 2
```

## Causa Raiz

O componente `AdjustmentsTable` está **sobrescrevendo** os dados corretos do servidor com uma chamada API que retorna menos dados.

### Fluxo do Problema

1. **Servidor** (app/ajustes/page.tsx:141): Busca 184 ajustes corretamente
2. **Cliente recebe** (AdjustmentsPageClient): Recebe os 184 ajustes via `initialAdjustments`
3. **Cliente sobrescreve** (AdjustmentsTable.tsx:166): `loadAdjustments()` é chamado no `useEffect`
4. **API retorna apenas 2**: `/api/adjustments/list` retorna dados diferentes
5. **Estado final**: Apenas 2 ajustes visíveis na interface

## Onde Está o Bug

### Arquivo: components/adjustments/AdjustmentsTable.tsx

**Linhas 162-168:**
```typescript
useEffect(() => {
  console.log("[AdjustmentsTable] useEffect inicial - carregando dados para spedFileId:", spedFileId, "periodId:", activePeriodId);
  loadInventoryData();
  // ❌ PROBLEMA: Isso sobrescreve initialAdjustments (184) com dados da API (2)
  loadAdjustments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [spedFileId, activePeriodId]);
```

### Por Que a API Retorna Apenas 2?

Possíveis causas:

1. **Cache da API**: A rota `/api/adjustments/list` pode estar em cache
2. **Filtro diferente**: Apesar do código ser igual, a API pode estar usando um `period_id` diferente
3. **Timing**: A API é chamada antes do período estar completamente configurado

## Verificação Necessária

Execute no Console do Navegador (F12):

```javascript
// Ver qual URL está sendo chamada
console.log("URL da API:", `/api/adjustments/list?sped_file_id=SEU_SPED_ID&period_id=SEU_PERIOD_ID`);

// Fazer chamada manual
fetch('/api/adjustments/list?sped_file_id=SEU_SPED_ID&period_id=SEU_PERIOD_ID', {
  cache: 'no-store'
})
  .then(r => r.json())
  .then(data => console.log('Ajustes da API:', data.adjustments.length, data.adjustments));
```

## Solução Temporária (TESTE)

**Desabilitar a chamada `loadAdjustments()` no mount:**

```typescript
useEffect(() => {
  console.log("[AdjustmentsTable] useEffect inicial - carregando dados");
  loadInventoryData();
  // ✅ COMENTAR esta linha para testar:
  // loadAdjustments();
}, [spedFileId, activePeriodId]);
```

Com isso, a interface vai usar os 184 ajustes do servidor sem sobrescrever.

## Próximos Passos

1. **Testar comentando `loadAdjustments()`** para confirmar que isso resolve
2. **Verificar por que a API retorna apenas 2** ajustes
3. **Comparar IDs dos ajustes**: Ver se os 2 da API são os mesmos nos 184 do servidor
4. **Verificar cache**: Limpar cache do navegador e tentar novamente

## Dados para Comparação

### Ajustes Visíveis (2):
- ID: `758f1e30-4e31-4536-b318-cc56290220fa`
- ID: `cb7cea71-c16c-4112-a9a4-b7aa901198de`

### Ajuste que Queremos Excluir (invisível):
- ID: `6e026145-b508-4e29-afb4-c7a57ec8be96`
- Data: 2025-12-06 23:15
- Código negativo: 011141
- Código positivo: 013671
- Quantidade: 28

## Query SQL para Verificar

```sql
-- Ver TODOS os ajustes do período
SELECT id, cod_negativo, cod_positivo, qtd_baixada, created_at, period_id
FROM code_offset_adjustments
WHERE sped_file_id = 'SEU_SPED_FILE_ID'
  AND (period_id = 'SEU_PERIOD_ID' OR period_id IS NULL)
ORDER BY created_at DESC;
```

Se essa query retornar 184 ajustes, mas a API retornar apenas 2, então **o problema está na API ou no cache**.
