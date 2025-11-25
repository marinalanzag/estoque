import { normalizeCodItem } from "@/lib/utils";

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

export interface InventoryFinalItem {
  cod_item: string;
  descr_item?: string | null;
  unid?: string | null;
  estoque_inicial: number;
  entradas: number;
  saidas: number;
  estoque_teorico: number;
  unit_cost: number;
  valor_estoque: number;
  ajustes_recebidos: number;
  ajustes_fornecidos: number;
  estoque_final: number;
  valor_estoque_final: number;
}

export async function getInventoryFinalData(
  supabaseAdmin: ReturnType<typeof import("@/lib/supabaseServer").getSupabaseAdmin>,
  spedFileId: string
): Promise<{
  items: InventoryFinalItem[];
  summary: {
    total_itens: number;
    total_quantidade: number;
    total_valor: number;
    itens_negativos: number;
    itens_positivos: number;
    itens_zerados: number;
  };
}> {
  // Buscar estoque inicial
  const stockInitial = await fetchAllRows(async (from, to) => {
    const { data, error } = await supabaseAdmin
      .from("stock_initial")
      .select("cod_item, qtd, unit_cost")
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

  // Buscar ajustes
  const { data: adjustments } = await supabaseAdmin
    .from("code_offset_adjustments")
    .select("cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value")
    .eq("sped_file_id", spedFileId);

  // Consolidar por cod_item
  const inventory = new Map<string, InventoryFinalItem>();

  // Processar estoque inicial
  stockInitial.forEach((item) => {
    const codItem = normalizeCodItem(item.cod_item);
    const qtd = Number(item.qtd ?? 0);
    const unitCost = Number(item.unit_cost ?? 0);

    inventory.set(codItem, {
      cod_item: codItem,
      estoque_inicial: qtd,
      entradas: 0,
      saidas: 0,
      estoque_teorico: qtd,
      unit_cost: unitCost,
      valor_estoque: qtd * unitCost,
      ajustes_recebidos: 0,
      ajustes_fornecidos: 0,
      estoque_final: qtd,
      valor_estoque_final: qtd * unitCost,
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
        estoque_inicial: 0,
        entradas: qtd,
        saidas: 0,
        estoque_teorico: qtd,
        unit_cost: unitCost,
        valor_estoque: vlItem,
        ajustes_recebidos: 0,
        ajustes_fornecidos: 0,
        estoque_final: qtd,
        valor_estoque_final: vlItem,
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
        estoque_inicial: 0,
        entradas: 0,
        saidas: qtd,
        estoque_teorico: -qtd,
        unit_cost: 0,
        valor_estoque: 0,
        ajustes_recebidos: 0,
        ajustes_fornecidos: 0,
        estoque_final: -qtd,
        valor_estoque_final: 0,
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
      inventory.set(codNegativo, {
        cod_item: codNegativo,
        estoque_inicial: 0,
        entradas: 0,
        saidas: 0,
        estoque_teorico: 0,
        unit_cost: Number(adj.unit_cost),
        valor_estoque: 0,
        ajustes_recebidos: qtdBaixada,
        ajustes_fornecidos: 0,
        estoque_final: qtdBaixada,
        valor_estoque_final: qtdBaixada * Number(adj.unit_cost),
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
    item.valor_estoque_final = item.estoque_final * item.unit_cost;
  });

  // Buscar descrições e unidades dos produtos (primeiro do SPED, depois do cadastro fixo)
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("cod_item, descr_item, unid_inv")
    .eq("sped_file_id", spedFileId);

  // Mapa de produtos do SPED
  const productsMap = new Map<string, { descr_item: string | null; unid_inv: string | null }>();
  products?.forEach((prod) => {
    const codItem = normalizeCodItem(prod.cod_item);
    productsMap.set(codItem, {
      descr_item: prod.descr_item,
      unid_inv: prod.unid_inv,
    });
  });

  // Buscar cadastro fixo de produtos (fallback)
  const { data: catalogProducts } = await supabaseAdmin
    .from("product_catalog")
    .select("cod_item, descr_item, unid");

  // Aplicar descrições e unidades
  inventory.forEach((item) => {
    const codItem = item.cod_item;
    
    // Primeiro tenta do SPED
    const spProduct = productsMap.get(codItem);
    if (spProduct) {
      item.descr_item = spProduct.descr_item;
      item.unid = spProduct.unid_inv;
    } else {
      // Se não encontrou no SPED, busca no cadastro fixo
      const catalogProduct = catalogProducts?.find(
        (p) => normalizeCodItem(p.cod_item) === codItem
      );
      if (catalogProduct) {
        item.descr_item = catalogProduct.descr_item;
        item.unid = catalogProduct.unid || undefined;
      }
    }
  });

  // Converter para array e ordenar por código
  const items = Array.from(inventory.values()).sort((a, b) =>
    a.cod_item.localeCompare(b.cod_item)
  );

  // Calcular totais
  const totalItens = items.length;
  const totalQuantidade = items.reduce((acc, item) => acc + item.estoque_final, 0);
  const totalValor = items.reduce((acc, item) => acc + item.valor_estoque_final, 0);
  const itensNegativos = items.filter((item) => item.estoque_final < 0).length;
  const itensPositivos = items.filter((item) => item.estoque_final > 0).length;
  const itensZerados = items.filter((item) => item.estoque_final === 0).length;

  return {
    items,
    summary: {
      total_itens: totalItens,
      total_quantidade: totalQuantidade,
      total_valor: totalValor,
      itens_negativos: itensNegativos,
      itens_positivos: itensPositivos,
      itens_zerados: itensZerados,
    },
  };
}

