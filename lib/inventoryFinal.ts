import { buildConsolidado } from "@/lib/consolidado";

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

interface InventoryFinalSummary {
  total_itens: number;
  total_quantidade: number;
  total_valor: number;
  itens_negativos: number;
  itens_positivos: number;
  itens_zerados: number;
}

interface InventoryFinalOptions {
  xmlImportIds?: string[] | null;
}

export async function getInventoryFinalData(
  spedFileId: string,
  periodId?: string | null,
  options?: InventoryFinalOptions
): Promise<{ items: InventoryFinalItem[]; summary: InventoryFinalSummary }> {
  const consolidado = await buildConsolidado(periodId ?? null, spedFileId, {
    xmlImportIds: options?.xmlImportIds ?? null,
  });

  const items: InventoryFinalItem[] = consolidado.rows.map((row) => {
    const recebidos = consolidado.ajustes.recebidos[row.cod_item] ?? 0;
    const baixas = consolidado.ajustes.baixasPositivas[row.cod_item] ?? 0;
    const estoqueTeorico = row.qtd_final;
    const estoqueFinal = estoqueTeorico - baixas;
    const unitCost = row.custo_medio ?? 0;
    const valorEstoqueFinal = unitCost * estoqueFinal;

    return {
      cod_item: row.cod_item,
      descr_item: row.descr_item,
      unid: row.unidade || "UN",
      estoque_inicial: row.qtd_inicial,
      entradas: row.entradas,
      saidas: row.saidas,
      estoque_teorico: estoqueTeorico,
      unit_cost: unitCost,
      valor_estoque: row.valor_total,
      ajustes_recebidos: recebidos,
      ajustes_fornecidos: baixas,
      estoque_final: estoqueFinal,
      valor_estoque_final: valorEstoqueFinal,
    };
  });

  const summary: InventoryFinalSummary = {
    total_itens: items.length,
    total_quantidade: items.reduce((acc, item) => acc + item.estoque_final, 0),
    total_valor: items.reduce((acc, item) => acc + item.valor_estoque_final, 0),
    itens_negativos: items.filter((item) => item.estoque_final < 0).length,
    itens_positivos: items.filter((item) => item.estoque_final > 0).length,
    itens_zerados: items.filter((item) => item.estoque_final === 0).length,
  };

  return { items, summary };
}
