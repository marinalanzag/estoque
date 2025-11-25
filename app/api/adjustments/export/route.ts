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
    const format = searchParams.get("format") || "xlsx";

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

    // Buscar informações do arquivo SPED
    const { data: spedFile } = await supabaseAdmin
      .from("sped_files")
      .select("name")
      .eq("id", spedFileId)
      .single();

    const fileName = spedFile?.name || spedFileId;

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

    // Agrupar por código negativo
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

    // Agrupar por código positivo
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

    if (format === "xlsx") {
      return generateXLSXFile(report, impactoPorNegativo, impactoPorPositivo, {
        totalAjustes,
        totalQuantidadeBaixada,
        totalValorBaixado,
      }, fileName);
    } else if (format === "csv") {
      return generateCSVFile(report, fileName);
    } else {
      return NextResponse.json(
        { error: "Formato inválido. Use: xlsx ou csv" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Erro ao exportar relatório de ajustes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

function generateXLSXFile(
  report: any[],
  impactoNegativo: Map<string, any>,
  impactoPositivo: Map<string, any>,
  summary: any,
  fileName: string
): NextResponse {
  const workbook = XLSX.utils.book_new();

  // Aba 1: Ajustes Detalhados
  const reportRows = report.map((item) => ({
    Data: new Date(item.created_at).toLocaleString("pt-BR"),
    "Código Negativo": item.cod_negativo,
    "Descrição Negativo": item.descr_negativo,
    "Código Positivo": item.cod_positivo,
    "Descrição Positivo": item.descr_positivo,
    "Quantidade Baixada": item.qtd_baixada,
    "Custo Unitário": item.unit_cost,
    "Impacto Financeiro": item.total_value,
  }));

  const reportSheet = XLSX.utils.json_to_sheet(reportRows);
  XLSX.utils.book_append_sheet(workbook, reportSheet, "Ajustes Detalhados");

  // Aba 2: Impacto por Código Negativo
  const impactoNegativoRows = Array.from(impactoNegativo.values()).map((item) => ({
    "Código": item.cod_item,
    "Descrição": item.descr,
    "Quantidade Total Recebida": item.qtd_total,
    "Valor Total Recebido": item.valor_total,
  }));

  const impactoNegativoSheet = XLSX.utils.json_to_sheet(impactoNegativoRows);
  XLSX.utils.book_append_sheet(workbook, impactoNegativoSheet, "Impacto Negativo");

  // Aba 3: Impacto por Código Positivo
  const impactoPositivoRows = Array.from(impactoPositivo.values()).map((item) => ({
    "Código": item.cod_item,
    "Descrição": item.descr,
    "Quantidade Total Fornecida": item.qtd_total,
    "Valor Total Fornecido": item.valor_total,
  }));

  const impactoPositivoSheet = XLSX.utils.json_to_sheet(impactoPositivoRows);
  XLSX.utils.book_append_sheet(workbook, impactoPositivoSheet, "Impacto Positivo");

  // Aba 4: Resumo
  const summaryRows = [
    { "Métrica": "Total de Ajustes", "Valor": summary.totalAjustes },
    { "Métrica": "Quantidade Total Baixada", "Valor": summary.totalQuantidadeBaixada },
    { "Métrica": "Valor Total Baixado", "Valor": summary.totalValorBaixado },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="relatorio_ajustes_${fileName}.xlsx"`,
    },
  });
}

function generateCSVFile(report: any[], fileName: string): NextResponse {
  const headers = [
    "Data",
    "Código Negativo",
    "Descrição Negativo",
    "Código Positivo",
    "Descrição Positivo",
    "Quantidade Baixada",
    "Custo Unitário",
    "Impacto Financeiro",
  ];

  const rows = report.map((item) => [
    new Date(item.created_at).toLocaleString("pt-BR"),
    item.cod_negativo,
    item.descr_negativo,
    item.cod_positivo,
    item.descr_positivo,
    item.qtd_baixada.toFixed(2),
    item.unit_cost.toFixed(2),
    item.total_value.toFixed(2),
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.join(";")),
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio_ajustes_${fileName}.csv"`,
    },
  });
}

