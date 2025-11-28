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
  // CRÍTICO: O Inventário Final DEVE usar exatamente os mesmos dados da Consolidação
  // Não pode haver filtros ou exclusões baseados em estoque inicial
  const consolidado = await buildConsolidado(periodId ?? null, spedFileId, {
    xmlImportIds: options?.xmlImportIds ?? null,
  });

  // DEBUG: Verificar se o código 002064 está no consolidado
  const debugCode = "002064";
  console.log(`[INV-FINAL DEBUG] Total de rows no consolidado: ${consolidado.rows.length}`);
  const row2064 = consolidado.rows.find(r => r.cod_item === debugCode);
  if (row2064) {
    console.log(`[INV-FINAL DEBUG] ✅ Item ${debugCode} encontrado no consolidado:`, {
      cod_item: row2064.cod_item,
      descr_item: row2064.descr_item,
      qtd_inicial: row2064.qtd_inicial,
      entradas: row2064.entradas,
      saidas: row2064.saidas,
      qtd_final: row2064.qtd_final,
      custo_medio: row2064.custo_medio,
      valor_total: row2064.valor_total,
    });
  } else {
    console.error(`[INV-FINAL DEBUG] ❌ Item ${debugCode} NÃO encontrado no consolidado.rows!`);
    console.error(`[INV-FINAL DEBUG] Códigos similares encontrados:`, 
      consolidado.rows
        .filter(r => r.cod_item.includes("2064") || r.cod_item.includes("002064"))
        .map(r => ({ cod_item: r.cod_item, descr_item: r.descr_item }))
    );
    console.error(`[INV-FINAL DEBUG] Primeiros 20 códigos do consolidado:`, 
      consolidado.rows.slice(0, 20).map(r => r.cod_item)
    );
  }

  // IMPORTANTE: Mapear TODOS os rows do consolidado, sem filtros
  // O consolidado já garante que todos os códigos com entradas/saídas/estoque estão incluídos
  const items: InventoryFinalItem[] = consolidado.rows.map((row) => {
    const recebidos = consolidado.ajustes.recebidos[row.cod_item] ?? 0;
    const baixas = consolidado.ajustes.baixasPositivas[row.cod_item] ?? 0;
    const estoqueTeorico = row.qtd_final;
    const estoqueFinal = estoqueTeorico - baixas;
    const unitCost = row.custo_medio ?? 0;
    // IMPORTANTE: Valores negativos são ignorados (não podem ser usados para contagem)
    const valorEstoqueFinal = (estoqueFinal > 0 && unitCost > 0) ? unitCost * estoqueFinal : 0;

    // DEBUG específico para 002064
    if (row.cod_item === debugCode) {
      console.log(`[INV-FINAL DEBUG] Mapeando item ${debugCode}:`, {
        recebidos,
        baixas,
        estoqueTeorico,
        estoqueFinal,
        unitCost,
        valorEstoqueFinal,
      });
    }

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

  // DEBUG: Verificar se o item 002064 está nos items finais
  const item2064 = items.find(i => i.cod_item === debugCode);
  if (item2064) {
    console.log(`[INV-FINAL DEBUG] ✅ Item ${debugCode} encontrado nos items finais:`, {
      cod_item: item2064.cod_item,
      descr_item: item2064.descr_item,
      estoque_inicial: item2064.estoque_inicial,
      entradas: item2064.entradas,
      saidas: item2064.saidas,
      estoque_teorico: item2064.estoque_teorico,
      estoque_final: item2064.estoque_final,
    });
  } else {
    console.error(`[INV-FINAL DEBUG] ❌ Item ${debugCode} NÃO encontrado nos items finais!`);
    console.error(`[INV-FINAL DEBUG] Total de items: ${items.length}`);
  }

  const summary: InventoryFinalSummary = {
    total_itens: items.length,
    total_quantidade: items.reduce((acc, item) => acc + item.estoque_final, 0),
    // IMPORTANTE: Valores negativos são ignorados no total (não podem ser usados para contagem)
    total_valor: items.reduce((acc, item) => acc + (item.valor_estoque_final > 0 ? item.valor_estoque_final : 0), 0),
    itens_negativos: items.filter((item) => item.estoque_final < 0).length,
    itens_positivos: items.filter((item) => item.estoque_final > 0).length,
    itens_zerados: items.filter((item) => item.estoque_final === 0).length,
  };

  return { items, summary };
}
