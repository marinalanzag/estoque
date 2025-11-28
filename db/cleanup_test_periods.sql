-- ============================================================================
-- SCRIPT DE LIMPEZA DE PERÍODOS DE TESTE
-- ============================================================================
-- Este script remove períodos de teste e opcionalmente limpa dados relacionados
-- 
-- IMPORTANTE: Execute este script com cuidado! Faça backup antes se necessário.
-- ============================================================================

-- ============================================================================
-- PARTE 1: VISUALIZAR O QUE SERÁ DELETADO (EXECUTAR PRIMEIRO PARA REVISAR)
-- ============================================================================

-- Ver todos os períodos existentes
SELECT 
  id,
  year,
  month,
  name,
  label,
  is_active,
  created_at,
  (SELECT COUNT(*) FROM sped_files WHERE period_id = periods.id) as total_sped_files,
  (SELECT COUNT(*) FROM stock_initial_imports WHERE period_id = periods.id) as total_stock_imports,
  (SELECT COUNT(*) FROM xml_sales_imports WHERE period_id = periods.id) as total_xml_imports,
  (SELECT COUNT(*) FROM code_offset_adjustments WHERE period_id = periods.id) as total_adjustments,
  (SELECT COUNT(*) FROM product_catalog_imports WHERE period_id = periods.id) as total_catalog_imports
FROM periods
ORDER BY year DESC, month DESC;

-- ============================================================================
-- PARTE 2: DELETAR APENAS OS PERÍODOS (DADOS PERMANECEM, MAS PERDEM A REFERÊNCIA)
-- ============================================================================
-- Descomente as linhas abaixo para executar

-- BEGIN;
-- 
-- -- Desativar todos os períodos primeiro (segurança)
-- UPDATE periods SET is_active = false;
-- 
-- -- Deletar todos os períodos
-- -- Como as foreign keys usam "on delete set null", os dados vinculados permanecem
-- DELETE FROM periods;
-- 
-- -- Verificar se todos foram deletados
-- SELECT COUNT(*) as total_periods_restantes FROM periods;
-- 
-- COMMIT;

-- ============================================================================
-- PARTE 3: LIMPEZA COMPLETA (DELETA PERÍODOS + DADOS DE TESTE VINCULADOS)
-- ============================================================================
-- ATENÇÃO: Esta parte deleta TUDO relacionado aos períodos de teste!
-- Use apenas se tiver certeza de que todos os dados são de teste.
-- Descomente as linhas abaixo para executar

-- BEGIN;
-- 
-- -- 1. Desativar todos os períodos
-- UPDATE periods SET is_active = false;
-- 
-- -- 2. Deletar ajustes vinculados aos períodos de teste
-- DELETE FROM code_offset_adjustments WHERE period_id IS NOT NULL;
-- 
-- -- 3. Deletar importações de cadastro de produtos vinculadas
-- DELETE FROM product_catalog_imports WHERE period_id IS NOT NULL;
-- 
-- -- 4. Deletar importações de XMLs vinculadas
-- -- (Isso também deleta os document_items relacionados via cascade)
-- DELETE FROM xml_sales_imports WHERE period_id IS NOT NULL;
-- 
-- -- 5. Deletar importações de estoque inicial vinculadas
-- -- (Isso também deleta os registros de stock_initial relacionados via cascade)
-- DELETE FROM stock_initial_imports WHERE period_id IS NOT NULL;
-- 
-- -- 6. Deletar arquivos SPED vinculados
-- -- (Isso também deleta products, documents, document_items, partners relacionados via cascade)
-- DELETE FROM sped_files WHERE period_id IS NOT NULL;
-- 
-- -- 7. Por fim, deletar os períodos
-- DELETE FROM periods;
-- 
-- -- Verificar limpeza
-- SELECT 
--   (SELECT COUNT(*) FROM periods) as total_periods,
--   (SELECT COUNT(*) FROM sped_files) as total_sped_files,
--   (SELECT COUNT(*) FROM stock_initial_imports) as total_stock_imports,
--   (SELECT COUNT(*) FROM xml_sales_imports) as total_xml_imports,
--   (SELECT COUNT(*) FROM code_offset_adjustments) as total_adjustments,
--   (SELECT COUNT(*) FROM product_catalog_imports) as total_catalog_imports;
-- 
-- COMMIT;

-- ============================================================================
-- PARTE 4: LIMPEZA SELETIVA (DELETAR PERÍODOS ESPECÍFICOS)
-- ============================================================================
-- Use esta parte se quiser deletar apenas períodos específicos
-- Substitua os IDs pelos IDs reais dos períodos que deseja deletar

-- BEGIN;
-- 
-- -- Exemplo: Deletar períodos específicos por ID
-- -- DELETE FROM periods WHERE id IN (
-- --   'uuid-do-periodo-1',
-- --   'uuid-do-periodo-2'
-- -- );
-- 
-- -- Exemplo: Deletar períodos de um ano específico
-- -- DELETE FROM periods WHERE year = 2024;
-- 
-- -- Exemplo: Deletar todos exceto o mais recente
-- -- DELETE FROM periods 
-- -- WHERE id NOT IN (
-- --   SELECT id FROM periods 
-- --   ORDER BY year DESC, month DESC 
-- --   LIMIT 1
-- -- );
-- 
-- COMMIT;

-- ============================================================================
-- VERIFICAÇÃO FINAL (EXECUTAR APÓS A LIMPEZA)
-- ============================================================================

-- Verificar se não há mais períodos
SELECT COUNT(*) as total_periods FROM periods;

-- Verificar dados órfãos (sem período)
SELECT 
  'sped_files' as tabela,
  COUNT(*) as total_sem_periodo
FROM sped_files WHERE period_id IS NULL
UNION ALL
SELECT 
  'stock_initial_imports',
  COUNT(*)
FROM stock_initial_imports WHERE period_id IS NULL
UNION ALL
SELECT 
  'xml_sales_imports',
  COUNT(*)
FROM xml_sales_imports WHERE period_id IS NULL
UNION ALL
SELECT 
  'code_offset_adjustments',
  COUNT(*)
FROM code_offset_adjustments WHERE period_id IS NULL
UNION ALL
SELECT 
  'product_catalog_imports',
  COUNT(*)
FROM product_catalog_imports WHERE period_id IS NULL;



