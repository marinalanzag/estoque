-- ============================================
-- ⚠️ SCRIPT DE EXCLUSÃO DE TODOS OS PERÍODOS ⚠️
-- ============================================
-- 
-- Este script irá EXCLUIR TODOS os períodos da tabela `periods`.
-- 
-- ✅ SEGURO: 
--   - As tabelas relacionadas (sped_files, stock_initial_imports, etc.) 
--     terão seu `period_id` setado para NULL automaticamente
--   - NENHUM dado de movimentações, inventário ou outras tabelas será excluído
--   - Apenas os registros da tabela `periods` serão removidos
--
-- 📋 ANTES DE EXECUTAR:
--   1. Verifique os períodos que serão excluídos com: db/delete_all_periods.sql
--   2. Certifique-se de que realmente quer excluir todos os períodos
--   3. Execute este script no Supabase SQL Editor
-- ============================================

-- Mostrar períodos que serão excluídos (para confirmação)
SELECT 
  id,
  year || '/' || LPAD(month::text, 2, '0') as periodo,
  name,
  CASE WHEN is_active THEN 'SIM' ELSE 'NÃO' END as ativo,
  created_at
FROM public.periods
ORDER BY year DESC, month DESC;

-- ============================================
-- EXCLUIR TODOS OS PERÍODOS
-- ============================================
DELETE FROM public.periods;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
-- Verificar que todos os períodos foram excluídos
SELECT 
  COUNT(*) as periodos_restantes,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Todos os períodos foram excluídos com sucesso!'
    ELSE '⚠️ Ainda existem períodos no banco: ' || COUNT(*)::text
  END as status
FROM public.periods;



