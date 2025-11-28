import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: periods, error } = await supabaseAdmin
      .from("periods")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) {
      console.error("Erro ao buscar períodos do banco:", error);
      throw new Error(`Erro ao buscar períodos: ${error.message}`);
    }

    const periodsList = periods || [];
    console.log(`[periods/list] Retornando ${periodsList.length} períodos`);
    
    // Log detalhado dos períodos retornados
    if (periodsList.length > 0) {
      console.log(`[periods/list] Períodos:`, periodsList.map(p => ({
        id: p.id,
        year: p.year,
        month: p.month,
        name: p.name,
        label: p.label,
        is_active: p.is_active,
      })));
    }

    return NextResponse.json({
      ok: true,
      periods: periodsList,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Erro ao listar períodos:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

