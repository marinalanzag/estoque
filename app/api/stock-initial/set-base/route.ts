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
    console.log(`[stock-initial/set-base] Buscando importação: ${importId}`);
    const { data: stockImport, error: stockError } = await supabaseAdmin
      .from("stock_initial_imports")
      .select("id, period_id, is_base, label")
      .eq("id", importId)
      .single();

    if (stockError || !stockImport) {
      console.error(`[stock-initial/set-base] Erro ao buscar importação:`, stockError);
      return NextResponse.json(
        { ok: false, error: `Importação de estoque inicial não encontrada: ${stockError?.message || 'Não encontrado'}` },
        { status: 404 }
      );
    }

    console.log(`[stock-initial/set-base] Importação encontrada:`, {
      id: stockImport.id,
      label: stockImport.label,
      period_id: stockImport.period_id,
      is_base: stockImport.is_base,
    });

    if (!stockImport.period_id) {
      console.warn(`[stock-initial/set-base] ⚠️ Importação não está vinculada a um período`);
      return NextResponse.json(
        { ok: false, error: "Importação de estoque inicial não está vinculada a um período. Vincule-a primeiro na página de configuração." },
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
    console.log(`[stock-initial/set-base] Atualizando is_base para ${isBase} na importação ${importId}`);
    const { data, error } = await supabaseAdmin
      .from("stock_initial_imports")
      .update({ is_base: isBase })
      .eq("id", importId)
      .select()
      .single();

    if (error) {
      console.error(`[stock-initial/set-base] Erro ao atualizar estoque inicial:`, error);
      console.error(`[stock-initial/set-base] Código do erro: ${error.code}`);
      console.error(`[stock-initial/set-base] Detalhes:`, error);
      
      // Se o erro for sobre coluna não encontrada, informar isso claramente
      if (error.message?.includes('column') || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { ok: false, error: `Erro: A coluna 'is_base' não existe na tabela stock_initial_imports. Execute a migração db/migration_periods_enhancements.sql primeiro.` },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { ok: false, error: `Erro ao atualizar: ${error.message}` },
        { status: 500 }
      );
    }
    
    console.log(`[stock-initial/set-base] ✅ Importação atualizada com sucesso:`, data);

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

