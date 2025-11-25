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

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const { year, month, name, description } = body;

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

    // Desativar todos os outros períodos
    await supabaseAdmin
      .from("periods")
      .update({ is_active: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // Criar novo período (ativo por padrão)
    const { data, error } = await supabaseAdmin
      .from("periods")
      .insert({
        year: Number(year),
        month: Number(month),
        name: periodName,
        description: description || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      // Se for erro de duplicata, tentar buscar o existente
      if (error.code === "23505") {
        const { data: existing } = await supabaseAdmin
          .from("periods")
          .select("*")
          .eq("year", year)
          .eq("month", month)
          .eq("name", periodName)
          .single();

        if (existing) {
          // Ativar o período existente
          const { data: updated } = await supabaseAdmin
            .from("periods")
            .update({ is_active: true })
            .eq("id", existing.id)
            .select()
            .single();

          return NextResponse.json({
            ok: true,
            period: updated,
            message: "Período já existia e foi ativado",
          });
        }
      }

      throw new Error(`Erro ao criar período: ${error.message}`);
    }

    return NextResponse.json({
      ok: true,
      period: data,
    });
  } catch (error) {
    console.error("Erro ao criar período:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

