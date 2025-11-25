import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: period, error } = await supabaseAdmin
      .from("periods")
      .select("*")
      .eq("is_active", true)
      .single();

    if (error) {
      // Se não houver período ativo, retornar null (não é erro)
      if (error.code === "PGRST116") {
        return NextResponse.json({
          ok: true,
          period: null,
        });
      }
      throw new Error(`Erro ao buscar período ativo: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      period: period || null,
    });
  } catch (error) {
    console.error("Erro ao buscar período ativo:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

