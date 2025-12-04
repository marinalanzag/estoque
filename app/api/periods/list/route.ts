import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Primeiro verificar quantos períodos existem no banco
    const { count, error: countError } = await supabaseAdmin
      .from("periods")
      .select("*", { count: 'exact', head: true });

    if (countError) {
      console.error("[periods/list] Erro ao contar períodos:", countError);
    } else {
      console.log(`[periods/list] Total de períodos no banco: ${count || 0}`);
    }

    // Buscar TODOS os períodos sem limite
    // Não usar range() para não limitar resultados
    const { data: periods, error, count: queryCount } = await supabaseAdmin
      .from("periods")
      .select("*", { count: 'exact' })
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) {
      console.error("[periods/list] ❌ Erro ao buscar períodos do banco:", error);
      throw new Error(`Erro ao buscar períodos: ${error.message}`);
    }

    let periodsList = periods || [];
    
    // VALIDAÇÃO: Filtrar períodos inválidos ou sem dados essenciais
    periodsList = periodsList.filter(p => {
      if (!p || !p.id || !p.year || !p.month) {
        console.warn(`[periods/list] ⚠️ Período inválido filtrado:`, p);
        return false;
      }
      if (p.month < 1 || p.month > 12) {
        console.warn(`[periods/list] ⚠️ Período com mês inválido filtrado: ${p.year}/${p.month}`);
        return false;
      }
      return true;
    });
    
    console.log(`[periods/list] ✅ Query retornou ${periodsList.length} períodos válidos (de ${periods?.length || 0} totais)`);
    console.log(`[periods/list] 📊 Count da query: ${queryCount || 'não disponível'}`);
    console.log(`[periods/list] 📊 Count do banco (head query): ${count || 'não disponível'}`);
    
    // Verificar se o número retornado corresponde ao count
    if (queryCount !== null && queryCount !== undefined && periodsList.length !== queryCount) {
      console.warn(`[periods/list] ⚠️ DISCREPÂNCIA: Count da query (${queryCount}) diferente do retornado válido (${periodsList.length})`);
    }
    if (count !== null && count !== undefined && periodsList.length !== count) {
      console.warn(`[periods/list] ⚠️ DISCREPÂNCIA: Count do banco (${count}) diferente do retornado válido (${periodsList.length})`);
    }
    
    // Log detalhado dos períodos retornados
    if (periodsList.length > 0) {
      console.log(`[periods/list] 📋 Períodos válidos retornados:`, periodsList.map(p => ({
        id: p.id?.substring(0, 8) + '...',
        year: p.year,
        month: p.month,
        name: p.name,
        label: p.label,
        is_active: p.is_active,
        created_at: p.created_at,
      })));
    } else {
      console.warn(`[periods/list] ⚠️ Nenhum período válido retornado! Count do banco: ${count || 0}`);
    }

    return NextResponse.json({
      ok: true,
      periods: periodsList,
      count: periodsList.length, // Incluir count na resposta para debug
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("[periods/list] ❌ Erro ao listar períodos:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

