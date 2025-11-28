import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * Marca ou desmarca uma importação de estoque inicial como base do período.
 * Quando marca uma importação como base, desmarca automaticamente outras do mesmo período.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const { stockImportId, stock_import_id, isBase } = body;
    const importId = stockImportId || stock_import_id;

    if (!importId || typeof isBase !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "stockImportId e isBase são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar o estoque inicial para obter o period_id
    const { data: stockImport, error: stockError } = await supabaseAdmin
      .from("stock_initial_imports")
      .select("id, period_id")
      .eq("id", importId)
      .single();

    if (stockError || !stockImport) {
      return NextResponse.json(
        { ok: false, error: "Importação de estoque inicial não encontrada" },
        { status: 404 }
      );
    }

    if (!stockImport.period_id) {
      return NextResponse.json(
        { ok: false, error: "Importação de estoque inicial não está vinculada a um período. Vincule-a primeiro." },
        { status: 400 }
      );
    }

    // Se está marcando como base, desmarcar outras importações do mesmo período
    if (isBase) {
      const { error: unsetError } = await supabaseAdmin
        .from("stock_initial_imports")
        .update({ is_base: false })
        .eq("period_id", stockImport.period_id)
        .neq("id", importId);

      if (unsetError) {
        console.error("Erro ao desmarcar outras importações:", unsetError);
        return NextResponse.json(
          { ok: false, error: `Erro ao desmarcar outras importações: ${unsetError.message}` },
          { status: 500 }
        );
      }
    }

    // Marcar/desmarcar a importação selecionada
    // Nota: Precisamos adicionar a coluna is_base em stock_initial_imports se ainda não existir
    const { data, error } = await supabaseAdmin
      .from("stock_initial_imports")
      .update({ is_base: isBase })
      .eq("id", importId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar estoque inicial:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      stockImport: data,
    });
  } catch (error) {
    console.error("Erro ao marcar estoque inicial como base:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

