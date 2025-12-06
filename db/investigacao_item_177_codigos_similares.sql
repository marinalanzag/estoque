-- ============================================================================
-- INVESTIGAÇÃO: Códigos Similares que podem estar sendo agrupados incorretamente
-- ============================================================================
-- O problema pode ser que códigos como "1177", "1771", "00177" estão sendo
-- normalizados para "000177" incorretamente, ou a API está agrupando códigos diferentes

-- ============================================================================
-- QUERY I: Verificar TODOS os códigos que contêm "177" em qualquer posição
-- ============================================================================
SELECT DISTINCT
  cod_negativo as codigo,
  'NEGATIVO' as tipo,
  COUNT(*) as total_ajustes,
  SUM(qtd_baixada) as total_qtd_baixada,
  MIN(created_at) as primeiro_ajuste,
  MAX(created_at) as ultimo_ajuste
FROM code_offset_adjustments
WHERE cod_negativo LIKE '%177%'
GROUP BY cod_negativo

UNION ALL

SELECT DISTINCT
  cod_positivo as codigo,
  'POSITIVO' as tipo,
  COUNT(*) as total_ajustes,
  SUM(qtd_baixada) as total_qtd_baixada,
  MIN(created_at) as primeiro_ajuste,
  MAX(created_at) as ultimo_ajuste
FROM code_offset_adjustments
WHERE cod_positivo LIKE '%177%'
GROUP BY cod_positivo

ORDER BY codigo, tipo;

-- ============================================================================
-- QUERY J: Verificar se códigos similares estão sendo normalizados incorretamente
-- ============================================================================
-- Esta query mostra os códigos originais e como seriam normalizados
WITH codigos_com_177 AS (
  SELECT DISTINCT cod_negativo as codigo FROM code_offset_adjustments WHERE cod_negativo LIKE '%177%'
  UNION
  SELECT DISTINCT cod_positivo as codigo FROM code_offset_adjustments WHERE cod_positivo LIKE '%177%'
)
SELECT 
  codigo as codigo_original,
  LENGTH(codigo) as tamanho,
  -- Simular normalização (remover não numéricos, preencher zeros)
  LPAD(REGEXP_REPLACE(codigo, '[^0-9]', '', 'g'), 6, '0') as codigo_normalizado_simulado,
  CASE 
    WHEN LPAD(REGEXP_REPLACE(codigo, '[^0-9]', '', 'g'), 6, '0') = '000177' THEN '✅ Seria normalizado para 000177'
    ELSE '❌ NÃO seria normalizado para 000177'
  END as status_normalizacao
FROM codigos_com_177
ORDER BY codigo;

-- ============================================================================
-- QUERY K: Verificar ajustes de códigos que NÃO são 000177 mas contêm 177
-- ============================================================================
-- Esta query mostra ajustes de códigos como "1177", "1771", etc que podem estar
-- sendo incorretamente agrupados com 000177
SELECT 
  adj.id,
  adj.cod_negativo,
  adj.cod_positivo,
  adj.qtd_baixada,
  adj.period_id,
  adj.sped_file_id,
  adj.created_at,
  CASE 
    WHEN adj.cod_negativo LIKE '%177%' AND adj.cod_negativo NOT IN ('177', '000177', '0177', '00177') 
      THEN '⚠️ Código negativo similar (não é 000177)'
    WHEN adj.cod_positivo LIKE '%177%' AND adj.cod_positivo NOT IN ('177', '000177', '0177', '00177')
      THEN '⚠️ Código positivo similar (não é 000177)'
    ELSE '✅ Código exato 000177'
  END as observacao
FROM code_offset_adjustments adj
WHERE 
  (adj.cod_negativo LIKE '%177%' AND adj.cod_negativo NOT IN ('177', '000177', '0177', '00177'))
  OR (adj.cod_positivo LIKE '%177%' AND adj.cod_positivo NOT IN ('177', '000177', '0177', '00177'))
ORDER BY adj.created_at DESC;

-- ============================================================================
-- QUERY L: Soma total de TODOS os códigos que contêm 177 (para comparar com 68.526)
-- ============================================================================
-- Esta query soma TUDO que contém 177, independente de ser exatamente 000177
SELECT 
  'TODOS códigos com 177' as tipo,
  COALESCE(SUM(CASE WHEN cod_negativo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) as total_recebido_todos,
  COALESCE(SUM(CASE WHEN cod_positivo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) as total_fornecido_todos,
  COALESCE(SUM(CASE WHEN cod_negativo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) as diferenca_todos,
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo LIKE '%177%' THEN qtd_baixada ELSE 0 END), 0) as estoque_final_todos,
  COUNT(*) as total_ajustes_encontrados
FROM code_offset_adjustments
WHERE 
  cod_negativo LIKE '%177%' 
  OR cod_positivo LIKE '%177%';

-- ============================================================================
-- QUERY M: Comparar soma de códigos exatos vs códigos similares
-- ============================================================================
SELECT 
  'Códigos EXATOS (177, 000177, 0177, 00177)' as tipo,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as recebido,
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as fornecido,
  COUNT(*) as total_ajustes
FROM code_offset_adjustments
WHERE 
  cod_negativo IN ('177', '000177', '0177', '00177')
  OR cod_positivo IN ('177', '000177', '0177', '00177')

UNION ALL

SELECT 
  'Códigos SIMILARES (contém 177 mas não é exato)' as tipo,
  COALESCE(SUM(CASE WHEN cod_negativo LIKE '%177%' AND cod_negativo NOT IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as recebido,
  COALESCE(SUM(CASE WHEN cod_positivo LIKE '%177%' AND cod_positivo NOT IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as fornecido,
  COUNT(*) as total_ajustes
FROM code_offset_adjustments
WHERE 
  (cod_negativo LIKE '%177%' AND cod_negativo NOT IN ('177', '000177', '0177', '00177'))
  OR (cod_positivo LIKE '%177%' AND cod_positivo NOT IN ('177', '000177', '0177', '00177'));

