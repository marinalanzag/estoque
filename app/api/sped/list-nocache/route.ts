import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// Configurações para desabilitar TODO tipo de cache
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  // Headers para prevenir cache
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store",
  };

  try {
    const supabaseAdmin = getSupabaseAdmin();

    console.log("[list-nocache] Buscando arquivos SPED sem cache...");

    const { data: spedFiles, error } = await supabaseAdmin
      .from("sped_files")
      .select("id, name, uploaded_at, period_id")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("[list-nocache] Erro ao buscar arquivos SPED:", error);
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          detail: "Erro ao consultar banco de dados Supabase"
        },
        { status: 500, headers }
      );
    }

    console.log(`[list-nocache] ✅ Retornando ${spedFiles?.length || 0} arquivos`);

    // Log do primeiro arquivo para debug
    if (spedFiles && spedFiles.length > 0) {
      console.log(`[list-nocache] Primeiro arquivo: ${spedFiles[0].name} (${spedFiles[0].uploaded_at})`);
    }

    return NextResponse.json({
      ok: true,
      files: spedFiles || [],
      timestamp: new Date().toISOString(),
      count: spedFiles?.length || 0,
    }, { headers });
  } catch (error) {
    console.error("[list-nocache] Erro inesperado:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
        detail: "Erro ao processar requisição"
      },
      { status: 500, headers }
    );
  }
}
