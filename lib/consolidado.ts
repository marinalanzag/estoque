import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem, fetchProductDescriptions } from "@/lib/utils";
import { buildEntradasItems } from "@/lib/entradas";
import type { EntradaItem } from "@/lib/entradas";
import type {
  ConsolidatedRow,
  ConsolidadoPorCodigo,
} from "@/types/consolidado";

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

interface AjustesMaps {
  baixasPositivas: Map<string, number>;
  recebidos: Map<string, number>;
}

interface ConsolidadoSummary {
  totalValor: number;
  totalValorEntradas: number;
  totalValorSaidas: number;
  totalQuantidadeFinal: number;
  totalItens: number;
}

interface BuildConsolidadoContext {
  stockImportId: string | null;
  periodId: string | null;
}

interface BuildConsolidadoOptions {
  xmlImportIds?: string[] | null;
}

export interface BuildConsolidadoResult {
  rows: ConsolidatedRow[];
  summary: ConsolidadoSummary;
  porCodigo: Record<string, ConsolidadoPorCodigo>;
  ajustes: {
    baixasPositivas: Record<string, number>;
    recebidos: Record<string, number>;
  };
  context: BuildConsolidadoContext;
}

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

async function fetchEntryAggregates(
  supabaseAdmin: SupabaseAdmin,
  spedFileId: string,
  activePeriodId?: string | null
): Promise<{
  aggregate: Map<
    string,
    { cod_item: string; qty: number; valor: number; descr?: string | null; unid?: string | null }
  >;
}> {
  console.log('[DEBUG CONSOLIDACAO] activePeriodId:', activePeriodId);
  console.log('[DEBUG CONSOLIDACAO] spedFileId:', spedFileId);
  console.log('🚀 [fetchEntryAggregates] Iniciando com buildEntradasItems');

  const entries = await buildEntradasItems(
    supabaseAdmin,
    spedFileId,
    "CONSOLIDACAO"
  );

  const aggregate = new Map<
    string,
    { cod_item: string; qty: number; valor: number; descr?: string | null; unid?: string | null }
  >();

  entries.forEach((entry) => {
    const rawCode = entry.cod_item ?? (entry as any).codItem;
    if (!rawCode) {
      return;
    }

    const codItem = normalizeCodItem(rawCode);
    
    // DEBUG específico para código 842
    if (codItem === "000842" || codItem === "842") {
      console.log(`[fetchEntryAggregates] Entry 842:`, {
        documentItemId: entry.documentItemId,
        cod_item: codItem,
        quantidade_nf: entry.quantidade_nf,
        adjusted_qty: entry.adjusted_qty,
        qtd_produto: entry.qtd_produto,
        custo_total: entry.custo_total,
      });
    }
    
    const qtyUsada =
      entry.adjusted_qty ??
      (entry as any).adjustedQty ??
      entry.qtd_produto ??
      entry.quantidade_nf ??
      0;
    
    // DEBUG específico para código 842 - qtyUsada
    if (codItem === "000842" || codItem === "842") {
      console.log(`[fetchEntryAggregates] Entry 842 - qtyUsada calculada:`, qtyUsada);
    }

    const unitCost =
      entry.custo_unitario ??
      (entry as any).unit_cost ??
      (entry.custo_total !== undefined && qtyUsada
        ? Number(entry.custo_total) / qtyUsada
        : null);

    const valorUsado =
      unitCost !== null ? qtyUsada * unitCost : Number(entry.custo_total ?? 0);

    const atual =
      aggregate.get(codItem) ||
      {
        cod_item: codItem,
        qty: 0,
        valor: 0,
        descr: entry.descr_item ?? null,
        unid: entry.unidade_produto ?? entry.unidade_nf ?? null,
      };

    atual.qty += qtyUsada;
    atual.valor += valorUsado;

    if (!atual.descr && entry.descr_item) {
      atual.descr = entry.descr_item;
    }
    if (!atual.unid && (entry.unidade_produto || entry.unidade_nf)) {
      atual.unid = entry.unidade_produto ?? entry.unidade_nf ?? null;
    }

    aggregate.set(codItem, atual);

    if (codItem === '000842' || codItem === '842') {
      console.log('[DEBUG CONSOLIDACAO ENTRADA 842]', {
        documentItemId: entry.documentItemId ?? (entry as any).document_item_id,
        cod_item: codItem,
        qtd_nf: entry.qtd_nf ?? entry.quantidade_nf ?? null,
        qtd_ajustada: entry.qtd_ajustada ?? null,
        adjusted_qty: entry.adjusted_qty ?? (entry as any).adjustedQty ?? null,
        qtyUsada,
        unitCost,
        valorUsado,
      });
    }
  });

  console.log('✅ [fetchEntryAggregates] Total de códigos agregados:', aggregate.size);
  const debug842 = aggregate.get('000842') ?? aggregate.get('842') ?? null;
  console.log('🔍 [DEBUG FINAL 842]', debug842);
  
  // DEBUG: Mostrar todos os entries do código 842 que foram processados
  const entries842 = entries.filter(e => e.cod_item === '000842' || e.cod_item === '842');
  console.log(`[fetchEntryAggregates] Total de entries 842 processados: ${entries842.length}`);
  entries842.forEach((e, idx) => {
    console.log(`[fetchEntryAggregates] Entry 842 [${idx + 1}]:`, {
      documentItemId: e.documentItemId,
      quantidade_nf: e.quantidade_nf,
      adjusted_qty: e.adjusted_qty,
      qtd_produto: e.qtd_produto,
      qty_usada_esperada: e.adjusted_qty ?? e.quantidade_nf,
    });
  });

  return { aggregate };
}

