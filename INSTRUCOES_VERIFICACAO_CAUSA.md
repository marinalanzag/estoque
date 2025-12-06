# Instruções para Verificar a Causa do Problema

## 🔍 Passo 1: Verificar Ajustes no Banco

Execute as queries do arquivo `db/verificar_ajustes_period_id.sql` no Supabase SQL Editor:

### Query 1: Ver todos os ajustes
- Mostra todos os ajustes com seus `period_id`
- Verifique se os 8 novos ajustes têm `period_id` correto
- Verifique se os 2 antigos têm `period_id` diferente ou `null`

### Query 3: Verificar ajustes do período ativo
- Mostra quais ajustes são do período ativo
- Mostra quais têm `period_id = null` (serão incluídos)
- Mostra quais são de outros períodos (não serão incluídos)

## 🔍 Passo 2: Verificar Logs do Servidor

1. Acesse a aba "Ajustes de Códigos"
2. Observe os logs no terminal do servidor
3. Procure por:
   - `[ajustes/page] Filtrando ajustes por período`
   - `[AdjustmentsTable] 🔄 useEffect initialAdjustments`
   - `[AdjustmentsTable] ⚠️ Estado local tem mais ajustes que servidor`

## 🔍 Passo 3: Verificar Cache

1. Crie um novo ajuste
2. Observe nos logs se aparece:
   - `[AdjustmentsTable] ⚠️ Estado local tem mais ajustes que servidor`
3. Se aparecer, significa que o cache está funcionando (preservando ajustes locais)
4. Se não aparecer, o problema pode ser outro

## 📊 O que Procurar

### Se os 8 novos ajustes têm `period_id` diferente:
- **Causa:** Ajustes foram criados com `period_id` incorreto
- **Solução:** Atualizar `period_id` dos ajustes no banco

### Se os 8 novos ajustes têm `period_id = null`:
- **Causa:** Ajustes foram criados quando não havia período ativo
- **Solução:** Atualizar `period_id` dos ajustes para o período ativo

### Se todos têm `period_id` correto mas ainda alternam:
- **Causa:** Cache do Next.js ou timing do banco
- **Solução:** As correções implementadas devem resolver

## 🎯 Próximos Passos

Após verificar as queries, compartilhe os resultados para implementarmos a solução definitiva.

