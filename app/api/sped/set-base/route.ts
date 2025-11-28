import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * Marca ou desmarca um SPED como base do período.
 * Quando marca um SPED como base, desmarca automaticamente outros SPEDs do mesmo período.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const { spedFileId, isBase } = body;

    if (!spedFileId || typeof isBase !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "spedFileId e isBase são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar o SPED para obter o period_id
    const { data: spedFile, error: spedError } = await supabaseAdmin
      .from("sped_files")
      .select("id, period_id")
      .eq("id", spedFileId)
      .single();

    if (spedError || !spedFile) {
      return NextResponse.json(
        { ok: false, error: "SPED não encontrado" },
        { status: 404 }
      );
    }

    if (!spedFile.period_id) {
      return NextResponse.json(
        { ok: false, error: "SPED não está vinculado a um período. Vincule-o primeiro." },
        { status: 400 }
      );
    }

    // Se está marcando como base, desmarcar outros SPEDs do mesmo período
    if (isBase) {
      const { error: unsetError } = await supabaseAdmin
        .from("sped_files")
        .update({ is_base: false })
        .eq("period_id", spedFile.period_id)
        .neq("id", spedFileId);

      if (unsetError) {
        console.error("Erro ao desmarcar outros SPEDs:", unsetError);
        return NextResponse.json(
          { ok: false, error: `Erro ao desmarcar outros SPEDs: ${unsetError.message}` },
          { status: 500 }
        );
      }
    }

    // Marcar/desmarcar o SPED selecionado
    const { data, error } = await supabaseAdmin
      .from("sped_files")
      .update({ is_base: isBase })
      .eq("id", spedFileId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar SPED:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      spedFile: data,
    });
  } catch (error) {
    console.error("Erro ao marcar SPED como base:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}



