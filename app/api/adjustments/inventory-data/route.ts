import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem, fetchProductDescriptions } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const page = await fetchPage(from, to);
    if (!page.length) break;
    results.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return results;
}

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const spedFileId = searchParams.get("sped_file_id");
    const periodIdParam = searchParams.get("period_id");

    if (!spedFileId) {
      return NextResponse.json(
        { error: "sped_file_id é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar período ativo ou usar period_id da query string
    let activePeriod: { id: string } | null = null;
    
    if (periodIdParam) {
      activePeriod = { id: periodIdParam };
      console.log("[inventory-data] 🔍 Período recebido via query param:", periodIdParam);
    } else {
      const { data: periodData } = await supabaseAdmin
        .from("periods")
        .select("id, label, year, month")
        .eq("is_active", true)
        .single();
      activePeriod = periodData || null;
      if (activePeriod) {
        console.log("[inventory-data] 🔍 Período ativo encontrado no banco:", {
          id: activePeriod.id,
          label: (periodData as any)?.label || `${(periodData as any)?.month}/${(periodData as any)?.year}`,
        });
      } else {
        console.log("[inventory-data] ⚠️ Nenhum período ativo encontrado no banco");
      }
    }

    // Buscar inventário teórico (ou consolidar manualmente)
    // Por enquanto, vamos buscar da VIEW inventory_theoretical se existir
    // ou consolidar manualmente

    // CRÍTICO: Se houver período ativo, buscar apenas o estoque base do período
    // Não usar dados de outros períodos para evitar contaminação
    let stockImportId: string | null = null;
    if (activePeriod) {
      const { getBaseStockImportForPeriod } = await import("@/lib/periods");
      stockImportId = await getBaseStockImportForPeriod(activePeriod.id);
      
      if (!stockImportId) {
        // Se não há estoque base vinculado ao período, retornar erro informativo
        return NextResponse.json({
          error: "PERIODO_SEM_DADOS",
          message: "Este período não possui estoque inicial vinculado. Por favor, importe o estoque inicial na página de configuração do período.",
          period_id: activePeriod.id,
        }, { status: 400 });
      }
    }

    // Buscar estoque inicial (apenas do import_id do período se houver período ativo)
    const stockInitial = await fetchAllRows(async (from, to) => {
      let query = supabaseAdmin
        .from("stock_initial")
        .select("cod_item, qtd, unit_cost, unid")
        .range(from, to);
      
      // CRÍTICO: Filtrar apenas pelo import_id do período base
      if (stockImportId) {
        query = query.eq("import_id", stockImportId);
      }
      // Se não há período ativo, buscar todos (comportamento antigo para compatibilidade)

      const { data, error } = await query;
      if (error) throw new Error(`Erro ao buscar estoque inicial: ${error.message}`);
      return data ?? [];
    });

    // Buscar entradas (ajustadas)
    const entries = await fetchAllRows(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from("document_items")
        .select(
          `
          cod_item,
          qtd,
          vl_item,
          movement_qty,
          document_item_adjustments(adjusted_qty),
          documents!inner(sped_file_id, ind_oper)
          `
        )
        .eq("documents.sped_file_id", spedFileId)
        .eq("movement_type", "entrada")
        .range(from, to);

      if (error) throw new Error(`Erro ao buscar entradas: ${error.message}`);
      return data ?? [];
    });

    // Buscar saídas (XMLs) - CRÍTICO: Filtrar por período se houver período ativo
    // IMPORTANTE: Não usar dados de outros períodos para evitar contaminação
    let xmlImports: any[] = [];
    
    if (activePeriod) {
      // Se houver período ativo, usar APENAS XMLs base do período
      console.log("[inventory-data] 🔍 Buscando XMLs base para período:", activePeriod.id);
      const { getBaseXmlImportsForPeriod } = await import("@/lib/periods");
      const baseXmlImportIds = await getBaseXmlImportsForPeriod(activePeriod.id);
      
      console.log("[inventory-data] 📊 XMLs base retornados pela função:", {
        total: baseXmlImportIds.length,
        ids: baseXmlImportIds.slice(0, 10), // Mostrar primeiros 10 para não poluir o log
      });
      
      if (baseXmlImportIds.length === 0) {
        // Se não há XMLs base vinculados ao período, não usar nenhum XML
        // Isso garante que não há contaminação com dados de outros períodos
        console.warn("[inventory-data] ⚠️ Nenhum XML base encontrado para o período. Não usando XMLs para evitar contaminação.");
        xmlImports = []; // Array vazio - não buscar XMLs
      } else {
        // Buscar apenas XMLs base do período
        const { data: xmlImportsData, error: xmlError } = await supabaseAdmin
          .from("xml_sales_imports")
          .select("id, label, is_base, period_id")
          .in("id", baseXmlImportIds);
        
        if (xmlError) {
          console.error("[inventory-data] ❌ Erro ao buscar XMLs base:", xmlError);
        } else {
          console.log("[inventory-data] ✅ XMLs base encontrados no banco:", {
            total: xmlImportsData?.length || 0,
            detalhes: xmlImportsData?.map(x => ({
              id: x.id.substring(0, 8) + "...",
              label: x.label,
              is_base: x.is_base,
              period_id: x.period_id?.substring(0, 8) + "..." || "null",
            })).slice(0, 5), // Mostrar primeiros 5
          });
        }
        
        xmlImports = xmlImportsData ?? [];
        
        // Verificar se todos os XMLs retornados são realmente base
        const naoBase = xmlImports.filter(x => !x.is_base);
        if (naoBase.length > 0) {
          console.error("[inventory-data] ❌ ERRO CRÍTICO: Encontrados XMLs NÃO-BASE na lista de base!", {
            total_nao_base: naoBase.length,
            detalhes: naoBase.map(x => ({
              id: x.id.substring(0, 8) + "...",
              label: x.label,
              is_base: x.is_base,
            })),
          });
        }
      }
    } else {
      // Se não há período ativo, buscar todos os XMLs do SPED (compatibilidade)
      console.warn("[inventory-data] ⚠️ Nenhum período ativo - buscando TODOS os XMLs do SPED (compatibilidade)");
      const { data: xmlImportsData, error: xmlError } = await supabaseAdmin
        .from("xml_sales_imports")
        .select("id, label, is_base, period_id")
        .eq("sped_file_id", spedFileId);
      
      if (xmlError) {
        console.error("[inventory-data] ❌ Erro ao buscar XMLs do SPED:", xmlError);
      } else {
        console.log("[inventory-data] 📊 Total de XMLs do SPED (sem filtro de período):", {
          total: xmlImportsData?.length || 0,
          base: xmlImportsData?.filter(x => x.is_base).length || 0,
          nao_base: xmlImportsData?.filter(x => !x.is_base).length || 0,
        });
      }
      
      xmlImports = xmlImportsData ?? [];
    }

    const exits: any[] = [];
    if (xmlImports && xmlImports.length > 0) {
      const allImportIds = xmlImports.map((imp) => imp.id);
      console.log("[inventory-data] 🔍 Buscando saídas de XMLs:", {
        total_xmls: allImportIds.length,
        xml_ids: allImportIds.slice(0, 5).map(id => id.substring(0, 8) + "..."), // Primeiros 5
      });
      
      const BATCH_SIZE = 50;

      for (let i = 0; i < allImportIds.length; i += BATCH_SIZE) {
        const batchIds = allImportIds.slice(i, i + BATCH_SIZE);
        console.log(`[inventory-data] 📦 Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allImportIds.length / BATCH_SIZE)} (${batchIds.length} XMLs)`);
        
        const batchExits = await fetchAllRows(async (from, to) => {
          const { data, error } = await supabaseAdmin
            .from("document_items")
            .select("cod_item, qtd, vl_item, movement_qty, xml_import_id")
            .in("xml_import_id", batchIds)
            .eq("movement_type", "saida")
            .range(from, to);

          if (error) throw new Error(`Erro ao buscar saídas: ${error.message}`);
          return data ?? [];
        });
        
        // Log específico para item 011141 neste lote
        const saidas011141 = batchExits.filter(item => {
          const cod = normalizeCodItem(item.cod_item);
          return cod === "011141" || cod === "11141";
        });
        
        if (saidas011141.length > 0) {
          const totalQtd = saidas011141.reduce((sum, item) => {
            return sum + Math.abs(Number(item.movement_qty ?? item.qtd ?? 0));
          }, 0);
          console.log(`[inventory-data] 🔍 Item 011141 - Saídas encontradas neste lote:`, {
            quantidade_itens: saidas011141.length,
            total_qtd: totalQtd.toFixed(2),
            xml_ids_usados: [...new Set(saidas011141.map(s => s.xml_import_id))].slice(0, 3).map(id => id.substring(0, 8) + "..."),
          });
        }
        
        exits.push(...batchExits);
      }
      
      console.log("[inventory-data] 📊 Total de saídas encontradas:", {
        total_registros: exits.length,
        total_xmls_usados: allImportIds.length,
      });
      
      // Log específico para item 011141 - TOTAL
      const todasSaidas011141 = exits.filter(item => {
        const cod = normalizeCodItem(item.cod_item);
        return cod === "011141" || cod === "11141";
      });
      
      if (todasSaidas011141.length > 0) {
        const totalQtd011141 = todasSaidas011141.reduce((sum, item) => {
          return sum + Math.abs(Number(item.movement_qty ?? item.qtd ?? 0));
        }, 0);
        
        // Verificar quais XMLs estão sendo usados para o item 011141
        const xmlIdsUsados = [...new Set(todasSaidas011141.map(s => s.xml_import_id))];
        const xmlsDetalhes = xmlImports.filter(x => xmlIdsUsados.includes(x.id));
        
        console.log(`[inventory-data] 🎯 Item 011141 - RESUMO FINAL DE SAÍDAS:`, {
          total_registros: todasSaidas011141.length,
          total_qtd: totalQtd011141.toFixed(2),
          xmls_utilizados: xmlsDetalhes.map(x => ({
            id: x.id.substring(0, 8) + "...",
            label: x.label,
            is_base: x.is_base,
            period_id: x.period_id?.substring(0, 8) + "..." || "null",
          })),
          xmls_base: xmlsDetalhes.filter(x => x.is_base).length,
          xmls_nao_base: xmlsDetalhes.filter(x => !x.is_base).length,
        });
      } else {
        console.log(`[inventory-data] ℹ️ Item 011141 - Nenhuma saída encontrada`);
      }
    } else {
      console.warn("[inventory-data] ⚠️ Nenhum XML import encontrado - não buscando saídas");
    }

    // Buscar ajustes já feitos (do arquivo SPED e do período ativo se existir)
    let adjustmentsQuery = supabaseAdmin
      .from("code_offset_adjustments")
      .select("cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value, period_id")
      .eq("sped_file_id", spedFileId);

    // Se houver período ativo, filtrar por ele também OU por null (ajustes antigos sem período)
    if (activePeriod) {
      adjustmentsQuery = adjustmentsQuery.or(`period_id.eq.${activePeriod.id},period_id.is.null`);
      console.log("[inventory-data] Filtrando ajustes por período:", activePeriod.id, "ou null");
    } else {
      console.log("[inventory-data] Nenhum período ativo, buscando todos os ajustes do SPED");
    }

    const { data: adjustments } = await adjustmentsQuery;
    
    // DEBUG: Log do sped_file_id e período usado
    console.log("[inventory-data] 🔍 DEBUG - Parâmetros da query:", {
      sped_file_id: spedFileId,
      period_id_param: periodIdParam,
      active_period_id: activePeriod?.id || "null",
      total_ajustes_encontrados: adjustments?.length || 0,
    });
    
    // DEBUG: Log para item 177
    if (adjustments && adjustments.length > 0) {
      const ajustes177 = adjustments.filter(adj => {
        const codNeg = normalizeCodItem(adj.cod_negativo);
        const codPos = normalizeCodItem(adj.cod_positivo);
        return codNeg === "000177" || codPos === "000177";
      });
      
      if (ajustes177.length > 0) {
        console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Ajustes encontrados:", {
          total_ajustes: ajustes177.length,
          sped_file_id_usado: spedFileId,
          ajustes: ajustes177.map(adj => ({
            cod_negativo: adj.cod_negativo,
            cod_positivo: adj.cod_positivo,
            qtd_baixada: adj.qtd_baixada,
            period_id: adj.period_id || "null",
          })),
          soma_recebido: ajustes177
            .filter(adj => normalizeCodItem(adj.cod_negativo) === "000177")
            .reduce((sum, adj) => sum + Number(adj.qtd_baixada), 0),
          soma_fornecido: ajustes177
            .filter(adj => normalizeCodItem(adj.cod_positivo) === "000177")
            .reduce((sum, adj) => sum + Number(adj.qtd_baixada), 0),
        });
      } else {
        console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Nenhum ajuste encontrado para o código 177 no SPED:", spedFileId);
      }
    } else {
      console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Nenhum ajuste encontrado no SPED:", spedFileId);
    }

    // Consolidar por cod_item
    const inventory = new Map<
      string,
      {
        cod_item: string;
        descr_item?: string | null;
        unidade?: string | null;
        estoque_inicial: number;
        entradas: number;
        saidas: number;
        estoque_teorico: number;
        unit_cost: number;
        valor_estoque: number;
        ajustes_recebidos: number; // qtd recebida de códigos positivos
        ajustes_fornecidos: number; // qtd fornecida para códigos negativos
        estoque_final: number; // estoque_teorico + ajustes_recebidos - ajustes_fornecidos
      }
    >();

    // Processar estoque inicial
    let estoqueInicial011141 = 0;
    let totalEstoqueInicial = 0;
    
    stockInitial.forEach((item) => {
      const codItem = normalizeCodItem(item.cod_item);
      const qtd = Number(item.qtd ?? 0);
      const unitCost = Number(item.unit_cost ?? 0);
      
      totalEstoqueInicial += qtd;
      
      // Log específico para item 011141
      if (codItem === "011141") {
        estoqueInicial011141 += qtd;
      }

      inventory.set(codItem, {
        cod_item: codItem,
        unidade: item.unid || null,
        estoque_inicial: qtd,
        entradas: 0,
        saidas: 0,
        estoque_teorico: qtd,
        unit_cost: unitCost,
        valor_estoque: qtd * unitCost,
        ajustes_recebidos: 0,
        ajustes_fornecidos: 0,
        estoque_final: qtd,
      });
    });
    
    console.log("[inventory-data] 📊 Estoque inicial processado:", {
      total_qtd: totalEstoqueInicial.toFixed(2),
      total_registros: stockInitial.length,
      stock_import_id: stockImportId || "null (todos)",
    });
    
    if (estoqueInicial011141 > 0) {
      console.log(`[inventory-data] 🎯 Item 011141 - Estoque inicial: ${estoqueInicial011141.toFixed(2)}`);
    }

    // Processar entradas
    let totalEntradasProcessadas = 0;
    let entradas011141Processadas = 0;
    
    entries.forEach((item: any) => {
      const codItem = normalizeCodItem(item.cod_item);
      const adjustedQty = item.document_item_adjustments?.[0]?.adjusted_qty;
      const qtd = adjustedQty !== null && adjustedQty !== undefined
        ? Number(adjustedQty)
        : Math.abs(Number(item.movement_qty ?? item.qtd ?? 0));
      const vlItem = Number(item.vl_item ?? 0);
      const unitCost = qtd > 0 ? vlItem / qtd : 0;
      
      totalEntradasProcessadas += qtd;
      
      // Log específico para item 011141
      if (codItem === "011141") {
        entradas011141Processadas += qtd;
      }

      const current = inventory.get(codItem);
      if (current) {
        current.entradas += qtd;
        current.estoque_teorico += qtd;
        // Atualizar custo médio ponderado
        const totalQtd = current.estoque_inicial + current.entradas;
        const totalValor = current.valor_estoque + vlItem;
        current.unit_cost = totalQtd > 0 ? totalValor / totalQtd : current.unit_cost;
        current.valor_estoque = totalQtd * current.unit_cost;
      } else {
        inventory.set(codItem, {
          cod_item: codItem,
          unidade: null, // Será preenchido depois com dados do produto
          estoque_inicial: 0,
          entradas: qtd,
          saidas: 0,
          estoque_teorico: qtd,
          unit_cost: unitCost,
          valor_estoque: vlItem,
          ajustes_recebidos: 0,
          ajustes_fornecidos: 0,
          estoque_final: qtd,
        });
      }
    });
    
    console.log("[inventory-data] 📊 Entradas processadas:", {
      total_qtd_processada: totalEntradasProcessadas.toFixed(2),
      total_registros: entries.length,
    });
    
    if (entradas011141Processadas > 0) {
      console.log(`[inventory-data] 🎯 Item 011141 - Entradas processadas: ${entradas011141Processadas.toFixed(2)}`);
    }

    // Processar saídas
    let totalSaidasProcessadas = 0;
    let saidas011141Processadas = 0;
    
    exits.forEach((item: any) => {
      const codItem = normalizeCodItem(item.cod_item);
      const qtd = Math.abs(Number(item.movement_qty ?? item.qtd ?? 0));
      totalSaidasProcessadas += qtd;

      // Log específico para item 011141
      if (codItem === "011141") {
        saidas011141Processadas += qtd;
      }

      const current = inventory.get(codItem);
      if (current) {
        current.saidas += qtd;
        current.estoque_teorico -= qtd;
        current.valor_estoque = current.estoque_teorico * current.unit_cost;
      } else {
        inventory.set(codItem, {
          cod_item: codItem,
          unidade: item.unid || null,
          estoque_inicial: 0,
          entradas: 0,
          saidas: qtd,
          estoque_teorico: -qtd,
          unit_cost: 0,
          valor_estoque: 0,
          ajustes_recebidos: 0,
          ajustes_fornecidos: 0,
          estoque_final: -qtd,
        });
      }
    });
    
    console.log("[inventory-data] 📊 Saídas processadas:", {
      total_qtd_processada: totalSaidasProcessadas.toFixed(2),
      total_registros: exits.length,
    });
    
    if (saidas011141Processadas > 0) {
      console.log(`[inventory-data] 🎯 Item 011141 - Saídas processadas: ${saidas011141Processadas.toFixed(2)}`);
    }

    // Processar ajustes
    (adjustments ?? []).forEach((adj) => {
      const codNegativo = normalizeCodItem(adj.cod_negativo);
      const codPositivo = normalizeCodItem(adj.cod_positivo);
      const qtdBaixada = Number(adj.qtd_baixada);

      // DEBUG: Log detalhado para item 177
      const isItem177 = codNegativo === "000177" || codPositivo === "000177";
      if (isItem177) {
        console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Processando ajuste:", {
          cod_negativo_original: adj.cod_negativo,
          cod_negativo_normalizado: codNegativo,
          cod_positivo_original: adj.cod_positivo,
          cod_positivo_normalizado: codPositivo,
          qtd_baixada: qtdBaixada,
          period_id: adj.period_id || "null",
        });
      }

      // Ajuste no código negativo (recebe quantidade)
      const negativo = inventory.get(codNegativo);
      if (negativo) {
        if (isItem177) {
          console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Antes de somar ajuste recebido:", {
            estoque_teorico: negativo.estoque_teorico,
            ajustes_recebidos_antes: negativo.ajustes_recebidos,
            ajustes_fornecidos: negativo.ajustes_fornecidos,
            estoque_final_antes: negativo.estoque_final,
          });
        }
        negativo.ajustes_recebidos += qtdBaixada;
        if (isItem177) {
          console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Depois de somar ajuste recebido:", {
            ajustes_recebidos_depois: negativo.ajustes_recebidos,
          });
        }
      } else {
        // Se o código negativo não existe no inventário, criar entrada
        if (isItem177) {
          console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Criando novo item no inventory (não existia)");
        }
        inventory.set(codNegativo, {
          cod_item: codNegativo,
          unidade: null, // Será preenchido depois com dados do produto
          estoque_inicial: 0,
          entradas: 0,
          saidas: 0,
          estoque_teorico: 0,
          unit_cost: 0,
          valor_estoque: 0,
          ajustes_recebidos: qtdBaixada,
          ajustes_fornecidos: 0,
          estoque_final: qtdBaixada,
        });
      }

      // Ajuste no código positivo (fornece quantidade)
      const positivo = inventory.get(codPositivo);
      if (positivo) {
        if (isItem177) {
          console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Antes de somar ajuste fornecido:", {
            estoque_teorico: positivo.estoque_teorico,
            ajustes_recebidos: positivo.ajustes_recebidos,
            ajustes_fornecidos_antes: positivo.ajustes_fornecidos,
            estoque_final_antes: positivo.estoque_final,
          });
        }
        positivo.ajustes_fornecidos += qtdBaixada;
        if (isItem177) {
          console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Depois de somar ajuste fornecido:", {
            ajustes_fornecidos_depois: positivo.ajustes_fornecidos,
          });
        }
      } else if (isItem177) {
        console.log("[inventory-data] 🔍 DEBUG ITEM 177 - ⚠️ Item positivo não existe no inventory (não será criado)");
      }
    });

    // Calcular estoque final para todos
    inventory.forEach((item) => {
      const estoqueFinalAnterior = item.estoque_final;
      item.estoque_final = item.estoque_teorico + item.ajustes_recebidos - item.ajustes_fornecidos;
      
      // DEBUG: Log detalhado para item 177
      if (item.cod_item === "000177") {
        console.log("[inventory-data] 🔍 DEBUG ITEM 177 - Cálculo final do estoque:", {
          cod_item: item.cod_item,
          estoque_inicial: item.estoque_inicial,
          entradas: item.entradas,
          saidas: item.saidas,
          estoque_teorico: item.estoque_teorico,
          ajustes_recebidos: item.ajustes_recebidos,
          ajustes_fornecidos: item.ajustes_fornecidos,
          estoque_final_calculado: item.estoque_final,
          formula: `${item.estoque_teorico} + ${item.ajustes_recebidos} - ${item.ajustes_fornecidos} = ${item.estoque_final}`,
        });
      }
      
      // DEBUG: Log detalhado para item 011141
      if (item.cod_item === "011141") {
        console.log("[inventory-data] 🎯 DEBUG ITEM 011141 - Cálculo final do estoque:", {
          cod_item: item.cod_item,
          estoque_inicial: item.estoque_inicial,
          entradas: item.entradas,
          saidas: item.saidas,
          estoque_teorico: item.estoque_teorico,
          ajustes_recebidos: item.ajustes_recebidos,
          ajustes_fornecidos: item.ajustes_fornecidos,
          estoque_final_calculado: item.estoque_final,
          formula: `${item.estoque_teorico} + ${item.ajustes_recebidos} - ${item.ajustes_fornecidos} = ${item.estoque_final}`,
          periodo_usado: activePeriod?.id || "null",
          xmls_base_usados: xmlImports.length,
        });
      }
    });

    // Buscar descrições e unidades dos produtos do SPED
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("cod_item, descr_item, unid_inv")
      .eq("sped_file_id", spedFileId);

    products?.forEach((prod) => {
      const codItem = normalizeCodItem(prod.cod_item);
      const item = inventory.get(codItem);
      if (item) {
        if (prod.descr_item) {
          item.descr_item = prod.descr_item;
        }
        if (prod.unid_inv && !item.unidade) {
          item.unidade = prod.unid_inv;
        }
      }
    });

    // Buscar descrições faltantes no cadastro de produtos (product_catalog)
    const itemsSemDescricao = Array.from(inventory.values())
      .filter((item) => !item.descr_item || item.descr_item.trim() === "");
    
    if (itemsSemDescricao.length > 0) {
      const codItemsSemDescricao = itemsSemDescricao.map((item) => item.cod_item);
      const catalogDescriptions = await fetchProductDescriptions(
        supabaseAdmin,
        codItemsSemDescricao
      );

      catalogDescriptions.forEach((descr, codItem) => {
        const item = inventory.get(codItem);
        if (item && (!item.descr_item || item.descr_item.trim() === "")) {
          item.descr_item = descr;
        }
      });
    }

    // Separar em negativos e positivos
    // IMPORTANTE: Para positivos, mostrar TODOS os itens com estoque_final > 0,
    // não apenas os que têm entradas (Erro 04)
    const negativos = Array.from(inventory.values())
      .filter((item) => item.estoque_final < 0)
      .sort((a, b) => a.estoque_final - b.estoque_final);

    const positivos = Array.from(inventory.values())
      .filter((item) => item.estoque_final > 0) // Mostrar todos com estoque final positivo
      .sort((a, b) => b.estoque_final - a.estoque_final);
    
    // Log final para item 011141
    const item011141 = inventory.get("011141");
    if (item011141) {
      const isNegativo = negativos.find(n => n.cod_item === "011141");
      const isPositivo = positivos.find(p => p.cod_item === "011141");
      
      console.log("[inventory-data] 🎯 Item 011141 - RESULTADO FINAL:", {
        estoque_final: item011141.estoque_final.toFixed(2),
        esta_em_negativos: !!isNegativo,
        esta_em_positivos: !!isPositivo,
        posicao_negativos: isNegativo ? negativos.indexOf(isNegativo) : -1,
        posicao_positivos: isPositivo ? positivos.indexOf(isPositivo) : -1,
      });
    } else {
      console.log("[inventory-data] ℹ️ Item 011141 - Não encontrado no inventário final");
    }

    // Calcular totais de ajustes
    const totalAjustes = (adjustments ?? []).reduce(
      (acc, adj) => acc + Number(adj.total_value),
      0
    );

    return NextResponse.json({
      ok: true,
      negativos,
      positivos,
      total_ajustes: totalAjustes,
      total_negativos: negativos.length,
      total_positivos: positivos.length,
    });
  } catch (error) {
    console.error("Erro ao buscar dados do inventário:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

