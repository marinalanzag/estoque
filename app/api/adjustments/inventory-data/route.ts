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
    } else {
      const { data: periodData } = await supabaseAdmin
        .from("periods")
        .select("id")
        .eq("is_active", true)
        .single();
      activePeriod = periodData || null;
    }

    // Buscar inventário teórico (ou consolidar manualmente)
    // Por enquanto, vamos buscar da VIEW inventory_theoretical se existir
    // ou consolidar manualmente

    // Buscar estoque inicial
    const stockInitial = await fetchAllRows(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from("stock_initial")
        .select("cod_item, qtd, unit_cost, unid")
        .range(from, to);

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

    // Buscar saídas (XMLs)
    const { data: xmlImports } = await supabaseAdmin
      .from("xml_sales_imports")
      .select("id")
      .eq("sped_file_id", spedFileId);

    const exits: any[] = [];
    if (xmlImports && xmlImports.length > 0) {
      const allImportIds = xmlImports.map((imp) => imp.id);
      const BATCH_SIZE = 50;

      for (let i = 0; i < allImportIds.length; i += BATCH_SIZE) {
        const batchIds = allImportIds.slice(i, i + BATCH_SIZE);
        const batchExits = await fetchAllRows(async (from, to) => {
          const { data, error } = await supabaseAdmin
            .from("document_items")
            .select("cod_item, qtd, vl_item, movement_qty")
            .in("xml_import_id", batchIds)
            .eq("movement_type", "saida")
            .range(from, to);

          if (error) throw new Error(`Erro ao buscar saídas: ${error.message}`);
          return data ?? [];
        });
        exits.push(...batchExits);
      }
    }

    // Buscar ajustes já feitos (do arquivo SPED e do período ativo se existir)
    let adjustmentsQuery = supabaseAdmin
      .from("code_offset_adjustments")
      .select("cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value")
      .eq("sped_file_id", spedFileId);

    // Se houver período ativo, filtrar por ele também OU por null (ajustes antigos sem período)
    if (activePeriod) {
      adjustmentsQuery = adjustmentsQuery.or(`period_id.eq.${activePeriod.id},period_id.is.null`);
    }

    const { data: adjustments } = await adjustmentsQuery;

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
    stockInitial.forEach((item) => {
      const codItem = normalizeCodItem(item.cod_item);
      const qtd = Number(item.qtd ?? 0);
      const unitCost = Number(item.unit_cost ?? 0);

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

    // Processar entradas
    entries.forEach((item: any) => {
      const codItem = normalizeCodItem(item.cod_item);
      const adjustedQty = item.document_item_adjustments?.[0]?.adjusted_qty;
      const qtd = adjustedQty !== null && adjustedQty !== undefined
        ? Number(adjustedQty)
        : Math.abs(Number(item.movement_qty ?? item.qtd ?? 0));
      const vlItem = Number(item.vl_item ?? 0);
      const unitCost = qtd > 0 ? vlItem / qtd : 0;

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

    // Processar saídas
    exits.forEach((item: any) => {
      const codItem = normalizeCodItem(item.cod_item);
      const qtd = Math.abs(Number(item.movement_qty ?? item.qtd ?? 0));

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

    // Processar ajustes
    (adjustments ?? []).forEach((adj) => {
      const codNegativo = normalizeCodItem(adj.cod_negativo);
      const codPositivo = normalizeCodItem(adj.cod_positivo);
      const qtdBaixada = Number(adj.qtd_baixada);

      // Ajuste no código negativo (recebe quantidade)
      const negativo = inventory.get(codNegativo);
      if (negativo) {
        negativo.ajustes_recebidos += qtdBaixada;
      } else {
        // Se o código negativo não existe no inventário, criar entrada
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
        positivo.ajustes_fornecidos += qtdBaixada;
      }
    });

    // Calcular estoque final para todos
    inventory.forEach((item) => {
      item.estoque_final = item.estoque_teorico + item.ajustes_recebidos - item.ajustes_fornecidos;
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

