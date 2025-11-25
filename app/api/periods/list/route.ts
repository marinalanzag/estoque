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
      throw new Error(`Erro ao buscar períodos: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      periods: periods || [],
    });
  } catch (error) {
    console.error("Erro ao listar períodos:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

