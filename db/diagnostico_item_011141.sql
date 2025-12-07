-- ============================================================
-- DIAGNÓSTICO COMPLETO DO ITEM 011141
-- Investigação da discrepância entre Consolidação e Ajustes
-- ============================================================

-- 1. ESTOQUE INICIAL do item 011141
-- Verificar TODOS os estoques iniciais (pode haver múltiplos imports)
SELECT 
    si.id,
    si.cod_item,
    si.qtd,
    si.unit_cost,
    si.unid,
    si.import_id,
    sii.label as import_label,
    sii.period_id,
    sii.is_base,
    sii.created_at as import_created_at
FROM stock_initial si
LEFT JOIN stock_initial_imports sii ON si.import_id = sii.id
WHERE si.cod_item = '011141' OR si.cod_item LIKE '%011141%'
ORDER BY sii.created_at DESC;

-- 2. ENTRADAS do item 011141 no SPED
-- Verificar entradas do SPED (movement_type = 'entrada')
SELECT 
    di.id as document_item_id,
    di.cod_item,
    di.qtd,
    di.movement_qty,
    di.movement_type,
    di.vl_item,
    d.sped_file_id,
    sf.name as sped_name,
    d.ind_oper,
    d.num_doc,
    d.dt_doc,
    adj.adjusted_qty,
    CASE 
        WHEN adj.adjusted_qty IS NOT NULL THEN adj.adjusted_qty
        ELSE ABS(COALESCE(di.movement_qty, di.qtd, 0))
    END as qtd_final_usada
FROM document_items di
INNER JOIN documents d ON di.document_id = d.id
LEFT JOIN sped_files sf ON d.sped_file_id = sf.id
LEFT JOIN document_item_adjustments adj ON di.id = adj.document_item_id
WHERE (di.cod_item = '011141' OR di.cod_item LIKE '%011141%')
  AND (di.movement_type = 'entrada' OR (di.movement_type IS NULL AND d.ind_oper = '0'))
ORDER BY d.dt_doc DESC;

-- 3. SAÍDAS do item 011141 (XMLs)
-- Verificar saídas de TODOS os XMLs (pode haver múltiplos imports)
SELECT 
    di.id as document_item_id,
    di.cod_item,
    di.qtd,
    di.movement_qty,
    di.movement_type,
    di.vl_item,
    di.xml_import_id,
    xsi.label as xml_import_label,
    xsi.period_id,
    xsi.is_base,
    xsi.created_at as xml_import_created_at,
    ABS(COALESCE(di.movement_qty, di.qtd, 0)) as qtd_saida
FROM document_items di
LEFT JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE (di.cod_item = '011141' OR di.cod_item LIKE '%011141%')
  AND di.movement_type = 'saida'
ORDER BY xsi.created_at DESC, di.id;

-- 4. RESUMO POR XML IMPORT
-- Ver quantas saídas existem em cada import de XML
SELECT 
    xsi.id as xml_import_id,
    xsi.label,
    xsi.period_id,
    xsi.is_base,
    xsi.created_at,
    COUNT(DISTINCT di.id) as total_saidas,
    SUM(ABS(COALESCE(di.movement_qty, di.qtd, 0))) as total_qtd_saida
FROM document_items di
INNER JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE (di.cod_item = '011141' OR di.cod_item LIKE '%011141%')
  AND di.movement_type = 'saida'
GROUP BY xsi.id, xsi.label, xsi.period_id, xsi.is_base, xsi.created_at
ORDER BY xsi.created_at DESC;

-- 5. AJUSTES já feitos para o item 011141
-- Verificar ajustes onde 011141 é negativo OU positivo
SELECT 
    coa.id,
    coa.cod_negativo,
    coa.cod_positivo,
    coa.qtd_baixada,
    coa.unit_cost,
    coa.total_value,
    coa.sped_file_id,
    coa.period_id,
    coa.created_at,
    sf.name as sped_name,
    p.label as period_label
