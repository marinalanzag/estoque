import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

/**
 * Função server-side para setar o cookie de período ativo.
 * Formato do cookie: activePeriod=YYYY-MM
 */
async function setActivePeriodCookie(
  year: number,
  month: number
): Promise<void> {
  const cookieStore = await cookies();
  const cookieValue = `${year}-${month}`;
  
  cookieStore.set("activePeriod", cookieValue, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 ano
    path: "/",
  });
}

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

