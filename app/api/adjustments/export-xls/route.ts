import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem } from "@/lib/utils";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const spedFileId = searchParams.get("sped_file_id");
    const periodId = searchParams.get("period_id");

    if (!spedFileId) {
      return NextResponse.json(
        { error: "sped_file_id é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar período ativo ou usar period_id da query string
    let activePeriod: { id: string; name: string } | null = null;
    
    if (periodId) {
      const { data: periodData } = await supabaseAdmin
        .from("periods")
        .select("id, name")
        .eq("id", periodId)
        .single();
      activePeriod = periodData || null;
    } else {
      const { data: periodData } = await supabaseAdmin
        .from("periods")
        .select("id, name")
        .eq("is_active", true)
        .single();
      activePeriod = periodData || null;
    }

    // Buscar ajustes (do arquivo SPED e do período ativo se existir)
    let adjustmentsQuery = supabaseAdmin
      .from("code_offset_adjustments")
      .select("id, cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value, created_at, period_id")
      .eq("sped_file_id", spedFileId);

    if (activePeriod) {
      adjustmentsQuery = adjustmentsQuery.or(`period_id.eq.${activePeriod.id},period_id.is.null`);
    }

    adjustmentsQuery = adjustmentsQuery.order("created_at", { ascending: false });

    const { data: adjustments, error: adjError } = await adjustmentsQuery;

    if (adjError) {
      throw new Error(`Erro ao buscar ajustes: ${adjError.message}`);
    }

    if (!adjustments || adjustments.length === 0) {
      return NextResponse.json(
        { error: "Nenhum ajuste encontrado para exportar" },
        { status: 404 }
      );
    }

    // Buscar todos os códigos únicos (positivos e negativos)
    const codigosUnicos = new Set<string>();
    adjustments.forEach((adj) => {
      codigosUnicos.add(normalizeCodItem(adj.cod_negativo));
      codigosUnicos.add(normalizeCodItem(adj.cod_positivo));
    });

    // Buscar descrições dos produtos do SPED
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("cod_item, descr_item")
      .eq("sped_file_id", spedFileId);

    const productMap = new Map<string, string>();
    products?.forEach((prod) => {
      const codItem = normalizeCodItem(prod.cod_item);
      if (codigosUnicos.has(codItem)) {
        productMap.set(codItem, prod.descr_item || "[Sem descrição]");
      }
    });

    // Buscar descrições do catálogo de produtos (fallback)
    const codigosSemDescricao = Array.from(codigosUnicos).filter(
      (cod) => !productMap.has(cod)
    );

    if (codigosSemDescricao.length > 0) {
      const { data: catalogProducts } = await supabaseAdmin
        .from("product_catalog")
        .select("cod_item, descr_item")
        .in("cod_item", codigosSemDescricao);

      catalogProducts?.forEach((prod) => {
        const codItem = normalizeCodItem(prod.cod_item);
        if (!productMap.has(codItem)) {
          productMap.set(codItem, prod.descr_item || "[Sem descrição]");
        }
      });
    }

    // Montar dados para exportação
    const exportData = adjustments.map((adj) => {
      const codNegativo = normalizeCodItem(adj.cod_negativo);
      const codPositivo = normalizeCodItem(adj.cod_positivo);
      const qtdBaixada = Number(adj.qtd_baixada);
      const custoUnitario = Number(adj.unit_cost);
      const impactoFinanceiro = qtdBaixada * custoUnitario;

      return {
        "CÓDIGO EQUIVOCADO": codNegativo,
        "CÓDIGO ADEQUADO": codPositivo,
        "DESCRIÇÃO DO CÓDIGO AJUSTADO": productMap.get(codPositivo) || "[Sem descrição]",
        "DESCRIÇÃO ITEM INADEQUADO": productMap.get(codNegativo) || "[Sem descrição]",
        "QUANTIDADE BAIXADA": qtdBaixada,
        "CUSTO UNITÁRIO": custoUnitario,
        "IMPACTO FINANCEIRO": impactoFinanceiro,
      };
    });

    // Criar workbook
    const workbook = XLSX.utils.book_new();

    // Criar cabeçalho com período
    const periodoNome = activePeriod?.name || "Período não especificado";
    const headerRow = [["CORREÇÕES REALIZADAS NO PERÍODO DE " + periodoNome]];
    
    // Criar sheet final combinado
    const combinedSheet = XLSX.utils.aoa_to_sheet([
      headerRow[0],
      [""],
      Object.keys(exportData[0]),
      ...exportData.map((row) => Object.values(row)),
    ]);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 20 }, // CÓDIGO EQUIVOCADO
      { wch: 20 }, // CÓDIGO ADEQUADO
      { wch: 50 }, // DESCRIÇÃO DO CÓDIGO AJUSTADO
      { wch: 50 }, // DESCRIÇÃO ITEM INADEQUADO
      { wch: 18 }, // QUANTIDADE BAIXADA
      { wch: 18 }, // CUSTO UNITÁRIO
      { wch: 20 }, // IMPACTO FINANCEIRO
    ];
    combinedSheet["!cols"] = colWidths;

    // Mesclar célula do cabeçalho
    combinedSheet["!merges"] = [
      {
        s: { c: 0, r: 0 },
        e: { c: 6, r: 0 },
      },
    ];

    XLSX.utils.book_append_sheet(workbook, combinedSheet, "Correções");

    // Gerar buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Nome do arquivo
    const periodoNomeSanitizado = periodoNome.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `correcoes_periodo_${periodoNomeSanitizado}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao exportar ajustes em XLS:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

