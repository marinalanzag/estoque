import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    // Testar conexão com Supabase
    const { data, error } = await supabaseAdmin
      .from("sped_files")
      .select("count")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { 
          ok: false, 
          error: error.message,
          details: error
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Conexão com Supabase funcionando!",
      data 
    });
  } catch (error) {
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    );
  }
}

