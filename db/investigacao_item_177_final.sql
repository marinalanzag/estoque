-- ============================================================================
-- INVESTIGAÇÃO FINAL: Verificar se os ajustes encontrados são do SPED base
-- ============================================================================

-- ============================================================================
-- QUERY N: Verificar qual é o SPED base e comparar com os ajustes do 177
-- ============================================================================
WITH periodo_ativo AS (
  SELECT id, year, month, label
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
),
sped_base AS (
  SELECT id, name, is_base, period_id
  FROM sped_files 
  WHERE period_id = (SELECT id FROM periodo_ativo)
    AND is_base = true
  LIMIT 1
)
SELECT 
  'SPED BASE' as tipo,
  sb.id as sped_file_id,
  sb.name as sped_name,
  sb.is_base,
  sb.period_id,
  pa.label as periodo_label
FROM sped_base sb
CROSS JOIN periodo_ativo pa

UNION ALL

SELECT 
  'AJUSTES 177' as tipo,
  adj.sped_file_id,
  sf.name as sped_name,
  sf.is_base,
  sf.period_id,
  CASE 
    WHEN adj.sped_file_id = (SELECT id FROM sped_base) THEN '✅ É do SPED base'
    ELSE '❌ NÃO é do SPED base'
  END as status
FROM code_offset_adjustments adj
INNER JOIN sped_files sf ON adj.sped_file_id = sf.id
WHERE 
  adj.cod_negativo IN ('177', '000177', '0177', '00177')
  OR adj.cod_positivo IN ('177', '000177', '0177', '00177');

-- ============================================================================
-- QUERY O: Calcular estoque final usando EXATAMENTE os filtros da API
-- ============================================================================
-- Esta query replica exatamente o que a API faz:
-- 1. Filtra por sped_file_id (SPED base)
-- 2. Filtra por period_id = período ativo OU period_id IS NULL
WITH periodo_ativo AS (
  SELECT id 
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
),
sped_base AS (
  SELECT id 
  FROM sped_files 
  WHERE period_id = (SELECT id FROM periodo_ativo)
    AND is_base = true
  LIMIT 1
)
SELECT 
  '000177' as cod_item,
  'Filtros da API' as tipo,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_recebidos,
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_fornecidos,
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as estoque_final_calculado,
  COUNT(*) as total_ajustes_encontrados,
  (SELECT id FROM sped_base) as sped_file_id_usado,
  (SELECT id FROM periodo_ativo) as period_id_usado
FROM code_offset_adjustments adj
CROSS JOIN periodo_ativo pa
CROSS JOIN sped_base sb
WHERE 
  adj.sped_file_id = sb.id  -- Filtro 1: Apenas SPED base
  AND (adj.period_id = pa.id OR adj.period_id IS NULL)  -- Filtro 2: Período ativo OU null
  AND (
    adj.cod_negativo IN ('177', '000177', '0177', '00177')
    OR adj.cod_positivo IN ('177', '000177', '0177', '00177')
  );

-- ============================================================================
-- QUERY P: Verificar se há ajustes do 177 em OUTROS SPEDs que estão sendo incluídos
-- ============================================================================
WITH periodo_ativo AS (
  SELECT id 
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
),
sped_base AS (
  SELECT id 
  FROM sped_files 
  WHERE period_id = (SELECT id FROM periodo_ativo)
    AND is_base = true
  LIMIT 1
)
SELECT 
  adj.id,
  adj.cod_negativo,
  adj.cod_positivo,
  adj.qtd_baixada,
  adj.period_id,
  adj.sped_file_id,
  sf.name as sped_name,
  CASE 
    WHEN adj.sped_file_id = (SELECT id FROM sped_base) THEN '✅ SPED base'
    ELSE '❌ OUTRO SPED'
  END as status_sped,
  CASE
    WHEN adj.period_id = (SELECT id FROM periodo_ativo) THEN '✅ Período ativo'
    WHEN adj.period_id IS NULL THEN '⚠️ NULL (será incluído pela API)'
    ELSE '❌ Outro período'
  END as status_periodo
FROM code_offset_adjustments adj
INNER JOIN sped_files sf ON adj.sped_file_id = sf.id
CROSS JOIN periodo_ativo pa
WHERE 
  (adj.cod_negativo IN ('177', '000177', '0177', '00177')
   OR adj.cod_positivo IN ('177', '000177', '0177', '00177'))
ORDER BY adj.created_at DESC;

