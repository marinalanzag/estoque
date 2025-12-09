-- ============================================================
-- AUDITORIA DE DADOS ÓRFÃOS (SEM PERIOD_ID)
-- Data: 2025-12-09
-- Objetivo: Identificar registros sem period_id que podem contaminar dados
-- ============================================================

-- ============================================================
-- 1. AJUSTES SEM PERÍODO
-- ============================================================
SELECT
  'AJUSTES' as tabela,
  COUNT(*) as total_orfaos,
  MIN(created_at) as primeiro_registro,
  MAX(created_at) as ultimo_registro
FROM code_offset_adjustments
WHERE period_id IS NULL;

-- Detalhamento dos ajustes órfãos
SELECT
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  total_value,
  created_at,
  created_by,
  sped_file_id
FROM code_offset_adjustments
WHERE period_id IS NULL
ORDER BY created_at DESC;

-- ============================================================
-- 2. SPED FILES SEM PERÍODO
-- ============================================================
SELECT
  'SPED_FILES' as tabela,
  COUNT(*) as total_orfaos,
  MIN(uploaded_at) as primeiro_upload,
  MAX(uploaded_at) as ultimo_upload
FROM sped_files
WHERE period_id IS NULL;

-- Detalhamento dos SPEDs órfãos
SELECT
  id,
  name,
  uploaded_at,
  is_base,
  period_id
FROM sped_files
WHERE period_id IS NULL
ORDER BY uploaded_at DESC;

-- ============================================================
-- 3. XML IMPORTS SEM PERÍODO
-- ============================================================
SELECT
  'XML_IMPORTS' as tabela,
  COUNT(*) as total_orfaos,
  MIN(created_at) as primeiro_import,
  MAX(created_at) as ultimo_import
FROM xml_imports
WHERE period_id IS NULL;

-- Detalhamento dos XMLs órfãos
SELECT
  id,
  label,
  created_at,
  total_xmls,
  total_items,
  sped_file_id,
  period_id
FROM xml_imports
WHERE period_id IS NULL
ORDER BY created_at DESC;

-- ============================================================
-- 4. STOCK IMPORTS SEM PERÍODO
-- ============================================================
SELECT
  'STOCK_IMPORTS' as tabela,
  COUNT(*) as total_orfaos,
  MIN(uploaded_at) as primeiro_upload,
  MAX(uploaded_at) as ultimo_upload
FROM stock_imports
WHERE period_id IS NULL;

-- Detalhamento dos stock imports órfãos
SELECT
  id,
  filename,
  uploaded_at,
  period_id
FROM stock_imports
WHERE period_id IS NULL
ORDER BY uploaded_at DESC;

-- ============================================================
-- 5. RESUMO GERAL
-- ============================================================
SELECT
  'RESUMO GERAL' as tipo,
  (SELECT COUNT(*) FROM code_offset_adjustments WHERE period_id IS NULL) as ajustes_orfaos,
  (SELECT COUNT(*) FROM sped_files WHERE period_id IS NULL) as speds_orfaos,
  (SELECT COUNT(*) FROM xml_imports WHERE period_id IS NULL) as xmls_orfaos,
  (SELECT COUNT(*) FROM stock_imports WHERE period_id IS NULL) as stocks_orfaos;

-- ============================================================
-- 6. PERÍODOS ATIVOS
-- ============================================================
SELECT
  id,
  year,
  month,
  name,
  is_active,
  created_at
FROM periods
ORDER BY year DESC, month DESC;