async function fetchExitAggregates(
  supabaseAdmin: SupabaseAdmin,
  spedFileId: string,
  xmlImportIds?: string[] | null
) {
  
  const aggregate = new Map<
    string,
    { qty: number; valor: number; descr?: string | null; unid?: string | null }
  >();

  let importIds: string[] = [];
  if (xmlImportIds && xmlImportIds.length > 0) {
    importIds = xmlImportIds;
  } else {
    const { data: xmlImports, error: xmlError } = await supabaseAdmin
      .from("xml_sales_imports")
      .select("id")
      .eq("sped_file_id", spedFileId);

    if (xmlError) {
      console.error(
        `[consolidado/fetchExitAggregates] Erro ao buscar importações de XMLs:`,
        xmlError
      );
    }

    if (xmlImports && xmlImports.length > 0) {
      importIds = xmlImports.map((imp) => imp.id);
    }
  }

  if (importIds.length === 0) {
    console.log(
      `[consolidado/fetchExitAggregates] Nenhuma importação de XML encontrada para processar`
    );
    return aggregate;
  }

  console.log(
    `[consolidado/fetchExitAggregates] Importações de XMLs utilizadas: ${importIds.length}`
  );

  // Buscar itens de saída usando xml_import_id (mesma lógica da página de saídas)
  // Isso garante que pegamos todos os itens dos XMLs importados
  const allImportIds = importIds;
  const PAGE_SIZE = 1000;
  const BATCH_SIZE = 50;

  // Buscar em lotes de importações para evitar query muito grande
  let totalItensProcessados = 0;
  for (let i = 0; i < allImportIds.length; i += BATCH_SIZE) {
    const batchIds = allImportIds.slice(i, i + BATCH_SIZE);
    console.log(`[consolidado/fetchExitAggregates] Processando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allImportIds.length / BATCH_SIZE)} (${batchIds.length} importações)`);

    let from = 0;
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabaseAdmin
        .from("document_items")
        .select("cod_item, movement_qty, movement_type, qtd, vl_item, descr_compl, unid")
        .in("xml_import_id", batchIds)
        .eq("movement_type", "saida")
        .range(from, to);

      if (error) {
        console.error(`[consolidado/fetchExitAggregates] Erro ao buscar itens de saída:`, error);
        throw new Error(`Erro ao buscar itens de saída: ${error.message}`);
      }

      const page = data ?? [];
      if (page.length === 0) {
        break;
      }

      totalItensProcessados += page.length;
      console.log(`[consolidado/fetchExitAggregates] Encontrados ${page.length} itens de saída neste chunk (total processado: ${totalItensProcessados})`);

      page.forEach((item: any) => {
        if (!item.cod_item) return;
        // Garantir que só processamos itens de saída
        if (item.movement_type !== "saida") return;
        
        // Normalizar cod_item para garantir agregação correta
        const codItemNormalizado = normalizeCodItem(item.cod_item);
        
        const qty = item.movement_qty !== null
          ? Math.abs(Number(item.movement_qty))
          : Math.abs(item.qtd ?? 0);
        const valor = Number(item.vl_item ?? 0);

        const current = aggregate.get(codItemNormalizado) || {
          qty: 0,
          valor: 0,
          descr: item.descr_compl ?? null,
          unid: item.unid ?? null,
        };

        current.qty += qty;
        current.valor += valor;
        if (!current.descr && item.descr_compl) {
          current.descr = item.descr_compl;
        }
        if (!current.unid && item.unid) {
          current.unid = item.unid;
        }

        aggregate.set(codItemNormalizado, current);
      });

      if (page.length < PAGE_SIZE) {
        break;
      }
      from += PAGE_SIZE;
    }
  }

  console.log(`[consolidado/fetchExitAggregates] Total de itens de saída processados: ${totalItensProcessados}`);
  console.log(`[consolidado/fetchExitAggregates] Total de códigos únicos agregados: ${aggregate.size}`);
  const totalQty = Array.from(aggregate.values()).reduce((acc, item) => acc + item.qty, 0);
  const totalValor = Array.from(aggregate.values()).reduce((acc, item) => acc + item.valor, 0);
  console.log(`[consolidado/fetchExitAggregates] Total de quantidade de saídas: ${totalQty.toFixed(2)}, Total de valor: R$ ${totalValor.toFixed(2)}`);

  return aggregate;
}

