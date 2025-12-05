import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    // Buscar valores EXATOS das variáveis de ambiente (sem truncar)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "NÃO CONFIGURADO";
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Mostrar preview da chave (primeiros e últimos caracteres para segurança)
    const serviceKeyPreview = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(process.env.SUPABASE_SERVICE_ROLE_KEY.length - 10)}`
      : "NÃO CONFIGURADO";
    
    let connectionTest: any = {
      status: "not_tested",
      error: null,
    };
    
    let periodsInfo: any = {
      total: 0,
      active: 0,
      sample: [],
    };
    
    try {
      const supabaseAdmin = getSupabaseAdmin();
      
      // Testar conexão buscando períodos
      const { data: periods, error, count } = await supabaseAdmin
        .from("periods")
        .select("*", { count: 'exact' })
        .order("created_at", { ascending: false })
        .limit(5); // Limitar a 5 para não expor tudo
      
      if (error) {
        connectionTest = {
          status: "error",
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          },
        };
      } else {
        connectionTest = {
          status: "success",
        };
        
        periodsInfo = {
          total: count ?? periods?.length ?? 0,
          active: periods?.filter((p: any) => p.is_active).length ?? 0,
          sample: periods?.slice(0, 3).map((p: any) => ({
            id: p.id.substring(0, 8) + '...',
            year: p.year,
            month: p.month,
            name: p.name,
            is_active: p.is_active,
            created_at: p.created_at,
          })) ?? [],
        };
      }
      
      // Buscar período ativo
      const { data: activePeriods } = await supabaseAdmin
        .from("periods")
        .select("*")
        .eq("is_active", true)
        .limit(1);
      
      if (activePeriods && activePeriods.length > 0) {
        periodsInfo.activePeriod = {
          id: activePeriods[0].id.substring(0, 8) + '...',
          year: activePeriods[0].year,
          month: activePeriods[0].month,
          name: activePeriods[0].name,
          created_at: activePeriods[0].created_at,
        };
      }
    } catch (testError) {
      connectionTest = {
        status: "exception",
        error: {
          message: testError instanceof Error ? testError.message : "Erro desconhecido",
          type: testError instanceof Error ? testError.constructor.name : typeof testError,
        },
      };
    }
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || "unknown",
        isVercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV || "unknown",
        vercelUrl: process.env.VERCEL_URL || "unknown",
      },
      supabase: {
        url: supabaseUrl, // URL COMPLETA (sem truncar)
        urlLength: supabaseUrl.length,
        hasServiceKey,
        serviceKeyPreview: hasServiceKey ? serviceKeyPreview : "NÃO CONFIGURADO",
      },
      connection: connectionTest,
      periods: periodsInfo,
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
    }, { status: 500 });
  }
}

