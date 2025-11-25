import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const spedFileId = searchParams.get("sped_file_id");

    if (!spedFileId) {
      return NextResponse.json(
        { error: "sped_file_id é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar ajustes
    const { data: adjustments, error: adjError } = await supabaseAdmin
      .from("code_offset_adjustments")
      .select("id, cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value, created_at")
      .eq("sped_file_id", spedFileId)
      .order("created_at", { ascending: false });

    if (adjError) {
      throw new Error(`Erro ao buscar ajustes: ${adjError.message}`);
    }

    // Buscar descrições dos produtos
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("cod_item, descr_item")
      .eq("sped_file_id", spedFileId);

    const productMap = new Map<string, string>();
    products?.forEach((prod) => {
      const codItem = normalizeCodItem(prod.cod_item);
      productMap.set(codItem, prod.descr_item || "[Sem descrição]");
    });

    // Montar relatório consolidado
    const report = (adjustments ?? []).map((adj) => {
      const codNegativo = normalizeCodItem(adj.cod_negativo);
      const codPositivo = normalizeCodItem(adj.cod_positivo);

      return {
        id: adj.id,
        cod_negativo: codNegativo,
        descr_negativo: productMap.get(codNegativo) || "[Sem descrição]",
        cod_positivo: codPositivo,
        descr_positivo: productMap.get(codPositivo) || "[Sem descrição]",
        qtd_baixada: Number(adj.qtd_baixada),
        unit_cost: Number(adj.unit_cost),
        total_value: Number(adj.total_value),
        created_at: adj.created_at,
      };
    });

    // Calcular totais
    const totalAjustes = report.length;
    const totalQuantidadeBaixada = report.reduce(
      (acc, item) => acc + item.qtd_baixada,
      0
    );
    const totalValorBaixado = report.reduce(
      (acc, item) => acc + item.total_value,
      0
    );

    // Agrupar por código negativo (para ver impacto total por item)
    const impactoPorNegativo = new Map<
      string,
      { cod_item: string; descr: string; qtd_total: number; valor_total: number }
    >();

    report.forEach((item) => {
      const current = impactoPorNegativo.get(item.cod_negativo);
      if (current) {
        current.qtd_total += item.qtd_baixada;
        current.valor_total += item.total_value;
      } else {
        impactoPorNegativo.set(item.cod_negativo, {
          cod_item: item.cod_negativo,
          descr: item.descr_negativo,
          qtd_total: item.qtd_baixada,
          valor_total: item.total_value,
        });
      }
    });

    // Agrupar por código positivo (para ver quanto cada positivo forneceu)
    const impactoPorPositivo = new Map<
      string,
      { cod_item: string; descr: string; qtd_total: number; valor_total: number }
    >();

    report.forEach((item) => {
      const current = impactoPorPositivo.get(item.cod_positivo);
      if (current) {
        current.qtd_total += item.qtd_baixada;
        current.valor_total += item.total_value;
      } else {
        impactoPorPositivo.set(item.cod_positivo, {
          cod_item: item.cod_positivo,
          descr: item.descr_positivo,
          qtd_total: item.qtd_baixada,
          valor_total: item.total_value,
        });
      }
    });

    return NextResponse.json({
      ok: true,
      report,
      summary: {
        total_ajustes: totalAjustes,
        total_quantidade_baixada: totalQuantidadeBaixada,
        total_valor_baixado: totalValorBaixado,
      },
      impacto_por_negativo: Array.from(impactoPorNegativo.values()),
      impacto_por_positivo: Array.from(impactoPorPositivo.values()),
    });
  } catch (error) {
    console.error("Erro ao gerar relatório de ajustes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

