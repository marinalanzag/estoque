-- ============================================
-- Script para EXCLUIR TODOS os períodos
-- ============================================
-- 
-- ⚠️ ATENÇÃO: Este script irá:
--   - Excluir TODOS os registros da tabela `periods`
--   - As tabelas relacionadas (sped_files, stock_initial_imports, etc.) 
--     terão seu `period_id` setado para NULL automaticamente
--   - NENHUM dado de movimentações, inventário ou outras tabelas será excluído
--
-- ✅ SEGURO: As foreign keys estão configuradas com `on delete set null`,
--    então apenas o vínculo será removido, mas os dados permanecerão intactos
-- ============================================

-- 1. Verificar quantos períodos existem ANTES da exclusão
SELECT 
  COUNT(*) as total_periodos,
  COUNT(*) FILTER (WHERE is_active = true) as periodos_ativos,
  COUNT(*) FILTER (WHERE is_active = false) as periodos_inativos
FROM public.periods;

-- 2. Mostrar lista dos períodos que serão excluídos
SELECT 
  id,
  year,
  month,
  name,
  is_active,
  created_at
FROM public.periods
ORDER BY year DESC, month DESC;

-- 3. Verificar quantos registros têm vínculo com períodos (apenas para informação)
SELECT 
  'sped_files' as tabela,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE period_id IS NOT NULL) as com_period_id
FROM public.sped_files
UNION ALL
SELECT 
  'stock_initial_imports' as tabela,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE period_id IS NOT NULL) as com_period_id
FROM public.stock_initial_imports
UNION ALL
SELECT 
  'xml_sales_imports' as tabela,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE period_id IS NOT NULL) as com_period_id
FROM public.xml_sales_imports
UNION ALL
SELECT 
  'code_offset_adjustments' as tabela,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE period_id IS NOT NULL) as com_period_id
FROM public.code_offset_adjustments
UNION ALL
SELECT 
  'product_catalog_imports' as tabela,
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE period_id IS NOT NULL) as com_period_id
FROM public.product_catalog_imports;

-- ============================================
-- 4. EXCLUIR TODOS OS PERÍODOS
-- ============================================
-- Descomente a linha abaixo para executar a exclusão:
-- DELETE FROM public.periods;

-- ============================================
-- 5. VERIFICAÇÃO APÓS EXCLUSÃO (executar após o DELETE)
-- ============================================

-- Verificar que não há mais períodos
-- SELECT COUNT(*) as periodos_restantes FROM public.periods;
-- Resultado esperado: 0

-- Verificar que os period_id foram setados para NULL (os dados permanecem)
-- SELECT 
--   'sped_files' as tabela,
--   COUNT(*) as total_registros,
--   COUNT(*) FILTER (WHERE period_id IS NULL) as sem_period_id
-- FROM public.sped_files
-- UNION ALL
-- SELECT 
--   'stock_initial_imports' as tabela,
--   COUNT(*) as total_registros,
--   COUNT(*) FILTER (WHERE period_id IS NULL) as sem_period_id
-- FROM public.stock_initial_imports
-- UNION ALL
-- SELECT 
--   'xml_sales_imports' as tabela,
--   COUNT(*) as total_registros,
--   COUNT(*) FILTER (WHERE period_id IS NULL) as sem_period_id
-- FROM public.xml_sales_imports
-- UNION ALL
-- SELECT 
--   'code_offset_adjustments' as tabela,
--   COUNT(*) as total_registros,
--   COUNT(*) FILTER (WHERE period_id IS NULL) as sem_period_id
-- FROM public.code_offset_adjustments
-- UNION ALL
-- SELECT 
--   'product_catalog_imports' as tabela,
--   COUNT(*) as total_registros,
--   COUNT(*) FILTER (WHERE period_id IS NULL) as sem_period_id
-- FROM public.product_catalog_imports;



