import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const monthLabels = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export async function POST(req: NextRequest) {
  console.log("🚀 [periods/create] API CHAMADA - INÍCIO");
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();
    console.log("🚀 [periods/create] Body recebido:", body);

    const { year, month, name, description } = body;
    console.log(`🚀 [periods/create] Dados extraídos: year=${year}, month=${month}, name=${name}`);

    if (!year || !month) {
      return NextResponse.json(
        { error: "year e month são obrigatórios" },
        { status: 400 }
      );
    }

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: "month deve estar entre 1 e 12" },
        { status: 400 }
      );
    }

    // Gerar nome automático se não fornecido
    const periodName =
      name ||
      `${monthNames[month - 1]} ${year}`;
    
    // Gerar label automático (formato "Jan/2022")
    const periodLabel = `${monthLabels[month - 1]}/${year}`;

    // Verificar se já existe período com mesmo year e month
    const { data: existingPeriod, error: checkError } = await supabaseAdmin
      .from("periods")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (checkError) {
      console.error("Erro ao verificar período existente:", checkError);
    }

    console.log(`[periods/create] Verificando período ${year}/${month}. Existente:`, existingPeriod ? existingPeriod.id : "não encontrado");

    if (existingPeriod) {
      // Se já existe, desativar todos primeiro
      const { error: deactivateError } = await supabaseAdmin
        .from("periods")
        .update({ is_active: false });

      if (deactivateError) {
        console.error("Erro ao desativar períodos:", deactivateError);
      }

      // Preparar dados de atualização (só incluir label se a coluna existir)
      const updateData: any = {
        is_active: true,
        name: periodName,
      };
      
      // Tentar adicionar label (pode não existir se migração não foi executada)
      try {
        updateData.label = periodLabel;
      } catch (e) {
        console.warn("Campo label não disponível, pulando...");
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("periods")
        .update(updateData)
        .eq("id", existingPeriod.id)
        .select()
        .single();

      if (updateError) {
        console.error("Erro ao atualizar período existente:", updateError);
        throw new Error(`Erro ao atualizar período existente: ${updateError.message}`);
      }

      console.log(`[periods/create] Período existente atualizado:`, updated);

      return NextResponse.json({
        ok: true,
        period: updated,
        message: "Período já existia e foi ativado",
      });
    }

    // Desativar todos os outros períodos ANTES de criar o novo
    console.log(`[periods/create] Desativando todos os períodos existentes...`);
    
    // Primeiro verificar quantos períodos estão ativos
    const { data: activeBefore } = await supabaseAdmin
      .from("periods")
      .select("id, year, month")
      .eq("is_active", true);
    
    const activeCount = activeBefore?.length || 0;
    if (activeCount > 0) {
      console.log(`[periods/create] Encontrados ${activeCount} períodos ativos antes da desativação:`, 
        activeBefore?.map(p => `${p.year}/${p.month}`).join(", "));
    }
    
    // Desativar TODOS os períodos (mais seguro - garante que nenhum fique ativo)
    const { error: deactivateError } = await supabaseAdmin
      .from("periods")
      .update({ is_active: false });

    if (deactivateError) {
      console.error("❌ [periods/create] Erro ao desativar períodos:", deactivateError);
      throw new Error(`Erro ao desativar períodos existentes: ${deactivateError.message}`);
    } else {
      console.log(`[periods/create] ✅ Todos os períodos foram desativados`);
    }

    // VERIFICAR se realmente não há períodos ativos (garantia)
    const { data: stillActive, error: verifyError } = await supabaseAdmin
      .from("periods")
      .select("id, year, month")
      .eq("is_active", true);

    if (verifyError) {
      console.warn(`[periods/create] ⚠️ Erro ao verificar períodos ativos:`, verifyError);
    } else if (stillActive && stillActive.length > 0) {
      console.warn(
        `[periods/create] ⚠️ AINDA HÁ ${stillActive.length} PERÍODOS ATIVOS APÓS DESATIVAÇÃO!`,
        stillActive.map((p) => `${p.year}/${p.month}`)
      );
      
      // Tentar desativar novamente (forçar)
      const duplicateIds = stillActive.map((p) => p.id);
      const { error: retryError } = await supabaseAdmin
        .from("periods")
        .update({ is_active: false })
        .in("id", duplicateIds);
      
      if (retryError) {
        console.error(`[periods/create] ❌ Erro ao desativar períodos duplicados na segunda tentativa:`, retryError);
        throw new Error(`Não foi possível desativar períodos ativos existentes: ${retryError.message}`);
      } else {
        console.log(`[periods/create] ✅ Períodos duplicados foram desativados na segunda tentativa`);
      }
    } else {
      console.log(`[periods/create] ✅ Confirmação: Nenhum período ativo encontrado. Pronto para criar novo período.`);
    }

    // Preparar dados de inserção - criar já como ativo (mais simples e direto)
    const insertData: any = {
      year: Number(year),
      month: Number(month),
      name: periodName,
      description: description || null,
      is_active: true, // Criar já como ativo, já desativamos todos os outros antes
      label: periodLabel, // Incluir label já na criação
    };

    console.log(`[periods/create] Criando novo período já ativado:`, insertData);

    // Criar novo período já como ativo
    const { data: newPeriod, error } = await supabaseAdmin
      .from("periods")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Erro detalhado ao criar período:", error);
      console.error("Dados que tentaram ser inseridos:", insertData);
      throw new Error(`Erro ao criar período: ${error.message} (código: ${error.code})`);
    }

    console.log(`[periods/create] ✅ Período criado com ID:`, newPeriod?.id);
    console.log(`[periods/create] is_active após criação:`, newPeriod?.is_active);

    // Verificar se o período foi realmente criado como ativo
    let finalPeriod = newPeriod;
    
    if (!newPeriod.is_active) {
      console.warn(`[periods/create] ⚠️ Período não foi criado como ativo. Tentando ativar...`);
      const { data: activatedPeriod, error: activateError } = await supabaseAdmin
        .from("periods")
        .update({ is_active: true })
        .eq("id", newPeriod.id)
        .select()
        .single();
      
      if (activateError) {
        console.error("❌ Erro ao ativar período:", activateError);
        throw new Error(`Erro ao ativar período recém-criado: ${activateError.message}`);
      }
      
      finalPeriod = activatedPeriod;
      console.log(`[periods/create] ✅ Período ativado com sucesso. is_active:`, finalPeriod?.is_active);
    }

    console.log(`[periods/create] ✅ Período final criado:`, finalPeriod);

    return NextResponse.json({
      ok: true,
      period: finalPeriod,
      message: "Período criado com sucesso",
    });
  } catch (error) {
    console.error("❌❌❌ [periods/create] ERRO CAPTURADO:", error);
    console.error("❌ [periods/create] Stack:", error instanceof Error ? error.stack : "N/A");
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("❌ [periods/create] Mensagem de erro:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

