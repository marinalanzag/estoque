import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Buscar TODOS os períodos ativos (pode haver múltiplos por erro)
    const { data: activePeriods, error: fetchError } = await supabaseAdmin
      .from("periods")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false }); // Mais recente primeiro

    if (fetchError) {
      console.error("[periods/active] Erro ao buscar períodos ativos:", fetchError);
      throw new Error(`Erro ao buscar período ativo: ${fetchError.message}`);
    }

    // Headers para evitar cache
    const headers = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    };

    // Se não houver período ativo, retornar null
    if (!activePeriods || activePeriods.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          period: null,
        },
        { headers }
      );
    }

    // Se houver apenas um período ativo, retornar ele
    if (activePeriods.length === 1) {
      return NextResponse.json(
        {
          ok: true,
          period: activePeriods[0],
        },
        { headers }
      );
    }

    // ⚠️ PROBLEMA: Há múltiplos períodos ativos!
    // Vamos corrigir isso: manter apenas o mais recente ativo e desativar os outros
    console.warn(
      `[periods/active] ⚠️ Encontrados ${activePeriods.length} períodos ativos. Desativando duplicados...`
    );

    const mostRecent = activePeriods[0]; // Já ordenado por created_at DESC
    const duplicates = activePeriods.slice(1); // Todos os outros

    // Desativar os períodos duplicados
    const duplicateIds = duplicates.map((p) => p.id);
    const { error: deactivateError } = await supabaseAdmin
      .from("periods")
      .update({ is_active: false })
      .in("id", duplicateIds);

    if (deactivateError) {
      console.error(
        "[periods/active] Erro ao desativar períodos duplicados:",
        deactivateError
      );
      // Mesmo se falhar, retornar o mais recente
      return NextResponse.json(
        {
          ok: true,
          period: mostRecent,
          warning: `Múltiplos períodos ativos detectados. Retornando o mais recente, mas não foi possível desativar os outros.`,
        },
        { headers }
      );
    }

    console.log(
      `[periods/active] ✅ ${duplicates.length} períodos duplicados foram desativados. Mantendo apenas o período ${mostRecent.id} (${mostRecent.year}/${mostRecent.month}) ativo.`
    );

    // Retornar o período mais recente
    return NextResponse.json(
      {
        ok: true,
        period: mostRecent,
        warning: `Múltiplos períodos ativos foram detectados e corrigidos. O período ${mostRecent.year}/${mostRecent.month} foi mantido ativo.`,
      },
      { headers }
    );
  } catch (error) {
    console.error("[periods/active] Erro ao buscar período ativo:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

