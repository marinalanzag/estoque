-- ============================================================================
-- CONTINUAÇÃO DA INVESTIGAÇÃO: Item 177 - Verificar SPEDs e Períodos
-- ============================================================================

-- ============================================================================
-- QUERY A: Verificar qual é o SPED base do período ativo
-- ============================================================================
WITH periodo_ativo AS (
  SELECT id, year, month, label
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
)
SELECT 
  'Período Ativo' as tipo,
  pa.id as period_id,
  pa.year,
  pa.month,
  pa.label,
  sf.id as sped_file_id,
  sf.name as sped_name,
  sf.is_base,
  sf.period_id as sped_period_id
FROM periodo_ativo pa
LEFT JOIN sped_files sf ON sf.period_id = pa.id AND sf.is_base = true;

-- ============================================================================
-- QUERY B: Verificar TODOS os SPEDs e seus ajustes relacionados ao 177
-- ============================================================================
SELECT 
  sf.id as sped_file_id,
  sf.name as sped_name,
  sf.period_id as sped_period_id,
  sf.is_base,
  COUNT(DISTINCT adj.id) as total_ajustes_177,
  SUM(CASE WHEN adj.cod_negativo IN ('177', '000177', '0177', '00177') THEN adj.qtd_baixada ELSE 0 END) as total_177_recebeu,
  SUM(CASE WHEN adj.cod_positivo IN ('177', '000177', '0177', '00177') THEN adj.qtd_baixada ELSE 0 END) as total_177_forneceu,
  COUNT(DISTINCT CASE WHEN adj.period_id IS NULL THEN adj.id END) as ajustes_sem_periodo,
  COUNT(DISTINCT CASE WHEN adj.period_id IS NOT NULL THEN adj.id END) as ajustes_com_periodo
FROM sped_files sf
LEFT JOIN code_offset_adjustments adj ON adj.sped_file_id = sf.id
  AND (
    adj.cod_negativo IN ('177', '000177', '0177', '00177')
    OR adj.cod_positivo IN ('177', '000177', '0177', '00177')
  )
GROUP BY sf.id, sf.name, sf.period_id, sf.is_base
HAVING COUNT(DISTINCT adj.id) > 0
ORDER BY total_ajustes_177 DESC;

-- ============================================================================
-- QUERY C: Verificar se os ajustes encontrados são do SPED base ou de outros
-- ============================================================================
WITH periodo_ativo AS (
  SELECT id 
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
),
sped_base AS (
  SELECT id, name
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
  sf.period_id as sped_period_id,
  sf.is_base as sped_is_base,
  CASE 
    WHEN adj.sped_file_id = (SELECT id FROM sped_base) THEN '✅ SPED BASE'
    WHEN adj.sped_file_id IN (SELECT id FROM sped_files WHERE period_id = (SELECT id FROM periodo_ativo)) THEN '⚠️ Outro SPED do período'
    ELSE '❌ SPED de outro período'
  END as status_sped,
  CASE
    WHEN adj.period_id = (SELECT id FROM periodo_ativo) THEN '✅ Período ativo'
    WHEN adj.period_id IS NULL THEN '⚠️ Sem período (antigo)'
    ELSE '❌ Outro período'
  END as status_periodo
FROM code_offset_adjustments adj
INNER JOIN sped_files sf ON adj.sped_file_id = sf.id
CROSS JOIN periodo_ativo pa
WHERE 
  (adj.cod_negativo IN ('177', '000177', '0177', '00177')
   OR adj.cod_positivo IN ('177', '000177', '0177', '00177'))
ORDER BY adj.created_at DESC;

-- ============================================================================
-- QUERY D: Calcular estoque final considerando APENAS o SPED base
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
  '000177' as cod_item,
  'SPED BASE APENAS' as filtro,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_recebidos,
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_fornecidos,
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as estoque_final_calculado,
  COUNT(*) as total_ajustes,
  (SELECT id FROM sped_base) as sped_file_id_usado
FROM code_offset_adjustments adj
CROSS JOIN periodo_ativo pa
CROSS JOIN sped_base sb
WHERE 
  adj.sped_file_id = sb.id
  AND (
    adj.cod_negativo IN ('177', '000177', '0177', '00177')
    OR adj.cod_positivo IN ('177', '000177', '0177', '00177')
  );

-- ============================================================================
-- QUERY E: Calcular estoque final considerando SPED base + ajustes sem período
-- ============================================================================
-- Esta query simula exatamente o que a API faz (inclui period_id IS NULL)
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
  'SPED BASE + period_id NULL' as filtro,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_recebidos,
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_fornecidos,
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as estoque_final_calculado,
  COUNT(*) as total_ajustes,
  (SELECT id FROM sped_base) as sped_file_id_usado,
  (SELECT id FROM periodo_ativo) as period_id_usado
FROM code_offset_adjustments adj
CROSS JOIN periodo_ativo pa
CROSS JOIN sped_base sb
WHERE 
  adj.sped_file_id = sb.id
  AND (adj.period_id = pa.id OR adj.period_id IS NULL)
  AND (
    adj.cod_negativo IN ('177', '000177', '0177', '00177')
    OR adj.cod_positivo IN ('177', '000177', '0177', '00177')
  );

-- ============================================================================
-- QUERY F: Verificar se há ajustes do 177 em OUTROS SPEDs (não base)
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
  sf.is_base,
  sf.period_id as sped_period_id,
  '❌ Este ajuste é de OUTRO SPED (não base)' as problema
FROM code_offset_adjustments adj
INNER JOIN sped_files sf ON adj.sped_file_id = sf.id
CROSS JOIN periodo_ativo pa
CROSS JOIN sped_base sb
WHERE 
  adj.sped_file_id != sb.id  -- Ajustes de SPEDs diferentes do base
  AND (
    adj.cod_negativo IN ('177', '000177', '0177', '00177')
    OR adj.cod_positivo IN ('177', '000177', '0177', '00177')
  )
ORDER BY adj.created_at DESC;

-- ============================================================================
-- QUERY G: Verificar se há ajustes onde 177 é NEGATIVO (recebe quantidade)
-- ============================================================================
-- Esta query é CRÍTICA - pode explicar o saldo de 68.526
SELECT 
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  period_id,
  sped_file_id,
  created_at,
  '177 RECEBE quantidade' as tipo
FROM code_offset_adjustments
WHERE cod_negativo IN ('177', '000177', '0177', '00177')
ORDER BY created_at DESC;

-- ============================================================================
-- QUERY H: Verificar códigos similares que podem estar sendo agrupados
-- ============================================================================
-- Pode haver códigos como "1177", "1771", "00177" que estão sendo normalizados incorretamente
SELECT DISTINCT
  cod_negativo as codigo,
  'NEGATIVO' as tipo,
  COUNT(*) as ocorrencias,
  SUM(qtd_baixada) as total_qtd,
  STRING_AGG(DISTINCT cod_positivo, ', ') as codigos_positivos_relacionados
FROM code_offset_adjustments
WHERE cod_negativo LIKE '%177%'
GROUP BY cod_negativo

UNION ALL

SELECT DISTINCT
  cod_positivo as codigo,
  'POSITIVO' as tipo,
  COUNT(*) as ocorrencias,
  SUM(qtd_baixada) as total_qtd,
  STRING_AGG(DISTINCT cod_negativo, ', ') as codigos_negativos_relacionados
FROM code_offset_adjustments
WHERE cod_positivo LIKE '%177%'
GROUP BY cod_positivo

ORDER BY codigo, tipo;

