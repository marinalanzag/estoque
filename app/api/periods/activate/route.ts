import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { setActivePeriodCookie } from "@/lib/periods";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const { periodId } = body;

    if (!periodId) {
      return NextResponse.json(
        { error: "periodId é obrigatório" },
        { status: 400 }
      );
    }

    // Desativar todos os períodos
    await supabaseAdmin
      .from("periods")
      .update({ is_active: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // Ativar o período selecionado
    const { data, error } = await supabaseAdmin
      .from("periods")
      .update({ is_active: true })
      .eq("id", periodId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao ativar período: ${error.message}`);
    }

    // Setar cookie com o período ativo
    if (data) {
      await setActivePeriodCookie(data.year, data.month);
    }

    return NextResponse.json({
      ok: true,
      period: data,
    });
  } catch (error) {
    console.error("Erro ao ativar período:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