FROM code_offset_adjustments coa
LEFT JOIN sped_files sf ON coa.sped_file_id = sf.id
LEFT JOIN periods p ON coa.period_id = p.id
WHERE coa.cod_negativo = '011141' 
   OR coa.cod_negativo LIKE '%011141%'
   OR coa.cod_positivo = '011141'
   OR coa.cod_positivo LIKE '%011141%'
ORDER BY coa.created_at DESC;

-- 6. CÁLCULO SIMULADO - Como a CONSOLIDAÇÃO calcula
-- (usando buildConsolidado)
WITH estoque_inicial AS (
    SELECT 
        si.cod_item,
        SUM(si.qtd) as qtd_inicial,
        SUM(si.qtd * COALESCE(si.unit_cost, 0)) as valor_inicial
    FROM stock_initial si
    INNER JOIN stock_initial_imports sii ON si.import_id = sii.id
    WHERE si.cod_item = '011141'
      AND sii.is_base = true  -- Apenas estoque base
    GROUP BY si.cod_item
),
entradas AS (
    SELECT 
        di.cod_item,
        SUM(
            CASE 
                WHEN adj.adjusted_qty IS NOT NULL THEN adj.adjusted_qty
                ELSE ABS(COALESCE(di.movement_qty, di.qtd, 0))
            END
        ) as qtd_entradas,
        SUM(COALESCE(di.vl_item, 0)) as valor_entradas
    FROM document_items di
    INNER JOIN documents d ON di.document_id = d.id
    LEFT JOIN document_item_adjustments adj ON di.id = adj.document_item_id
    WHERE di.cod_item = '011141'
      AND (di.movement_type = 'entrada' OR (di.movement_type IS NULL AND d.ind_oper = '0'))
    GROUP BY di.cod_item
),
saidas AS (
    SELECT 
        di.cod_item,
        SUM(ABS(COALESCE(di.movement_qty, di.qtd, 0))) as qtd_saidas,
        SUM(COALESCE(di.vl_item, 0)) as valor_saidas
    FROM document_items di
    INNER JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
    WHERE di.cod_item = '011141'
      AND di.movement_type = 'saida'
      AND xsi.is_base = true  -- Apenas XMLs base
    GROUP BY di.cod_item
)
SELECT 
    COALESCE(ei.cod_item, e.cod_item, s.cod_item) as cod_item,
    COALESCE(ei.qtd_inicial, 0) as estoque_inicial,
    COALESCE(e.qtd_entradas, 0) as entradas,
    COALESCE(s.qtd_saidas, 0) as saidas,
    COALESCE(ei.qtd_inicial, 0) + COALESCE(e.qtd_entradas, 0) - COALESCE(s.qtd_saidas, 0) as estoque_teorico_consolidacao
FROM estoque_inicial ei
FULL OUTER JOIN entradas e ON ei.cod_item = e.cod_item
FULL OUTER JOIN saidas s ON COALESCE(ei.cod_item, e.cod_item) = s.cod_item;

