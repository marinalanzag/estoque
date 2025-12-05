import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    // Informações de ambiente (sem expor chaves)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "NÃO CONFIGURADO";
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const nodeEnv = process.env.NODE_ENV || "unknown";
    const vercelEnv = process.env.VERCEL_ENV || "unknown";
    
    let connectionStatus = "unknown";
    let periodsCount = 0;
    let activePeriodsCount = 0;
    let errorDetails: any = null;
    
    try {
      const supabaseAdmin = getSupabaseAdmin();

      // Testar conexão buscando períodos
      const { data, error, count } = await supabaseAdmin
        .from("periods")
        .select("*", { count: 'exact' })
        .order("created_at", { ascending: false });

      if (error) {
        connectionStatus = "error";
        errorDetails = {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        };
      } else {
        connectionStatus = "success";
        periodsCount = count ?? data?.length ?? 0;
      }

      // Buscar períodos ativos
      const { data: activePeriods, error: activeError } = await supabaseAdmin
        .from("periods")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!activeError) {
        activePeriodsCount = activePeriods?.length ?? 0;
      }

      return NextResponse.json({
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv,
          vercelEnv,
          isProduction: nodeEnv === "production",
          isVercel: !!process.env.VERCEL,
        },
        supabase: {
          urlConfigured: supabaseUrl !== "NÃO CONFIGURADO",
          urlPreview: supabaseUrl !== "NÃO CONFIGURADO" ? supabaseUrl.substring(0, 30) + "..." : "NÃO CONFIGURADO",
          serviceKeyConfigured: hasServiceKey,
          connectionStatus,
        },
        data: {
          totalPeriods: periodsCount,
          activePeriods: activePeriodsCount,
          periods: data?.slice(0, 10) || [], // Limitar a 10 para não expor tudo
          activePeriodsList: activePeriods || [],
        },
        error: errorDetails,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Content-Type': 'application/json',
        },
      });
    } catch (initError) {
      connectionStatus = "initialization_error";
      errorDetails = {
        message: initError instanceof Error ? initError.message : "Erro desconhecido",
        type: initError instanceof Error ? initError.constructor.name : typeof initError,
      };

      return NextResponse.json({
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv,
          vercelEnv,
          isProduction: nodeEnv === "production",
          isVercel: !!process.env.VERCEL,
        },
        supabase: {
          urlConfigured: supabaseUrl !== "NÃO CONFIGURADO",
          urlPreview: supabaseUrl !== "NÃO CONFIGURADO" ? supabaseUrl.substring(0, 30) + "..." : "NÃO CONFIGURADO",
          serviceKeyConfigured: hasServiceKey,
          connectionStatus,
        },
        data: {
          totalPeriods: 0,
          activePeriods: 0,
          periods: [],
          activePeriodsList: [],
        },
        error: errorDetails,
      }, {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Erro desconhecido",
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    }, { status: 500 });
  }
}

