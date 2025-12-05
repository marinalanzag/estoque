import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Buscar TODOS os períodos diretamente do banco - SEM PROCESSAMENTO
    // Query idêntica ao que deveria estar sendo feito
    const { data, error, count } = await supabaseAdmin
      .from("periods")
      .select("*", { count: 'exact' })
      .order("created_at", { ascending: false });

    // Buscar períodos ativos separadamente
    const { data: activePeriods, error: activeError } = await supabaseAdmin
      .from("periods")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    // Informações de ambiente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "NÃO CONFIGURADO";
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      env: {
        url: supabaseUrl,
        hasServiceKey,
        urlPreview: supabaseUrl.substring(0, 30) + "...",
      },
      query: {
        count: count ?? null,
        dataLength: data?.length ?? 0,
        error: error ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        } : null,
      },
      periods: data ?? [],
      activePeriods: {
        count: activePeriods?.length ?? 0,
        data: activePeriods ?? [],
        error: activeError ? {
          message: activeError.message,
          code: activeError.code,
        } : null,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro desconhecido",
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    }, { status: 500 });
  }
}
