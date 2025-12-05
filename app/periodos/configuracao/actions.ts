"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { type Period } from "@/lib/periods";

/**
 * Função server-side para setar o cookie de período ativo.
 * Formato do cookie: activePeriod=YYYY-MM
 */
async function setActivePeriodCookie(
  year: number,
  month: number
): Promise<void> {
  const cookieStore = await cookies();
  const cookieValue = `${year}-${month}`;
  
  cookieStore.set("activePeriod", cookieValue, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 ano
    path: "/",
  });
}

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

interface CreatePeriodPayload {
  year: number;
  month: number;
  name?: string;
  description?: string;
}

/**
 * Server Action para criar um novo período
 * Mantém exatamente a mesma lógica de negócio da API route atual
 */
export async function createPeriodAction(
  payload: CreatePeriodPayload
): Promise<{ ok: boolean; period?: Period; error?: string }> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { year, month, name, description } = payload;

    if (!year || !month) {
      return { ok: false, error: "year e month são obrigatórios" };
    }

    if (month < 1 || month > 12) {
      return { ok: false, error: "month deve estar entre 1 e 12" };
    }

    // Gerar nome automático se não fornecido
    const periodName = name || `${monthNames[month - 1]} ${year}`;
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

    if (existingPeriod) {
      // Se já existe, desativar todos primeiro
      // Desativar todos os períodos
      const { error: deactivateError } = await supabaseAdmin
        .from("periods")
        .update({ is_active: false })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Condição sempre verdadeira

      if (deactivateError) {
        // Tentar novamente com abordagem diferente
        const { data: allPeriods } = await supabaseAdmin
          .from("periods")
          .select("id")
          .eq("is_active", true);

        if (allPeriods && allPeriods.length > 0) {
          const ids = allPeriods.map((p) => p.id);
          const { error: retryError } = await supabaseAdmin
            .from("periods")
            .update({ is_active: false })
            .in("id", ids);

          if (retryError) {
            return {
              ok: false,
              error: `Erro ao desativar períodos existentes: ${retryError.message}`,
            };
          }
        }
      }

      // Atualizar período existente
      const updateData: any = {
        is_active: true,
        name: periodName,
        label: periodLabel,
      };

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("periods")
        .update(updateData)
        .eq("id", existingPeriod.id)
        .select()
        .single();

      if (updateError) {
        return {
          ok: false,
          error: `Erro ao atualizar período existente: ${updateError.message}`,
        };
      }

      // Setar cookie
      await setActivePeriodCookie(year, month);

      // Revalidar rotas afetadas
      revalidatePath("/periodos/configuracao");
      revalidatePath("/");
      revalidatePath("/movimentacoes");
      revalidatePath("/ajustes");

      return { ok: true, period: updated as Period };
    }

    // Desativar todos os outros períodos ANTES de criar o novo
    const { error: deactivateError } = await supabaseAdmin
      .from("periods")
      .update({ is_active: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deactivateError) {
      // Método alternativo: buscar todos os IDs e desativar
      const { data: allPeriods, error: fetchError } = await supabaseAdmin
        .from("periods")
        .select("id")
        .eq("is_active", true);

      if (fetchError || (allPeriods && allPeriods.length > 0)) {
        const ids = allPeriods?.map((p) => p.id) || [];
        if (ids.length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from("periods")
            .update({ is_active: false })
            .in("id", ids);

          if (updateError) {
            return {
              ok: false,
              error: `Erro ao desativar períodos existentes: ${updateError.message}`,
            };
          }
        }
      }
    }

    // Verificar se realmente não há períodos ativos
    const { data: stillActive } = await supabaseAdmin
      .from("periods")
      .select("id, year, month")
      .eq("is_active", true);

    if (stillActive && stillActive.length > 0) {
      // Tentar desativar novamente
      const duplicateIds = stillActive.map((p) => p.id);
      const { error: retryError } = await supabaseAdmin
        .from("periods")
        .update({ is_active: false })
        .in("id", duplicateIds);

      if (retryError) {
        return {
          ok: false,
          error: `Não foi possível desativar períodos ativos existentes: ${retryError.message}`,
        };
      }
    }

    // Criar novo período já como ativo
    const insertData: any = {
      year: Number(year),
      month: Number(month),
      name: periodName,
      description: description || null,
      is_active: true,
      label: periodLabel,
    };

    const { data: newPeriod, error } = await supabaseAdmin
      .from("periods")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return {
        ok: false,
        error: `Erro ao criar período: ${error.message} (código: ${error.code})`,
      };
    }

    // Verificar se o período foi realmente criado como ativo
    let finalPeriod = newPeriod;
    if (!newPeriod.is_active) {
      const { data: activatedPeriod, error: activateError } = await supabaseAdmin
        .from("periods")
        .update({ is_active: true })
        .eq("id", newPeriod.id)
        .select()
        .single();

      if (activateError) {
        return {
          ok: false,
          error: `Erro ao ativar período recém-criado: ${activateError.message}`,
        };
      }

      finalPeriod = activatedPeriod;
    }

    // Setar cookie
    await setActivePeriodCookie(year, month);

    // Revalidar rotas afetadas
    revalidatePath("/periodos/configuracao");
    revalidatePath("/");
    revalidatePath("/movimentacoes");
    revalidatePath("/ajustes");

    return { ok: true, period: finalPeriod as Period };
  } catch (error) {
    console.error("Erro ao criar período:", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Erro desconhecido ao criar período",
    };
  }
}

/**
 * Server Action para ativar um período
 * Mantém exatamente a mesma lógica de negócio da API route atual
 */
export async function setActivePeriodAction(
  periodId: string
): Promise<{ ok: boolean; period?: Period; error?: string }> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (!periodId) {
      return { ok: false, error: "periodId é obrigatório" };
    }

    // Desativar todos os períodos
    await supabaseAdmin
      .from("periods")
      .update({ is_active: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // Ativar o período selecionado
    const { data, error } = await supabaseAdmin
      .from("periods")
      .update({ is_active: true })
      .eq("id", periodId)
      .select()
      .single();

    if (error) {
      return {
        ok: false,
        error: `Erro ao ativar período: ${error.message}`,
      };
    }

    // Setar cookie com o período ativo
    if (data) {
      await setActivePeriodCookie(data.year, data.month);
    }

    // Revalidar rotas afetadas
    revalidatePath("/periodos/configuracao");
    revalidatePath("/");
    revalidatePath("/movimentacoes");
    revalidatePath("/ajustes");

    return { ok: true, period: data as Period };
  } catch (error) {
    console.error("Erro ao ativar período:", error);
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Erro desconhecido ao ativar período",
    };
  }
}

