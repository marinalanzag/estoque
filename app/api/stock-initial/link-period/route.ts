import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const { importId } = body;

    if (!importId) {
      return NextResponse.json(
        { ok: false, error: "importId é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar período ativo
    const { data: activePeriod } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("is_active", true)
      .single();

    if (!activePeriod) {
      return NextResponse.json(
        { ok: false, error: "Nenhum período ativo encontrado. Ative um período primeiro." },
        { status: 400 }
      );
    }

    // Vincular import ao período ativo
    const { data, error } = await supabaseAdmin
      .from("stock_initial_imports")
      .update({ period_id: activePeriod.id })
      .eq("id", importId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao vincular import ao período:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      import: data,
    });
  } catch (error) {
    console.error("Erro ao vincular import ao período:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}









