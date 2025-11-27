import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: imports, error } = await supabaseAdmin
      .from("stock_initial_imports")
      .select("id, label, total_items, total_value, created_at, period_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar imports:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      imports: imports || [],
    });
  } catch (error) {
    console.error("Erro ao listar imports:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
