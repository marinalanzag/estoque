-- ============================================================================
-- INVESTIGAÇÃO: Item 177 com Saldo Irreal (68.526)
-- ============================================================================
-- Este script investiga todos os ajustes relacionados ao código 177
-- Execute no Supabase SQL Editor

-- ============================================================================
-- QUERY 1: Todos os ajustes onde 177 aparece (como negativo ou positivo)
-- ============================================================================
SELECT 
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  unit_cost,
  total_value,
  created_at,
  period_id,
  sped_file_id,
  CASE 
    WHEN cod_negativo LIKE '%177%' THEN 'NEGATIVO'
    WHEN cod_positivo LIKE '%177%' THEN 'POSITIVO'
  END as papel_do_177
FROM code_offset_adjustments
WHERE 
  cod_negativo LIKE '%177%' 
  OR cod_positivo LIKE '%177%'
  OR cod_negativo LIKE '%000177%'
  OR cod_positivo LIKE '%000177%'
ORDER BY created_at DESC;

-- ============================================================================
-- QUERY 2: Resumo - Ajustes onde 177 é código NEGATIVO (recebe quantidade)
-- ============================================================================
SELECT 
  cod_negativo,
  COUNT(*) as total_ajustes,
  SUM(qtd_baixada) as total_recebido,
  MIN(created_at) as primeiro_ajuste,
  MAX(created_at) as ultimo_ajuste,
  period_id,
  sped_file_id
FROM code_offset_adjustments
WHERE cod_negativo IN ('177', '000177', '0177', '00177')
GROUP BY cod_negativo, period_id, sped_file_id
ORDER BY total_recebido DESC;

-- ============================================================================
-- QUERY 3: Resumo - Ajustes onde 177 é código POSITIVO (fornece quantidade)
-- ============================================================================
SELECT 
  cod_positivo,
  COUNT(*) as total_ajustes,
  SUM(qtd_baixada) as total_fornecido,
  MIN(created_at) as primeiro_ajuste,
  MAX(created_at) as ultimo_ajuste,
  period_id,
  sped_file_id
FROM code_offset_adjustments
WHERE cod_positivo IN ('177', '000177', '0177', '00177')
GROUP BY cod_positivo, period_id, sped_file_id
ORDER BY total_fornecido DESC;

-- ============================================================================
-- QUERY 4: Verificar normalização - todas as variações do código 177
-- ============================================================================
SELECT DISTINCT
  cod_negativo as codigo,
  'NEGATIVO' as tipo,
  COUNT(*) as ocorrencias,
  SUM(qtd_baixada) as total_qtd
FROM code_offset_adjustments
WHERE cod_negativo LIKE '%177%'
GROUP BY cod_negativo

UNION ALL

SELECT DISTINCT
  cod_positivo as codigo,
  'POSITIVO' as tipo,
  COUNT(*) as ocorrencias,
  SUM(qtd_baixada) as total_qtd
FROM code_offset_adjustments
WHERE cod_positivo LIKE '%177%'
GROUP BY cod_positivo

ORDER BY codigo, tipo;

