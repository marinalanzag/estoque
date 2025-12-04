-- ============================================
-- 🧹 SCRIPT DE EXCLUSÃO DE PERÍODOS DE TESTE
-- ============================================
-- 
-- Este script irá EXCLUIR apenas os períodos de teste.
-- 
-- ✅ SEGURO: 
--   - As tabelas relacionadas (sped_files, stock_initial_imports, etc.) 
--     terão seu `period_id` setado para NULL automaticamente
--   - NENHUM dado de movimentações, inventário ou outras tabelas será excluído
--   - Apenas os registros da tabela `periods` serão removidos
--
-- 📋 ANTES DE EXECUTAR:
--   1. Verifique os períodos que serão excluídos abaixo
--   2. Certifique-se de que realmente quer excluir esses períodos
--   3. Execute este script no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. VERIFICAR PERÍODOS QUE SERÃO EXCLUÍDOS
-- ============================================
-- Mostrar períodos de teste (não ativos e com nomes suspeitos)
SELECT 
  id,
  year || '/' || LPAD(month::text, 2, '0') as periodo,
  name,
  CASE WHEN is_active THEN 'SIM ⚠️' ELSE 'NÃO' END as ativo,
  created_at,
  'SERÁ EXCLUÍDO' as acao
FROM public.periods
WHERE 
  -- Excluir períodos não ativos
  is_active = FALSE
  -- E que sejam claramente de teste (nomes suspeitos ou anos futuros/passados distantes)
  AND (
    name ILIKE '%teste%' 
    OR name ILIKE '%test%'
    OR name = '1'
    OR year > 2025  -- Períodos futuros (2029, etc.)
    OR year < 2020  -- Períodos muito antigos (2021, etc.)
  )
ORDER BY year DESC, month DESC;

-- ============================================
-- 2. VERIFICAR DADOS VINCULADOS AOS PERÍODOS DE TESTE
-- ============================================
-- Ver quantos registros estão vinculados a cada período de teste
SELECT 
  p.id,
  p.year || '/' || LPAD(p.month::text, 2, '0') as periodo,
  p.name,
  COUNT(DISTINCT sf.id) as sped_files,
  COUNT(DISTINCT si.id) as stock_initial_imports,
  COUNT(DISTINCT xs.id) as xml_sales_imports,
  COUNT(DISTINCT co.id) as code_offset_adjustments
FROM public.periods p
LEFT JOIN public.sped_files sf ON sf.period_id = p.id
LEFT JOIN public.stock_initial_imports si ON si.period_id = p.id
LEFT JOIN public.xml_sales_imports xs ON xs.period_id = p.id
LEFT JOIN public.code_offset_adjustments co ON co.period_id = p.id
WHERE 
  p.is_active = FALSE
  AND (
    p.name ILIKE '%teste%' 
    OR p.name ILIKE '%test%'
    OR p.name = '1'
    OR p.year > 2025
    OR p.year < 2020
  )
GROUP BY p.id, p.year, p.month, p.name
ORDER BY p.year DESC, p.month DESC;

-- ============================================
-- 3. EXCLUIR PERÍODOS DE TESTE
-- ============================================
-- ⚠️ DESCOMENTE A LINHA ABAIXO PARA EXECUTAR A EXCLUSÃO ⚠️
-- DELETE FROM public.periods
-- WHERE 
--   is_active = FALSE
--   AND (
--     name ILIKE '%teste%' 
--     OR name ILIKE '%test%'
--     OR name = '1'
--     OR year > 2025
--     OR year < 2020
--   );

-- ============================================
-- 4. VERIFICAÇÃO FINAL (após exclusão)
-- ============================================
-- Verificar períodos restantes
SELECT 
  id,
  year || '/' || LPAD(month::text, 2, '0') as periodo,
  name,
  CASE WHEN is_active THEN 'SIM' ELSE 'NÃO' END as ativo,
  created_at
FROM public.periods
ORDER BY year DESC, month DESC;


