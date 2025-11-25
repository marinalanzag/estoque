import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const {
      sped_file_id,
      cod_negativo,
      cod_positivo,
      qtd_baixada,
      unit_cost,
    } = body;

    // Validações
    if (!sped_file_id || !cod_negativo || !cod_positivo || !qtd_baixada || unit_cost === undefined) {
      return NextResponse.json(
        { error: "Campos obrigatórios: sped_file_id, cod_negativo, cod_positivo, qtd_baixada, unit_cost" },
        { status: 400 }
      );
    }

    if (qtd_baixada <= 0) {
      return NextResponse.json(
        { error: "qtd_baixada deve ser maior que zero" },
        { status: 400 }
      );
    }

    if (unit_cost < 0) {
      return NextResponse.json(
        { error: "unit_cost não pode ser negativo" },
        { status: 400 }
      );
    }

    // Normalizar códigos
    const codNegativoNormalizado = normalizeCodItem(cod_negativo);
    const codPositivoNormalizado = normalizeCodItem(cod_positivo);

    if (codNegativoNormalizado === codPositivoNormalizado) {
      return NextResponse.json(
        { error: "Código negativo e positivo não podem ser iguais" },
        { status: 400 }
      );
    }

    const total_value = Number(qtd_baixada) * Number(unit_cost);

    // Buscar período ativo
    const { data: activePeriod } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("is_active", true)
      .single();

    // Inserir ajuste
    const { data, error } = await supabaseAdmin
      .from("code_offset_adjustments")
      .insert({
        sped_file_id,
        cod_negativo: codNegativoNormalizado,
        cod_positivo: codPositivoNormalizado,
        qtd_baixada: Number(qtd_baixada),
        unit_cost: Number(unit_cost),
        total_value,
        period_id: activePeriod?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar ajuste:", error);
      return NextResponse.json(
        { error: `Erro ao criar ajuste: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      adjustment: data,
    });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

