import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // Buscar período ativo ou usar period_id da query string
    const periodIdParam = searchParams.get("period_id");
    let activePeriod: { id: string } | null = null;
    
    if (periodIdParam) {
      // Se period_id foi passado na query, usar ele
      activePeriod = { id: periodIdParam };
    } else {
      // Senão, buscar período ativo
      const { data: periodData } = await supabaseAdmin
        .from("periods")
        .select("id")
        .eq("is_active", true)
        .single();
      activePeriod = periodData || null;
    }

    // Buscar ajustes (do arquivo SPED e do período ativo se existir)
    let adjustmentsQuery = supabaseAdmin
      .from("code_offset_adjustments")
      .select("id, cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value, created_at, period_id")
      .eq("sped_file_id", spedFileId);

    // Se houver período ativo, filtrar por ele também OU por null (ajustes antigos sem período)
    if (activePeriod) {
      // Buscar ajustes do período OU ajustes sem período (null) para compatibilidade
      adjustmentsQuery = adjustmentsQuery.or(`period_id.eq.${activePeriod.id},period_id.is.null`);
      console.log("[api/adjustments/list] Filtrando ajustes por período:", activePeriod.id, "ou period_id null");
    } else {
      console.log("[api/adjustments/list] Nenhum período ativo, buscando todos os ajustes do SPED");
    }

    adjustmentsQuery = adjustmentsQuery.order("created_at", { ascending: false });

    const { data: adjustments, error } = await adjustmentsQuery;

    if (error) {
      console.error("Erro ao buscar ajustes:", error);
      return NextResponse.json(
        { error: `Erro ao buscar ajustes: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      adjustments: adjustments ?? [],
    });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

