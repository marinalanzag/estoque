import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const spedFileId = "eabc99dc-1fa7-4a8e-b4d6-7fe8db6e2a14";
    const periodId = "6d4abba3-fc54-4946-a248-5e5370693a92";

    // 1. Buscar ajustes
    const { data: adjustments, error: adjError } = await supabaseAdmin
      .from("code_offset_adjustments")
      .select("cod_negativo, cod_positivo, qtd_baixada, period_id")
      .eq("sped_file_id", spedFileId)
      .or(`period_id.eq.${periodId},period_id.is.null`);

    if (adjError) {
      return NextResponse.json({ error: adjError.message }, { status: 500 });
    }

    // 2. Filtrar ajustes do item 011141
    const ajustes011141 = (adjustments || []).filter((adj) => {
      const codNeg = normalizeCodItem(adj.cod_negativo);
      const codPos = normalizeCodItem(adj.cod_positivo);
      return codNeg === "011141" || codPos === "011141";
    });

    // 3. Calcular totais
    let ajustesRecebidos = 0;
    let ajustesFornecidos = 0;

    ajustes011141.forEach((adj) => {
      const codNeg = normalizeCodItem(adj.cod_negativo);
      const codPos = normalizeCodItem(adj.cod_positivo);
      const qtd = Number(adj.qtd_baixada);

      if (codNeg === "011141") {
        ajustesRecebidos += qtd;
      }
      if (codPos === "011141") {
        ajustesFornecidos += qtd;
      }
    });

    return NextResponse.json({
      ok: true,
      total_ajustes_encontrados: adjustments?.length || 0,
      ajustes_011141: ajustes011141.map((adj) => ({
        cod_negativo: adj.cod_negativo,
        cod_negativo_normalizado: normalizeCodItem(adj.cod_negativo),
        cod_positivo: adj.cod_positivo,
        cod_positivo_normalizado: normalizeCodItem(adj.cod_positivo),
        qtd_baixada: adj.qtd_baixada,
        period_id: adj.period_id,
      })),
      resumo: {
        ajustes_recebidos: ajustesRecebidos,
        ajustes_fornecidos: ajustesFornecidos,
        estoque_teorico: 29,
        estoque_final_calculado: 29 + ajustesRecebidos - ajustesFornecidos,
      },
    });
  } catch (error) {
    console.error("Erro ao debugar item 011141:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
