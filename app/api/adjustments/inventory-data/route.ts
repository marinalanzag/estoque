import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { buildConsolidado } from "@/lib/consolidado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0; // Desabilita cache completamente

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const spedFileId = searchParams.get("sped_file_id");

    if (!spedFileId) {
      return NextResponse.json(
        { error: "sped_file_id é obrigatório" },
        { status: 400 }
      );
    }

    console.log("[inventory-data] ========================================");
    console.log("[inventory-data] 🔄 GARANTINDO CONSISTÊNCIA COM CONSOLIDADO");
    console.log("[inventory-data] Usando EXATAMENTE a mesma lógica da página Consolidado");
    console.log("[inventory-data] ========================================");

    // ✅ CRÍTICO: Replicar EXATAMENTE a lógica da página Consolidado
    // Importar os mesmos helpers
    const { getActivePeriodFromRequest, getBaseSpedFileForPeriod, getBaseXmlImportsForPeriod, getBaseStockImportForPeriod } = await import("@/lib/periods");

    // Buscar período ativo (mesma lógica)
    const activePeriod = await getActivePeriodFromRequest();
    console.log("[inventory-data] Período ativo:", activePeriod ? `${activePeriod.year}/${activePeriod.month}` : "NENHUM");

    let selectedFileId: string = spedFileId;
    let selectedImportId: string | null = null;

    if (activePeriod) {
      // Buscar SPED base do período
      const baseSpedId = await getBaseSpedFileForPeriod(activePeriod.id);
      console.log("[inventory-data] SPED base do período:", baseSpedId);

      if (baseSpedId) {
        selectedFileId = baseSpedId; // Usar SPED base, não o passado via param
      }

      // Buscar estoque base do período
      const baseStockId = await getBaseStockImportForPeriod(activePeriod.id);
      console.log("[inventory-data] Estoque base do período:", baseStockId);

      if (baseStockId) {
        selectedImportId = baseStockId;
      } else {
        // Fallback: qualquer estoque do período
        const { data: anyStockImport } = await supabaseAdmin
          .from("stock_initial_imports")
          .select("id")
          .eq("period_id", activePeriod.id)
          .limit(1)
          .single();

        if (anyStockImport) {
          selectedImportId = anyStockImport.id;
          console.warn("[inventory-data] ⚠️ Usando fallback de estoque:", selectedImportId);
        } else {
          console.error("[inventory-data] ❌ Nenhum estoque encontrado para o período!");
          return NextResponse.json(
            { error: "Nenhum estoque inicial encontrado para o período ativo" },
            { status: 400 }
          );
        }
      }
    } else {
      console.warn("[inventory-data] ⚠️ Nenhum período ativo - modo compatibilidade");
      // Sem período ativo: buscar qualquer estoque (compatibilidade)
      const { data: anyStock } = await supabaseAdmin
        .from("stock_initial_imports")
        .select("id")
        .limit(1)
        .single();

      if (anyStock) {
        selectedImportId = anyStock.id;
      }
    }

    // ✅ CRÍTICO: Buscar XMLs base do período (mesma lógica da página Consolidado)
    let xmlsParaUsar: string[] | null = null;
    if (activePeriod) {
      const baseXmlImportIds = await getBaseXmlImportsForPeriod(activePeriod.id);
      console.log("[inventory-data] XMLs base encontrados:", baseXmlImportIds.length);

      if (baseXmlImportIds.length > 0) {
        xmlsParaUsar = baseXmlImportIds;
      }
    }

    console.log("[inventory-data] Parâmetros finais para buildConsolidado:", {
      selectedImportId,
      selectedFileId,
      xmlsParaUsar: xmlsParaUsar?.length ?? 0,
    });

    // ✅ CRÍTICO: Chamar buildConsolidado com EXATAMENTE os mesmos parâmetros
    const consolidado = await buildConsolidado(
      selectedImportId, // ✅ ID do estoque inicial
      selectedFileId,   // ✅ ID do SPED base
      { xmlImportIds: xmlsParaUsar } // ✅ XMLs base do período
    );

    console.log("[inventory-data] ✅ Consolidado construído:", {
      total_items: consolidado.rows.length,
      total_valor: consolidado.summary.totalValor,
    });

    // ✅ Mapear dados do consolidado EXATAMENTE como está
    // A aba Ajustes deve ser uma cópia fiel do Consolidado
    const items = consolidado.rows.map((row) => {
      const recebidos = consolidado.ajustes.recebidos[row.cod_item] ?? 0;
      const baixas = consolidado.ajustes.baixasPositivas[row.cod_item] ?? 0;

      // IMPORTANTE: row.qtd_final já é o estoque teórico (inicial + entradas - saídas)
      // Ajustes são aplicados DEPOIS disso para obter o estoque final
      const estoqueTeorico = row.qtd_final;
      const estoqueFinal = estoqueTeorico + recebidos - baixas;

      return {
        cod_item: row.cod_item,
        descr_item: row.descr_item,
        unidade: row.unidade,
        estoque_inicial: row.qtd_inicial,
        entradas: row.entradas,
        saidas: row.saidas,
        estoque_teorico: estoqueTeorico, // = qtd_final do consolidado = qtd_inicial + entradas - saidas
        unit_cost: row.custo_medio ?? 0,
        valor_estoque: row.valor_total,
        ajustes_recebidos: recebidos,
        ajustes_fornecidos: baixas,
        estoque_final: estoqueFinal, // = estoque_teorico + recebidos - baixas
      };
    });

    // ✅ CORREÇÃO: Separar por estoque_teorico (SEM ajustes de baixas)
    // A aba Ajustes mostra o estoque ANTES das baixas para o usuário decidir quanto baixar
    const negativos = items
      .filter((item) => item.estoque_teorico < 0)
      .sort((a, b) => a.estoque_teorico - b.estoque_teorico);

    const positivos = items
      .filter((item) => item.estoque_teorico > 0)
      .sort((a, b) => b.estoque_teorico - a.estoque_teorico);

    // Log de verificação para item 00013
    const item00013 = items.find(i => i.cod_item === "000013");
    if (item00013) {
      console.log("[inventory-data] 🎯 Item 00013 - Valores Mapeados:", {
        estoque_inicial: item00013.estoque_inicial,
        entradas: item00013.entradas,
        saidas: item00013.saidas,
        estoque_teorico: item00013.estoque_teorico,
        ajustes_recebidos: item00013.ajustes_recebidos,
        ajustes_fornecidos: item00013.ajustes_fornecidos,
        estoque_final: item00013.estoque_final,
        formula_teorico: `${item00013.estoque_inicial} + ${item00013.entradas} - ${item00013.saidas} = ${item00013.estoque_inicial + item00013.entradas - item00013.saidas}`,
        formula_final: `${item00013.estoque_teorico} + ${item00013.ajustes_recebidos} - ${item00013.ajustes_fornecidos} = ${item00013.estoque_final}`,
      });
    }

    // Log do que será retornado na resposta
    const item00013Response = positivos.find(i => i.cod_item === "000013") || negativos.find(i => i.cod_item === "000013");
    if (item00013Response) {
      console.log("[inventory-data] 📤 Item 00013 - O QUE SERÁ ENVIADO AO FRONTEND:", {
        cod_item: item00013Response.cod_item,
        estoque_teorico: item00013Response.estoque_teorico,
        estoque_final: item00013Response.estoque_final,
        esta_em: item00013Response.estoque_final > 0 ? "POSITIVOS" : "NEGATIVOS",
      });
    }

    // Calcular total de ajustes (buscar do banco)
    let totalAjustes = 0;
    if (activePeriod) {
      const { data: adjustments } = await supabaseAdmin
        .from("code_offset_adjustments")
        .select("total_value")
        .eq("sped_file_id", selectedFileId)
        .or(`period_id.eq.${activePeriod.id},period_id.is.null`);

      totalAjustes = (adjustments ?? []).reduce(
        (acc, adj) => acc + Number(adj.total_value),
        0
      );
    }

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