-- 7. CÁLCULO SIMULADO - Como a API DE AJUSTES calcula
-- (usando inventory-data route)
WITH estoque_inicial_ajustes AS (
    SELECT 
        si.cod_item,
        SUM(si.qtd) as qtd_inicial
    FROM stock_initial si
    INNER JOIN stock_initial_imports sii ON si.import_id = sii.id
    WHERE si.cod_item = '011141'
      AND sii.is_base = true  -- Estoque base do período
    GROUP BY si.cod_item
),
entradas_ajustes AS (
    SELECT 
        di.cod_item,
        SUM(
            CASE 
                WHEN adj.adjusted_qty IS NOT NULL THEN adj.adjusted_qty
                ELSE ABS(COALESCE(di.movement_qty, di.qtd, 0))
            END
        ) as qtd_entradas
    FROM document_items di
    INNER JOIN documents d ON di.document_id = d.id
    LEFT JOIN document_item_adjustments adj ON di.id = adj.document_item_id
    WHERE di.cod_item = '011141'
      AND di.movement_type = 'entrada'
      AND d.sped_file_id IS NOT NULL
    GROUP BY di.cod_item
),
saidas_ajustes AS (
    SELECT 
        di.cod_item,
        SUM(ABS(COALESCE(di.movement_qty, di.qtd, 0))) as qtd_saidas
    FROM document_items di
    INNER JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
    WHERE di.cod_item = '011141'
      AND di.movement_type = 'saida'
      AND xsi.is_base = true  -- XMLs base do período
    GROUP BY di.cod_item
),
ajustes_recebidos AS (
    SELECT 
        cod_negativo as cod_item,
        SUM(qtd_baixada) as total_recebido
    FROM code_offset_adjustments
    WHERE cod_negativo = '011141'
    GROUP BY cod_negativo
),
ajustes_fornecidos AS (
    SELECT 
        cod_positivo as cod_item,
        SUM(qtd_baixada) as total_fornecido
    FROM code_offset_adjustments
    WHERE cod_positivo = '011141'
    GROUP BY cod_positivo
)
SELECT 
    COALESCE(ei.cod_item, e.cod_item, s.cod_item) as cod_item,
    COALESCE(ei.qtd_inicial, 0) as estoque_inicial,
    COALESCE(e.qtd_entradas, 0) as entradas,
    COALESCE(s.qtd_saidas, 0) as saidas,
    COALESCE(ei.qtd_inicial, 0) + COALESCE(e.qtd_entradas, 0) - COALESCE(s.qtd_saidas, 0) as estoque_teorico,
    COALESCE(ar.total_recebido, 0) as ajustes_recebidos,
    COALESCE(af.total_fornecido, 0) as ajustes_fornecidos,
    COALESCE(ei.qtd_inicial, 0) + COALESCE(e.qtd_entradas, 0) - COALESCE(s.qtd_saidas, 0) 
        + COALESCE(ar.total_recebido, 0) - COALESCE(af.total_fornecido, 0) as estoque_final_ajustes
FROM estoque_inicial_ajustes ei
FULL OUTER JOIN entradas_ajustes e ON ei.cod_item = e.cod_item
FULL OUTER JOIN saidas_ajustes s ON COALESCE(ei.cod_item, e.cod_item) = s.cod_item
LEFT JOIN ajustes_recebidos ar ON COALESCE(ei.cod_item, e.cod_item, s.cod_item) = ar.cod_item
LEFT JOIN ajustes_fornecidos af ON COALESCE(ei.cod_item, e.cod_item, s.cod_item) = af.cod_item;

-- 8. VERIFICAR PERÍODOS E BASES
-- Ver quais períodos existem e quais são bases
SELECT 
    p.id,
    p.label,
    p.year,
    p.month,
    p.is_active,
    (SELECT COUNT(*) FROM stock_initial_imports WHERE period_id = p.id AND is_base = true) as estoques_base,
    (SELECT COUNT(*) FROM xml_sales_imports WHERE period_id = p.id AND is_base = true) as xmls_base,
    (SELECT COUNT(*) FROM sped_files WHERE period_id = p.id AND is_base = true) as speds_base
FROM periods p
ORDER BY p.year DESC, p.month DESC;

-- 9. VERIFICAR SE HÁ XMLs NÃO-BASE sendo usados
-- Ver todos os XMLs que têm saídas do item 011141
SELECT 
    xsi.id,
    xsi.label,
    xsi.period_id,
    xsi.is_base,
    xsi.sped_file_id,
    COUNT(DISTINCT di.id) as total_saidas_item,
    SUM(ABS(COALESCE(di.movement_qty, di.qtd, 0))) as total_qtd
FROM xml_sales_imports xsi
INNER JOIN document_items di ON di.xml_import_id = xsi.id
WHERE (di.cod_item = '011141' OR di.cod_item LIKE '%011141%')
  AND di.movement_type = 'saida'
GROUP BY xsi.id, xsi.label, xsi.period_id, xsi.is_base, xsi.sped_file_id
ORDER BY xsi.created_at DESC;

