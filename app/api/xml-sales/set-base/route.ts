import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * Marca ou desmarca uma importação de XML como base do período.
 * Pode haver múltiplos XMLs base no mesmo período.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const { xmlImportId, isBase } = body;

    if (!xmlImportId || typeof isBase !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "xmlImportId e isBase são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar o XML import para obter o period_id
    const { data: xmlImport, error: xmlError } = await supabaseAdmin
      .from("xml_sales_imports")
      .select("id, period_id")
      .eq("id", xmlImportId)
      .single();

    if (xmlError || !xmlImport) {
      return NextResponse.json(
        { ok: false, error: "Importação de XML não encontrada" },
        { status: 404 }
      );
    }

    if (!xmlImport.period_id) {
      return NextResponse.json(
        { ok: false, error: "Importação de XML não está vinculada a um período. Vincule-a primeiro." },
        { status: 400 }
      );
    }

    // Marcar/desmarcar o XML selecionado
    const { data, error } = await supabaseAdmin
      .from("xml_sales_imports")
      .update({ is_base: isBase })
      .eq("id", xmlImportId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar XML import:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      xmlImport: data,
    });
  } catch (error) {
    console.error("Erro ao marcar XML como base:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}



