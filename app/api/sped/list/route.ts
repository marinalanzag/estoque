import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: spedFiles, error } = await supabaseAdmin
      .from("sped_files")
      .select("id, name, uploaded_at")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar arquivos SPED:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      files: spedFiles || [],
    });
  } catch (error) {
    console.error("Erro ao listar arquivos SPED:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