async function resolveStockContext(
  supabaseAdmin: SupabaseAdmin,
  periodOrImportId: string | null
): Promise<BuildConsolidadoContext> {
  if (!periodOrImportId) {
    const { data } = await supabaseAdmin
      .from("stock_initial_imports")
      .select("id, period_id")
      .order("created_at", { ascending: false })
      .limit(1);

    return {
      stockImportId: data?.[0]?.id ?? null,
      periodId: data?.[0]?.period_id ?? null,
    };
  }

  const { data: directImport } = await supabaseAdmin
    .from("stock_initial_imports")
    .select("id, period_id")
    .eq("id", periodOrImportId)
    .limit(1);

  if (directImport && directImport.length > 0) {
    return {
      stockImportId: directImport[0].id,
      periodId: directImport[0].period_id ?? null,
    };
  }

  const { data: periodImport } = await supabaseAdmin
    .from("stock_initial_imports")
    .select("id, period_id")
    .eq("period_id", periodOrImportId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (periodImport && periodImport.length > 0) {
    return {
      stockImportId: periodImport[0].id,
      periodId: periodOrImportId,
    };
  }

  const { data: fallback } = await supabaseAdmin
    .from("stock_initial_imports")
    .select("id, period_id")
    .order("created_at", { ascending: false })
    .limit(1);

  return {
    stockImportId: fallback?.[0]?.id ?? null,
    periodId: fallback?.[0]?.period_id ?? null,
  };
}

async function fetchAdjustmentsMaps(
  supabaseAdmin: SupabaseAdmin,
  spedFileId: string
): Promise<AjustesMaps> {
  const baixasPositivas = new Map<string, number>();
  const recebidos = new Map<string, number>();

  const { data: adjustments, error } = await supabaseAdmin
    .from("code_offset_adjustments")
    .select("cod_negativo, cod_positivo, qtd_baixada")
    .eq("sped_file_id", spedFileId);

  if (error) {
    console.error("[consolidado/fetchAdjustmentsMaps] Erro ao buscar ajustes:", error);
    return { baixasPositivas, recebidos };
  }

  (adjustments ?? []).forEach((adj) => {
    const qtd = Number(adj.qtd_baixada ?? 0);
    if (!qtd) return;

    if (adj.cod_positivo) {
      const cod = normalizeCodItem(adj.cod_positivo);
      baixasPositivas.set(cod, (baixasPositivas.get(cod) ?? 0) + qtd);
    }

    if (adj.cod_negativo) {
      const cod = normalizeCodItem(adj.cod_negativo);
      recebidos.set(cod, (recebidos.get(cod) ?? 0) + qtd);
    }
  });

  return { baixasPositivas, recebidos };
}

function mapToObject(map: Map<string, number>): Record<string, number> {
  const obj: Record<string, number> = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

export async function buildConsolidado(
  periodOrImportId: string | null,
  spedFileId: string,
  options?: BuildConsolidadoOptions
): Promise<BuildConsolidadoResult> {
  const supabaseAdmin = getSupabaseAdmin();
  const context = await resolveStockContext(supabaseAdmin, periodOrImportId);

  const stockData =
    context.stockImportId !== null
      ? await fetchAllRows(async (from, to) => {
          const { data, error } = await supabaseAdmin
            .from("stock_initial")
            .select("cod_item, descr_item, qtd, unid, unit_cost")
            .eq("import_id", context.stockImportId)
            .order("cod_item")
            .range(from, to);
          if (error) {
            throw new Error(`Erro ao buscar estoque inicial: ${error.message}`);
          }
          return data ?? [];
        })
      : [];

  const products = await fetchAllRows(async (from, to) => {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("cod_item, descr_item, unid_inv")
      .eq("sped_file_id", spedFileId)
      .order("cod_item")
      .range(from, to);
    if (error) {
      throw new Error(`Erro ao buscar produtos: ${error.message}`);
    }
    return data ?? [];
  });

  const [{ aggregate: entradaAggregates }, saidaAggregates, ajustes] = await Promise.all([
    fetchEntryAggregates(supabaseAdmin, spedFileId, context.periodId),
    fetchExitAggregates(supabaseAdmin, spedFileId, options?.xmlImportIds),
    fetchAdjustmentsMaps(supabaseAdmin, spedFileId),
  ]);

  const productMap = new Map<string, { descr_item?: string | null; unid_inv?: string | null }>();
  products.forEach((prod) => {
    if (prod.cod_item) {
      const codItemNormalizado = normalizeCodItem(prod.cod_item);
      productMap.set(codItemNormalizado, {
        descr_item: prod.descr_item,
        unid_inv: prod.unid_inv,
      });
    }
  });

  const stockMap = new Map<
    string,
    { qty: number; valor: number; descr?: string | null; unid?: string | null }
  >();
  stockData.forEach((item) => {
    if (!item.cod_item) return;
    const codItemNormalizado = normalizeCodItem(item.cod_item);
    const qty = item.qtd ?? 0;
    const valorLinha = (item.unit_cost ?? 0) * qty;
    const current = stockMap.get(codItemNormalizado);
    if (current) {
      current.qty += qty;
      current.valor += valorLinha;
      if (!current.descr && item.descr_item) current.descr = item.descr_item;
      if (!current.unid && item.unid) current.unid = item.unid;
    } else {
      stockMap.set(codItemNormalizado, {
        qty,
        valor: valorLinha,
        descr: item.descr_item,
        unid: item.unid,
      });
    }
  });

  const codigos = new Set<string>([
    ...Array.from(stockMap.keys()),
    ...Array.from(entradaAggregates.keys()),
    ...Array.from(saidaAggregates.keys()),
  ]);

  const codigosArray = Array.from(codigos);
  const codItemsSemDescricao = codigosArray.filter((cod) => {
    const stock = stockMap.get(cod);
    const productInfo = productMap.get(cod);
    return (
      (!stock?.descr || stock.descr.trim() === "") &&
      (!productInfo?.descr_item || productInfo.descr_item.trim() === "")
    );
  });

  let catalogDescriptions = new Map<string, string>();
  if (codItemsSemDescricao.length > 0) {
    catalogDescriptions = await fetchProductDescriptions(supabaseAdmin, codItemsSemDescricao);
  }

  const porCodigo: Record<string, ConsolidadoPorCodigo> = {};

  const rows: ConsolidatedRow[] = codigosArray.map((cod) => {
    const stock = stockMap.get(cod);
    const entradas = entradaAggregates.get(cod);
    const saidas = saidaAggregates.get(cod);
    const productInfo = productMap.get(cod);

    const qtdInicial = stock?.qty ?? 0;
    const valorInicial = stock?.valor ?? 0;
    const qtdEntradas = entradas?.qty ?? 0;
    const valorEntradas = entradas?.valor ?? 0;
    const qtdSaidas = saidas?.qty ?? 0;
    const valorSaidas = saidas?.valor ?? 0;
    const qtdFinal = qtdInicial + qtdEntradas - qtdSaidas;
    const baseQty = qtdInicial + qtdEntradas;
    const custoMedio = baseQty > 0 ? (valorInicial + valorEntradas) / baseQty : null;
    const valorTotal =
      custoMedio !== null
        ? custoMedio * qtdFinal
        : valorInicial + valorEntradas - valorSaidas;

    const descrFromCatalog = catalogDescriptions.get(cod);
    const descr =
      stock?.descr ||
      productInfo?.descr_item ||
      descrFromCatalog ||
      saidas?.descr ||
      (qtdEntradas > 0 ? "(sem cadastro no estoque inicial)" : "[Sem descrição]");

    const unidade =
      stock?.unid ||
      productInfo?.unid_inv ||
      saidas?.unid ||
      (qtdEntradas > 0 ? "UN" : null);

    porCodigo[cod] = {
      cod_item: cod,
      descr_item: descr,
      unidade,
      qtd_inicial: qtdInicial,
      valor_inicial: valorInicial,
      entradas: qtdEntradas,
      valor_entradas: valorEntradas,
      saidas: qtdSaidas,
      qtd_final: qtdFinal,
      custo_medio: custoMedio,
      valor_total: valorTotal,
      valor_saidas: valorSaidas,
    };

    return {
      cod_item: cod,
      descr_item: descr,
      unidade,
      qtd_inicial: qtdInicial,
      valor_inicial: valorInicial,
      entradas: qtdEntradas,
      valor_entradas: valorEntradas,
      saidas: qtdSaidas,
      qtd_final: qtdFinal,
      custo_medio: custoMedio,
      valor_total: valorTotal,
    };
  });

  rows.sort((a, b) => a.cod_item.localeCompare(b.cod_item));

  const summary: ConsolidadoSummary = {
    totalValor: rows.reduce((acc, row) => acc + row.valor_total, 0),
    totalValorEntradas: Array.from(entradaAggregates.values()).reduce(
      (acc, item) => acc + item.valor,
      0
    ),
    totalValorSaidas: Array.from(saidaAggregates.values()).reduce(
      (acc, item) => acc + item.valor,
      0
    ),
    totalQuantidadeFinal: rows.reduce((acc, row) => acc + row.qtd_final, 0),
    totalItens: rows.length,
  };

  return {
    rows,
    summary,
    porCodigo,
    ajustes: {
      baixasPositivas: mapToObject(ajustes.baixasPositivas),
      recebidos: mapToObject(ajustes.recebidos),
    },
    context,
  };
}
