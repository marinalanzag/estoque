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

    // Buscar período ativo para garantir persistência
    const { data: activePeriod } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("is_active", true)
      .single();

    // Buscar ajustes (do arquivo SPED e do período ativo se existir)
    const adjustmentsQuery = supabaseAdmin
      .from("code_offset_adjustments")
      .select("id, cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value, created_at, period_id")
      .eq("sped_file_id", spedFileId)
      .order("created_at", { ascending: false });

    // Se houver período ativo, filtrar por ele também
    if (activePeriod) {
      adjustmentsQuery.eq("period_id", activePeriod.id);
    }

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

