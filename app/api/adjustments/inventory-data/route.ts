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
    const periodIdParam = searchParams.get("period_id");

    if (!spedFileId) {
      return NextResponse.json(
        { error: "sped_file_id é obrigatório" },
        { status: 400 }
      );
    }

    // ✅ CORREÇÃO: Usar buildConsolidado() para garantir consistência entre todas as abas
    // Esta mudança garante que a aba Ajustes mostre os mesmos valores do Consolidado
    console.log("[inventory-data] 🔄 Usando buildConsolidado() para garantir consistência");

    // Buscar período ativo ou usar period_id da query string
    let periodId: string | null = null;

    if (periodIdParam) {
      periodId = periodIdParam;
      console.log("[inventory-data] 🔍 Período recebido via query param:", periodIdParam);
    } else {
      const { data: periodData } = await supabaseAdmin
        .from("periods")
        .select("id, label, year, month")
        .eq("is_active", true)
        .single();

      if (periodData) {
        periodId = periodData.id;
        console.log("[inventory-data] 🔍 Período ativo encontrado no banco:", {
          id: periodData.id,
          label: (periodData as any)?.label || `${(periodData as any)?.month}/${(periodData as any)?.year}`,
        });
      } else {
        console.log("[inventory-data] ⚠️ Nenhum período ativo encontrado no banco");
      }
    }

    // Usar buildConsolidado() com mesma lógica que as outras abas
    const consolidado = await buildConsolidado(
      periodId,
      spedFileId,
      { xmlImportIds: null } // null = usar XMLs base do período (mesma lógica do Consolidado)
    );

    console.log("[inventory-data] ✅ Consolidado construído:", {
      total_items: consolidado.rows.length,
      total_valor: consolidado.summary.totalValor,
    });

    // Mapear dados do consolidado para formato esperado pela interface
    // Isso garante consistência total entre Consolidado, Inventário Final e Ajustes

    const items = consolidado.rows.map((row) => {
      const recebidos = consolidado.ajustes.recebidos[row.cod_item] ?? 0;
      const baixas = consolidado.ajustes.baixasPositivas[row.cod_item] ?? 0;
      const estoqueTeorico = row.qtd_final;
      const estoqueFinal = estoqueTeorico + recebidos - baixas;

      return {
        cod_item: row.cod_item,
        descr_item: row.descr_item,
        unidade: row.unidade,
        estoque_inicial: row.qtd_inicial,
        entradas: row.entradas,
        saidas: row.saidas,
        estoque_teorico: estoqueTeorico,
        unit_cost: row.custo_medio ?? 0,
        valor_estoque: row.valor_total,
        ajustes_recebidos: recebidos,
        ajustes_fornecidos: baixas,
        estoque_final: estoqueFinal,
      };
    });

    // Separar em negativos e positivos
    const negativos = items
      .filter((item) => item.estoque_final < 0)
      .sort((a, b) => a.estoque_final - b.estoque_final);

    const positivos = items
      .filter((item) => item.estoque_final > 0)
      .sort((a, b) => b.estoque_final - a.estoque_final);

    // Log de verificação para item 00013
    const item00013 = items.find(i => i.cod_item === "000013");
    if (item00013) {
      console.log("[inventory-data] 🎯 Item 00013 - Valores do Consolidado:", {
        estoque_inicial: item00013.estoque_inicial,
        entradas: item00013.entradas,
        saidas: item00013.saidas,
        estoque_teorico: item00013.estoque_teorico,
        ajustes_recebidos: item00013.ajustes_recebidos,
        ajustes_fornecidos: item00013.ajustes_fornecidos,
        estoque_final: item00013.estoque_final,
      });
    }

    // Calcular total de ajustes (buscar do banco)
    let totalAjustes = 0;
    if (periodId) {
      const { data: adjustments } = await supabaseAdmin
        .from("code_offset_adjustments")
        .select("total_value")
        .eq("sped_file_id", spedFileId)
        .or(`period_id.eq.${periodId},period_id.is.null`);

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
