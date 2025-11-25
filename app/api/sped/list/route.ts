import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  try {
    // Verificar variáveis de ambiente antes de tentar conectar
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[api/sped/list] Variáveis de ambiente não configuradas");
      return NextResponse.json(
        { 
          ok: false,
          error: "Variáveis de ambiente do Supabase não configuradas. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Vercel.",
          detail: !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL está faltando" : "SUPABASE_SERVICE_ROLE_KEY está faltando"
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: spedFiles, error } = await supabaseAdmin
      .from("sped_files")
      .select("id, name, uploaded_at")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("[api/sped/list] Erro ao buscar arquivos SPED:", error);
      return NextResponse.json(
        { 
          ok: false,
          error: error.message,
          detail: "Erro ao consultar banco de dados Supabase"
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      files: spedFiles || [],
    });
  } catch (error) {
    console.error("[api/sped/list] Erro inesperado:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    // Verificar se é erro de configuração
    if (errorMessage.includes("Variáveis de ambiente") || 
        errorMessage.includes("NEXT_PUBLIC_SUPABASE_URL") ||
        errorMessage.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { 
          ok: false,
          error: errorMessage,
          detail: "Configure as variáveis de ambiente no Vercel"
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        ok: false,
        error: errorMessage,
        detail: "Erro ao processar requisição"
      },
      { status: 500 }
    );
  }
}

