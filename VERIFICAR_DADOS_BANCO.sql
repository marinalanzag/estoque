-- VERIFICAÇÃO COMPLETA DOS DADOS NO BANCO
-- Execute estes scripts no SQL Editor do Supabase para entender o que realmente está no banco

-- ========================================
-- 1. VER TODOS OS AJUSTES DO ITEM 011141
-- ========================================
SELECT
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  unit_cost,
  total_value,
  period_id,
  sped_file_id,
  created_at,
  CASE
    WHEN cod_negativo IN ('011141', '11141') THEN '⬇️ RECEBE'
    WHEN cod_positivo IN ('011141', '11141') THEN '⬆️ DOA'
  END as "Tipo"
FROM code_offset_adjustments
WHERE cod_negativo IN ('011141', '11141')
   OR cod_positivo IN ('011141', '11141')
ORDER BY created_at;

-- Espera-se ver APENAS 2 registros:
-- 1. Item 011141 DOA 19 para 004179 (05/12)
-- 2. Item 011141 RECEBE 28 de 013671 (06/12)


-- ========================================
-- 2. VERIFICAR SE HÁ AJUSTES DUPLICADOS
-- ========================================
SELECT
  cod_positivo,
  cod_negativo,
  qtd_baixada,
  COUNT(*) as "Qtd Duplicatas",
  STRING_AGG(id::text, ', ') as "IDs",
  STRING_AGG(created_at::text, ', ') as "Datas Criação"
FROM code_offset_adjustments
WHERE period_id = '6d4abba3-fc54-4946-a248-5e5370693a92'
   OR period_id IS NULL
GROUP BY cod_positivo, cod_negativo, qtd_baixada
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Se retornar VAZIO = ✅ Não há duplicatas no banco
-- Se retornar registros = ❌ Há ajustes duplicados (cache pode ter criado)


-- ========================================
-- 3. VER TODOS OS AJUSTES DO PERÍODO ATIVO
-- ========================================
SELECT
  coa.cod_positivo as "Item Doador",
  coa.cod_negativo as "Item Receptor",
  coa.qtd_baixada as "Quantidade",
  coa.created_at as "Data Criação",
  coa.period_id,
  CASE
    WHEN coa.period_id IS NULL THEN '⚠️ SEM PERÍODO'
    ELSE '✅ COM PERÍODO'
  END as "Status Período"
FROM code_offset_adjustments coa
WHERE coa.period_id = '6d4abba3-fc54-4946-a248-5e5370693a92'
   OR coa.period_id IS NULL
ORDER BY coa.created_at DESC;


-- ========================================
-- 4. CALCULAR TOTAIS DE AJUSTES POR ITEM
-- ========================================
WITH ajustes_recebidos AS (
  SELECT
    cod_negativo as cod_item,
    SUM(qtd_baixada) as total_recebido
  FROM code_offset_adjustments
  WHERE period_id = '6d4abba3-fc54-4946-a248-5e5370693a92'
     OR period_id IS NULL
  GROUP BY cod_negativo
),
ajustes_fornecidos AS (
  SELECT
    cod_positivo as cod_item,
    SUM(qtd_baixada) as total_doado
  FROM code_offset_adjustments
  WHERE period_id = '6d4abba3-fc54-4946-a248-5e5370693a92'
     OR period_id IS NULL
  GROUP BY cod_positivo
)
SELECT
  COALESCE(ar.cod_item, af.cod_item) as "Item",
  COALESCE(ar.total_recebido, 0) as "Total Recebido",
  COALESCE(af.total_doado, 0) as "Total Doado",
  COALESCE(ar.total_recebido, 0) - COALESCE(af.total_doado, 0) as "Saldo (Recebido - Doado)"
FROM ajustes_recebidos ar
FULL OUTER JOIN ajustes_fornecidos af ON ar.cod_item = af.cod_item
ORDER BY "Saldo (Recebido - Doado)" DESC;

-- Para item 011141 deve mostrar:
-- Total Recebido: 28
-- Total Doado: 19
-- Saldo: +9


-- ========================================
-- 5. VERIFICAR ESTOQUE TEÓRICO DO 011141
-- ========================================
WITH periodo AS (
  SELECT id FROM periods WHERE is_active = true LIMIT 1
),
estoque_inicial AS (
  SELECT COALESCE(SUM(si.qtd), 0) as qtd
  FROM stock_initial_imports sii
  INNER JOIN stock_initial si ON si.import_id = sii.id
  INNER JOIN periodo p ON sii.period_id = p.id
  WHERE sii.is_base = true
    AND si.cod_item IN ('011141', '11141')
),
entradas AS (
  SELECT COALESCE(SUM(COALESCE(di.movement_qty, di.qtd)), 0) as qtd
  FROM sped_files sf
  INNER JOIN documents d ON d.sped_file_id = sf.id
  INNER JOIN document_items di ON di.document_id = d.id
  INNER JOIN periodo p ON sf.period_id = p.id
  WHERE sf.is_base = true
    AND di.movement_type = 'entrada'
    AND di.cod_item IN ('011141', '11141')
),
saidas AS (
  SELECT COALESCE(SUM(ABS(COALESCE(di.movement_qty, di.qtd))), 0) as qtd
  FROM xml_sales_imports xsi
  INNER JOIN document_items di ON di.xml_import_id = xsi.id
  INNER JOIN periodo p ON xsi.period_id = p.id
  WHERE xsi.is_base = true
    AND di.movement_type = 'saida'
    AND di.cod_item IN ('011141', '11141')
)
SELECT
  ei.qtd as "Estoque Inicial",
  e.qtd as "Entradas",
  s.qtd as "Saídas",
  (ei.qtd + e.qtd - s.qtd) as "Estoque Teórico",
  28 as "Ajustes Recebidos (esperado)",
  19 as "Ajustes Doados (esperado)",
  (ei.qtd + e.qtd - s.qtd + 28 - 19) as "Estoque Final Esperado"
FROM estoque_inicial ei, entradas e, saidas s;

-- Deve mostrar:
-- Estoque Inicial: 35
-- Entradas: 6
-- Saídas: 12
-- Estoque Teórico: 29
-- Estoque Final Esperado: 38


-- ========================================
-- 6. COMPARAR COM CÁLCULO DA API
-- ========================================
-- Este é o cálculo que a API faz atualmente
-- Se retornar diferente de 38, há problema!

SELECT
  '011141' as "Item",
  29 as "Estoque Teórico (35+6-12)",
  28 as "Ajustes Recebidos",
  19 as "Ajustes Fornecidos",
  (29 + 28 - 19) as "Estoque Final (Fórmula Correta)",
  38 as "Valor Esperado",
  CASE
    WHEN (29 + 28 - 19) = 38 THEN '✅ CORRETO'
    ELSE '❌ ERRO NO CÁLCULO'
  END as "Status";
