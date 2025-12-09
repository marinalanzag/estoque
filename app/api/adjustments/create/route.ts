import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem } from "@/lib/utils";
import { getActivePeriod } from "@/lib/periods";
import { revalidatePath } from "next/cache";

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

    // Buscar período ativo usando helper que lida com múltiplos períodos ativos
    const activePeriod = await getActivePeriod();
    const periodId = activePeriod?.id || null;
    
    console.log("[api/adjustments/create] Período ativo encontrado:", periodId || "nenhum");
    if (!periodId) {
      console.warn("[api/adjustments/create] ⚠️ ATENÇÃO: Nenhum período ativo encontrado! O ajuste será criado sem period_id.");
    }

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
        period_id: periodId,
      })
      .select()
      .single();

    if (error) {
      console.error("[api/adjustments/create] ❌ Erro ao criar ajuste:", error);
      return NextResponse.json(
        { error: `Erro ao criar ajuste: ${error.message}` },
        { status: 500 }
      );
    }

    console.log("[api/adjustments/create] ✅ Ajuste criado com sucesso:", {
      id: data.id,
      cod_negativo: data.cod_negativo,
      cod_positivo: data.cod_positivo,
      period_id: data.period_id,
      sped_file_id: data.sped_file_id,
    });

    // ✅ CRÍTICO: Revalidar TODAS as rotas afetadas pela criação do ajuste
    const rotasParaRevalidar = [
      // Páginas
      "/ajustes",
      "/inventario-final",
      "/movimentacoes/consolidado",

      // APIs de dados
      "/api/adjustments/inventory-data",
      "/api/adjustments/list",
      "/api/inventory-final/data",
      "/api/consolidado/data",
    ];

    console.log(`[CREATE] Revalidando ${rotasParaRevalidar.length} rotas...`);
    rotasParaRevalidar.forEach(rota => {
      try {
        revalidatePath(rota);
        console.log(`[CREATE] ✅ Revalidado: ${rota}`);
      } catch (err) {
        console.error(`[CREATE] ⚠️ Erro ao revalidar ${rota}:`, err);
      }
    });

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

