-- ============================================================================
-- VERIFICAÇÃO: Ajustes e seus period_id
-- ============================================================================
-- Esta query verifica todos os ajustes e seus period_id para identificar
-- se há inconsistências que causam o problema de cache

-- ============================================================================
-- QUERY 1: Verificar todos os ajustes com seus period_id
-- ============================================================================
SELECT 
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  period_id,
  sped_file_id,
  created_at,
  CASE 
    WHEN period_id IS NULL THEN '❌ SEM PERÍODO'
    ELSE '✅ COM PERÍODO'
  END as status_periodo
FROM code_offset_adjustments
ORDER BY created_at DESC;

-- ============================================================================
-- QUERY 2: Contar ajustes por period_id
-- ============================================================================
SELECT 
  period_id,
  COUNT(*) as total_ajustes,
  MIN(created_at) as primeiro_ajuste,
  MAX(created_at) as ultimo_ajuste
FROM code_offset_adjustments
GROUP BY period_id
ORDER BY total_ajustes DESC;

-- ============================================================================
-- QUERY 3: Verificar ajustes do período ativo
-- ============================================================================
WITH periodo_ativo AS (
  SELECT id, year, month, label
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
)
SELECT 
  adj.id,
  adj.cod_negativo,
  adj.cod_positivo,
  adj.qtd_baixada,
  adj.period_id,
  adj.sped_file_id,
  adj.created_at,
  pa.id as periodo_ativo_id,
  CASE 
    WHEN adj.period_id = pa.id THEN '✅ PERÍODO ATIVO'
    WHEN adj.period_id IS NULL THEN '⚠️ NULL (será incluído)'
    ELSE '❌ OUTRO PERÍODO'
  END as status
FROM code_offset_adjustments adj
CROSS JOIN periodo_ativo pa
ORDER BY adj.created_at DESC;

-- ============================================================================
-- QUERY 4: Verificar se há ajustes duplicados ou com IDs diferentes
-- ============================================================================
SELECT 
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  COUNT(*) as vezes_repetido,
  STRING_AGG(id::text, ', ') as ids,
  STRING_AGG(period_id::text, ', ') as period_ids,
  MIN(created_at) as primeiro,
  MAX(created_at) as ultimo
FROM code_offset_adjustments
GROUP BY cod_negativo, cod_positivo, qtd_baixada
HAVING COUNT(*) > 1
ORDER BY vezes_repetido DESC;

-- ============================================================================
-- QUERY 5: Verificar ajustes recentes (últimos 10)
-- ============================================================================
SELECT 
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  period_id,
  sped_file_id,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) as segundos_atras
FROM code_offset_adjustments
ORDER BY created_at DESC
LIMIT 10;

