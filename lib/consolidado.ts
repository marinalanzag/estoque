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
  // Logs de debug focados em ENTRADAS (conforme solicitado)
  console.log("[fetchEntryAggregates] periodId:", activePeriodId);
  console.log("[fetchEntryAggregates] spedFileId inicial:", spedFileId);
  
  // Verificar se há SPED base para o período
  let spedBaseId: string | null = null;
  if (activePeriodId) {
    const { getBaseSpedFileForPeriod } = await import("@/lib/periods");
    spedBaseId = await getBaseSpedFileForPeriod(activePeriodId);
    console.log("[fetchEntryAggregates] spedBaseId encontrado:", spedBaseId);
    
    // Se há SPED base e o spedFileId passado não é o base, usar o base
    if (spedBaseId && spedFileId !== spedBaseId) {
      console.error("[fetchEntryAggregates] ⚠️ ERRO: spedFileId passado não é o base! Corrigindo...");
      console.error("[fetchEntryAggregates] spedFileId passado:", spedFileId);
      console.error("[fetchEntryAggregates] spedBaseId correto:", spedBaseId);
      spedFileId = spedBaseId;
    } else if (!spedBaseId) {
      console.warn("[fetchEntryAggregates] ⚠️ AVISO: Há período ativo mas não há SPED base definido!");
    }
  } else {
    console.warn("[fetchEntryAggregates] ⚠️ AVISO: Nenhum período ativo, usando spedFileId passado:", spedFileId);
  }
  
  console.log('🚀 [fetchEntryAggregates] Iniciando buildEntradasItems com spedFileId:', spedFileId);
  console.log('🚀 [fetchEntryAggregates] Passando activePeriodId para buildEntradasItems:', activePeriodId);
  
  const entries = await buildEntradasItems(
    supabaseAdmin,
    spedFileId,
    "CONSOLIDACAO",
    activePeriodId || null
  );
  
  console.log("[fetchEntryAggregates] totalEntriesAposDeduplicacao:", entries.length);
  
  // DEBUG: Verificar se há entries com código 002064
  const entries2064 = entries.filter(e => {
    const cod = e.cod_item || "";
    return cod === "002064" || cod === "2064" || cod.includes("2064") || cod.includes("002064");
  });
  console.log(`[fetchEntryAggregates] Entries com código relacionado a 2064: ${entries2064.length}`);
  if (entries2064.length > 0) {
    entries2064.forEach((e, idx) => {
      console.log(`[fetchEntryAggregates] Entry 2064 [${idx + 1}]:`, {
        cod_item: e.cod_item,
        documentItemId: e.documentItemId,
        quantidade_nf: e.quantidade_nf,
        adjusted_qty: e.adjusted_qty,
        qtd_produto: e.qtd_produto,
        custo_total: e.custo_total,
      });
    });
  } else {
    console.error(`[fetchEntryAggregates] ⚠️ Nenhum entry com código 002064 encontrado!`);
    // Verificar se há códigos similares
    const codigosSimilares = entries
      .map(e => e.cod_item)
      .filter(cod => cod && (cod.includes("2064") || cod.includes("002064")))
      .slice(0, 10);
    if (codigosSimilares.length > 0) {
      console.error(`[fetchEntryAggregates] Códigos similares encontrados nos entries:`, codigosSimilares);
    }
  }

  const aggregate = new Map<
    string,
    { cod_item: string; qty: number; valor: number; descr?: string | null; unid?: string | null }
  >();

  // Verificar duplicatas por documentItemId antes de agregar
  const documentItemIdsProcessados = new Set<string>();
  const duplicatasEncontradas: string[] = [];
  
  entries.forEach((entry) => {
    if (entry.documentItemId) {
      if (documentItemIdsProcessados.has(entry.documentItemId)) {
        duplicatasEncontradas.push(entry.documentItemId);
        console.error(`[fetchEntryAggregates] ⚠️ DUPLICATA DETECTADA na agregação: documentItemId ${entry.documentItemId}, cod_item: ${entry.cod_item}`);
      } else {
        documentItemIdsProcessados.add(entry.documentItemId);
      }
    }
  });
  
  if (duplicatasEncontradas.length > 0) {
    console.error(`[fetchEntryAggregates] ⚠️ ERRO CRÍTICO: ${duplicatasEncontradas.length} duplicatas encontradas na agregação!`);
    console.error(`[fetchEntryAggregates] IDs duplicados:`, duplicatasEncontradas);
  }
  
  entries.forEach((entry) => {
    const rawCode = entry.cod_item ?? (entry as any).codItem;
    if (!rawCode) {
      return;
    }

    const codItem = normalizeCodItem(rawCode);
    
    // CRÍTICO: Para quantidade, SEMPRE usar qtd_produto, pois ele já considera:
    // 1. adjusted_qty se existir (senão usa quantidade_nf) - ver buildEntradasItems linha 798-800
    // 2. Conversão de unidade se houver (fat_conv) - ver buildEntradasItems linha 833-836
    // qtd_produto é a fonte da verdade para a quantidade final a ser usada na consolidação
    // IMPORTANTE: Não usar adjusted_qty diretamente aqui, pois ignoraria conversões de unidade
    // DECLARAR ANTES dos logs de debug para evitar erro de referência
    const qtyUsada = entry.qtd_produto ?? entry.quantidade_nf ?? 0;
    
    // DEBUG específico para código 002064
    if (codItem === "002064" || rawCode === "002064" || rawCode === "2064" || String(rawCode).includes("2064")) {
      console.log(`[fetchEntryAggregates] ✅ Entry 002064 encontrado na agregação:`, {
        rawCode,
        codItemNormalizado: codItem,
        documentItemId: entry.documentItemId,
        quantidade_nf: entry.quantidade_nf,
        adjusted_qty: entry.adjusted_qty,
        qtd_produto: entry.qtd_produto,
        qtyUsada,
        custo_total: entry.custo_total,
        descr_item: entry.descr_item,
      });
    }
    
    // DEBUG específico para código 842 e 004616
    if (codItem === "000842" || codItem === "842" || codItem === "004616" || codItem === "4616") {
      console.log(`[fetchEntryAggregates] Entry ${codItem}:`, {
        documentItemId: entry.documentItemId,
        cod_item: codItem,
        quantidade_nf: entry.quantidade_nf,
        adjusted_qty: entry.adjusted_qty,
        qtd_produto: entry.qtd_produto,
        custo_total: entry.custo_total,
      });
    }
    
    // DEBUG específico para código 842 e 004616 - qtyUsada
    if (codItem === "000842" || codItem === "842" || codItem === "004616" || codItem === "4616") {
      console.log(`[fetchEntryAggregates] Entry ${codItem} - qtyUsada calculada:`, qtyUsada);
    }

    // CRÍTICO: Para valor, SEMPRE usar o custo_total original da NF
    // NÃO multiplicar pela quantidade convertida, pois o valor da NF já está correto
    // Se há conversão de unidade, o valor total da NF não muda, apenas a quantidade
    const valorUsado = Number(entry.custo_total ?? 0);
    
    // Calcular custo unitário baseado na quantidade usada (convertida se houver)
    const unitCost = qtyUsada > 0 ? valorUsado / qtyUsada : null;
    
    // DEBUG específico para código 842 e 004616 - valor
    if (codItem === "000842" || codItem === "842" || codItem === "004616" || codItem === "4616") {
      console.log(`[fetchEntryAggregates] Entry ${codItem} - VALOR:`, {
        custo_total_original: entry.custo_total,
        custo_unitario_entry: entry.custo_unitario,
        quantidade_nf: entry.quantidade_nf,
        qtd_produto: entry.qtd_produto,
        qtyUsada,
        valorUsado,
        unitCost,
      });
    }

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

    if (codItem === '000842' || codItem === '842' || codItem === '004616' || codItem === '4616') {
      console.log(`[DEBUG CONSOLIDACAO ENTRADA ${codItem}]`, {
        documentItemId: entry.documentItemId ?? (entry as any).document_item_id,
        cod_item: codItem,
        quantidade_nf: entry.quantidade_nf ?? null,
        qtd_produto: entry.qtd_produto ?? null,
        adjusted_qty: entry.adjusted_qty ?? (entry as any).adjustedQty ?? null,
        qtyUsada,
        unitCost,
        valorUsado,
        qtyAcumulada: atual.qty,
        valorAcumulado: atual.valor,
      });
    }
  });

  console.log('✅ [fetchEntryAggregates] Total de códigos agregados:', aggregate.size);
  
  // DEBUG: Verificar se 002064 está no agregado
  const debug2064 = aggregate.get('002064') ?? null;
  if (debug2064) {
    console.log('🔍 [DEBUG FINAL 002064] ✅ Item encontrado no agregado:', debug2064);
  } else {
    console.error('⚠️ [DEBUG FINAL 002064] ❌ Item NÃO encontrado no agregado de entradas!');
    // Verificar se há algum código similar
    const codigosSimilares = Array.from(aggregate.keys()).filter(c => c.includes("2064") || c.includes("002064"));
    if (codigosSimilares.length > 0) {
      console.error('  - Códigos similares encontrados no agregado:', codigosSimilares);
    } else {
      console.error('  - Nenhum código similar encontrado no agregado!');
      // Listar alguns códigos de exemplo do agregado para debug
      const primeirosCodigos = Array.from(aggregate.keys()).slice(0, 20);
      console.error('  - Primeiros 20 códigos do agregado:', primeirosCodigos);
    }
    
    // Verificar todos os códigos únicos dos entries (antes da normalização)
    const codigosUnicosEntries = Array.from(new Set(entries.map(e => e.cod_item).filter(Boolean)));
    const codigos2064Entries = codigosUnicosEntries.filter(c => c && (c.includes("2064") || c.includes("002064")));
    console.error('  - Códigos relacionados a 2064 nos entries (antes normalização):', codigos2064Entries);
    if (codigos2064Entries.length === 0) {
      console.error('  - ⚠️ Nenhum código relacionado a 2064 encontrado nos entries!');
    }
  }
  
  const debug842 = aggregate.get('000842') ?? aggregate.get('842') ?? null;
  console.log('🔍 [DEBUG FINAL 842]', debug842);
  
  // DEBUG: Mostrar todos os entries do código 842 que foram processados
  const entries842 = entries.filter(e => e.cod_item === '000842' || e.cod_item === '842');
  console.log(`[fetchEntryAggregates] Total de entries 842 processados: ${entries842.length}`);
  
  // DEBUG: Mostrar agregação do código 004616
  const debug4616 = aggregate.get('004616') ?? aggregate.get('4616') ?? null;
  if (debug4616) {
    console.log('🔍 [DEBUG FINAL 004616]', debug4616);
    const entries4616 = entries.filter(e => {
      const cod = normalizeCodItem(e.cod_item ?? '');
      return cod === '004616' || cod === '4616';
    });
    console.log(`[fetchEntryAggregates] Total de entries 004616 processados: ${entries4616.length}`);
    entries4616.forEach((e, idx) => {
      console.log(`[fetchEntryAggregates] Entry 004616 [${idx + 1}]:`, {
        documentItemId: e.documentItemId,
        quantidade_nf: e.quantidade_nf,
        adjusted_qty: e.adjusted_qty,
        qtd_produto: e.qtd_produto,
      });
    });
  }
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
  // Se periodOrImportId é um period_id, buscar o estoque BASE do período
  if (periodOrImportId) {
    // Primeiro, verificar se é um period_id (UUID) ou import_id
    // Se for period_id, buscar estoque base
    const { getBaseStockImportForPeriod } = await import("@/lib/periods");
    const baseStockId = await getBaseStockImportForPeriod(periodOrImportId);
    
    if (baseStockId) {
      console.log("[resolveStockContext] Usando estoque base do período:", baseStockId);
      return {
        stockImportId: baseStockId,
        periodId: periodOrImportId,
      };
    }
    
    // Se não encontrou base, verificar se periodOrImportId é um import_id direto
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
    
    // Se não encontrou como import_id, tentar como period_id e buscar qualquer import do período
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
  }
  
  // Fallback: buscar período ativo e seu estoque base
  const { data: activePeriod } = await supabaseAdmin
    .from("periods")
    .select("id")
    .eq("is_active", true)
    .single();
  
  if (activePeriod) {
    const { getBaseStockImportForPeriod } = await import("@/lib/periods");
    const baseStockId = await getBaseStockImportForPeriod(activePeriod.id);
    
    if (baseStockId) {
      console.log("[resolveStockContext] Usando estoque base do período ativo:", baseStockId);
      return {
        stockImportId: baseStockId,
        periodId: activePeriod.id,
      };
    }
  }

  // Último fallback: buscar qualquer import mais recente
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

  // VALIDAÇÃO CRÍTICA: Garantir que estamos usando apenas o estoque base do período
  console.log("[buildConsolidado] context.stockImportId:", context.stockImportId);
  console.log("[buildConsolidado] context.periodId:", context.periodId);
  console.log("[buildConsolidado] spedFileId recebido:", spedFileId);
  
  const stockData =
    context.stockImportId !== null
      ? await fetchAllRows(async (from, to) => {
          const { data, error } = await supabaseAdmin
            .from("stock_initial")
            .select("cod_item, descr_item, qtd, unid, unit_cost")
            .eq("import_id", context.stockImportId) // CRÍTICO: Filtrar APENAS pelo import_id do período
            .order("cod_item")
            .range(from, to);
          if (error) {
            throw new Error(`Erro ao buscar estoque inicial: ${error.message}`);
          }
          return data ?? [];
        })
      : [];
  
  console.log("[buildConsolidado] Total de itens de estoque inicial carregados:", stockData.length);

  // VALIDAÇÃO: Garantir que estamos buscando produtos apenas do SPED base
  console.log("[buildConsolidado] Buscando produtos do SPED:", spedFileId);
  const products = await fetchAllRows(async (from, to) => {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("cod_item, descr_item, unid_inv")
      .eq("sped_file_id", spedFileId) // CRÍTICO: Filtrar APENAS pelo SPED base
      .order("cod_item")
      .range(from, to);
    if (error) {
      throw new Error(`Erro ao buscar produtos: ${error.message}`);
    }
    return data ?? [];
  });
  console.log("[buildConsolidado] Total de produtos carregados:", products.length);

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

  // DEBUG: Verificar se o item 002064 está nos agregados
  const debugCode = "002064";
  console.log(`[buildConsolidado] Verificando item ${debugCode}:`);
  console.log(`  - No stockMap: ${stockMap.has(debugCode)}`);
  console.log(`  - No entradaAggregates: ${entradaAggregates.has(debugCode)}`);
  console.log(`  - No saidaAggregates: ${saidaAggregates.has(debugCode)}`);
  if (entradaAggregates.has(debugCode)) {
    const entrada2064 = entradaAggregates.get(debugCode);
    console.log(`  - Dados de entrada:`, entrada2064);
  }
  if (stockMap.has(debugCode)) {
    const stock2064 = stockMap.get(debugCode);
    console.log(`  - Dados de estoque:`, stock2064);
  }
  
  // DEBUG: Verificar todos os códigos que começam com "002064" ou "2064"
  const codigosCom2064 = Array.from(codigos).filter(c => c.includes("2064") || c.includes("002064"));
  if (codigosCom2064.length > 0) {
    console.log(`[buildConsolidado] Códigos relacionados a 2064 encontrados:`, codigosCom2064);
  } else {
    console.log(`[buildConsolidado] ⚠️ Nenhum código relacionado a 2064 encontrado nos agregados!`);
    console.log(`  - Total de códigos no stockMap: ${stockMap.size}`);
    console.log(`  - Total de códigos no entradaAggregates: ${entradaAggregates.size}`);
    console.log(`  - Total de códigos no saidaAggregates: ${saidaAggregates.size}`);
    // Listar alguns códigos de exemplo
    console.log(`  - Primeiros 10 códigos de entrada:`, Array.from(entradaAggregates.keys()).slice(0, 10));
  }

  const codigosArray = Array.from(codigos);
  
  // DEBUG: Verificar se 002064 está na lista final de códigos
  if (codigosArray.includes(debugCode)) {
    console.log(`[buildConsolidado] ✅ Item ${debugCode} está na lista final de códigos`);
  } else {
    console.error(`[buildConsolidado] ❌ Item ${debugCode} NÃO está na lista final de códigos!`);
    console.error(`[buildConsolidado] Total de códigos únicos: ${codigosArray.length}`);
  }
  
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
    
    // DEBUG específico para 002064
    if (cod === debugCode) {
      console.log(`[buildConsolidado] Processando row para ${debugCode}:`, {
        temStock: !!stock,
        temEntradas: !!entradas,
        temSaidas: !!saidas,
        stockQty: stock?.qty ?? 0,
        entradasQty: entradas?.qty ?? 0,
        saidasQty: saidas?.qty ?? 0,
      });
    }

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
  
  // DEBUG: Verificar se 002064 está nas rows finais
  const row2064Final = rows.find(r => r.cod_item === debugCode);
  if (row2064Final) {
    console.log(`[buildConsolidado] ✅ Item ${debugCode} está nas rows finais:`, {
      cod_item: row2064Final.cod_item,
      descr_item: row2064Final.descr_item,
      qtd_inicial: row2064Final.qtd_inicial,
      entradas: row2064Final.entradas,
      saidas: row2064Final.saidas,
      qtd_final: row2064Final.qtd_final,
      custo_medio: row2064Final.custo_medio,
      valor_total: row2064Final.valor_total,
    });
  } else {
    console.error(`[buildConsolidado] ❌ Item ${debugCode} NÃO está nas rows finais!`);
    console.error(`[buildConsolidado] Total de rows: ${rows.length}`);
  }

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