-- ============================================================================
-- QUERY 5: Ajustes por período ativo
-- ============================================================================
-- Esta query mostra ajustes do período ativo OU ajustes sem período (null)
-- Para filtrar por um período específico, substitua o SELECT do period_id abaixo
WITH periodo_ativo AS (
  SELECT id 
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
  adj.created_at,
  CASE 
    WHEN adj.cod_negativo IN ('177', '000177', '0177', '00177') THEN '177 é NEGATIVO'
    WHEN adj.cod_positivo IN ('177', '000177', '0177', '00177') THEN '177 é POSITIVO'
  END as papel,
  CASE
    WHEN adj.period_id IS NULL THEN 'Sem período (antigo)'
    WHEN adj.period_id = (SELECT id FROM periodo_ativo) THEN 'Período ativo'
    ELSE 'Outro período'
  END as status_periodo
FROM code_offset_adjustments adj
CROSS JOIN periodo_ativo
WHERE 
  (adj.cod_negativo IN ('177', '000177', '0177', '00177')
   OR adj.cod_positivo IN ('177', '000177', '0177', '00177'))
  AND (adj.period_id = (SELECT id FROM periodo_ativo) OR adj.period_id IS NULL)
ORDER BY adj.created_at DESC;

-- ============================================================================
-- QUERY 5B: Todos os ajustes do 177 (sem filtro de período) - ALTERNATIVA
-- ============================================================================
-- Use esta query se quiser ver TODOS os ajustes, independente do período
SELECT 
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  period_id,
  created_at,
  CASE 
    WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN '177 é NEGATIVO'
    WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN '177 é POSITIVO'
  END as papel
FROM code_offset_adjustments
WHERE 
  cod_negativo IN ('177', '000177', '0177', '00177')
   OR cod_positivo IN ('177', '000177', '0177', '00177')
ORDER BY created_at DESC;

-- ============================================================================
-- QUERY 6: Verificar se há ajustes duplicados ou inconsistentes
-- ============================================================================
SELECT 
  cod_negativo,
  cod_positivo,
  COUNT(*) as vezes_repetido,
  SUM(qtd_baixada) as soma_total,
  MIN(created_at) as primeiro,
  MAX(created_at) as ultimo,
  period_id
FROM code_offset_adjustments
WHERE 
  cod_negativo IN ('177', '000177', '0177', '00177')
  OR cod_positivo IN ('177', '000177', '0177', '00177')
GROUP BY cod_negativo, cod_positivo, period_id
HAVING COUNT(*) > 1
ORDER BY vezes_repetido DESC;

-- ============================================================================
-- QUERY 7: Calcular o que deveria ser o estoque final do 177
-- ============================================================================
-- Esta query simula o cálculo que a API faz (SEM filtro de SPED/Período)
WITH ajustes_177 AS (
  SELECT 
    cod_negativo,
    cod_positivo,
    qtd_baixada,
    period_id,
    sped_file_id
  FROM code_offset_adjustments
  WHERE 
    cod_negativo IN ('177', '000177', '0177', '00177')
    OR cod_positivo IN ('177', '000177', '0177', '00177')
)
SELECT 
  '000177' as cod_item,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_recebidos,
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_fornecidos,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as diferenca_ajustes,
  -- Estoque teórico da consolidação: -1.030,95
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as estoque_final_calculado
FROM ajustes_177;

-- ============================================================================
-- QUERY 7B: Calcular com os MESMOS filtros da API (sped_file_id + period_id)
-- ============================================================================
-- IMPORTANTE: Substitua os valores abaixo pelos valores reais
-- Para encontrar o sped_file_id, execute: SELECT id, name FROM sped_files WHERE name LIKE '%jan2023%';
-- Para encontrar o period_id, execute: SELECT id, year, month FROM periods WHERE is_active = true;
WITH periodo_ativo AS (
  SELECT id 
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
),
sped_base AS (
  -- Substitua pelo sped_file_id correto ou use a query abaixo para encontrar
  SELECT id 
  FROM sped_files 
  WHERE name LIKE '%jan2023%' 
  ORDER BY uploaded_at DESC 
  LIMIT 1
)
SELECT 
  '000177' as cod_item,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_recebidos,
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_fornecidos,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as diferenca_ajustes,
  -- Estoque teórico da consolidação: -1.030,95
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as estoque_final_calculado,
  COUNT(*) as total_ajustes_encontrados
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
-- QUERY 7C: Encontrar o sped_file_id e period_id corretos
-- ============================================================================
SELECT 
  'SPED Files' as tipo,
  id as sped_file_id,
  name as nome,
  uploaded_at,
  period_id
FROM sped_files
WHERE name LIKE '%jan2023%'
ORDER BY uploaded_at DESC;

SELECT 
  'Períodos Ativos' as tipo,
  id as period_id,
  year,
  month,
  is_active,
  label
FROM periods
WHERE is_active = true;

-- ============================================================================
-- QUERY 8: Verificar TODAS as variações possíveis do código 177 (com LIKE)
-- ============================================================================
-- Esta query busca qualquer código que contenha "177" em qualquer posição
-- Pode encontrar códigos como "1177", "1771", "00177", etc.
WITH ajustes_177_like AS (
  SELECT 
    cod_negativo,
    cod_positivo,
    qtd_baixada,
    period_id,
    sped_file_id,
    created_at
  FROM code_offset_adjustments
  WHERE 
    cod_negativo LIKE '%177%'
    OR cod_positivo LIKE '%177%'
)
SELECT 
  '000177' as cod_item,
  COALESCE(SUM(CASE WHEN cod_negativo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) as ajustes_recebidos_like,
  COALESCE(SUM(CASE WHEN cod_positivo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) as ajustes_fornecidos_like,
  COALESCE(SUM(CASE WHEN cod_negativo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) as diferenca_ajustes_like,
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) as estoque_final_calculado_like,
  COUNT(*) as total_ajustes_encontrados
FROM ajustes_177_like;

-- ============================================================================
-- QUERY 9: Detalhar TODOS os ajustes que contêm 177 (para identificar variações)
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
    WHEN cod_negativo LIKE '%177%' THEN 'NEGATIVO'
    WHEN cod_positivo LIKE '%177%' THEN 'POSITIVO'
  END as papel,
  LENGTH(cod_negativo) as len_negativo,
  LENGTH(cod_positivo) as len_positivo
FROM code_offset_adjustments
WHERE 
  cod_negativo LIKE '%177%'
  OR cod_positivo LIKE '%177%'
ORDER BY created_at DESC;

