import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getInventoryFinalData } from "@/lib/inventoryFinal";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const fileId = params.fileId;

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId é obrigatório" },
        { status: 400 }
      );
    }

    const format = searchParams.get("format") || "sped_txt";
    const removeZeros = searchParams.get("removeZeros") === "true";
    const removeNegatives = searchParams.get("removeNegatives") === "true";

    // Buscar dados do inventário final
    const { items } = await getInventoryFinalData(supabaseAdmin, fileId);

    // Aplicar filtros
    let filteredItems = items;
    if (removeZeros) {
      filteredItems = filteredItems.filter((item) => item.estoque_final !== 0);
    }
    if (removeNegatives) {
      filteredItems = filteredItems.filter((item) => item.estoque_final >= 0);
    }

    // Buscar informações do arquivo SPED
    const { data: spedFile } = await supabaseAdmin
      .from("sped_files")
      .select("name, year, period")
      .eq("id", fileId)
      .single();

    const fileName = spedFile?.name || fileId;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

    // Gerar arquivo conforme formato
    if (format === "sped_txt") {
      return generateSPEDFile(filteredItems, fileName, dateStr);
    } else if (format === "xlsx") {
      return generateXLSXFile(filteredItems, fileName);
    } else if (format === "csv") {
      return generateCSVFile(filteredItems, fileName);
    } else {
      return NextResponse.json(
        { error: "Formato inválido. Use: sped_txt, xlsx ou csv" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Erro ao exportar inventário:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

function generateSPEDFile(
  items: any[],
  fileName: string,
  dateStr: string
): NextResponse {
  const lines: string[] = [];

  // Calcular valor total do inventário
  const valorTotal = items.reduce(
    (acc, item) => acc + item.valor_estoque_final,
    0
  );

  // Cabeçalho (H005)
  // |H005|DT_INV|VL_INV|MOT_INV|
  lines.push(
    `|H005|${dateStr}|${valorTotal.toFixed(2).replace(".", ",")}|INVENTARIO FINAL AJUSTADO|`
  );

  // Itens (H010)
  // |H010|COD_ITEM|UNID|QTD|VL_UNIT|VL_ITEM|
  items.forEach((item) => {
    const codItem = item.cod_item;
    const unid = item.unid || "UN";
    const qtd = item.estoque_final.toFixed(3).replace(".", ",");
    const vlUnit = item.unit_cost.toFixed(2).replace(".", ",");
    const vlItem = item.valor_estoque_final.toFixed(2).replace(".", ",");

    lines.push(`|H010|${codItem}|${unid}|${qtd}|${vlUnit}|${vlItem}|`);
  });

  // Rodapé (H990) - contagem de registros
  lines.push(`|H990|${lines.length + 1}|`);

  const content = lines.join("\n");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario_final_${fileName}_${dateStr}.txt"`,
    },
  });
}

function generateXLSXFile(items: any[], fileName: string): NextResponse {
  const workbook = XLSX.utils.book_new();

  // Aba 1: Inventário Final
  const inventoryRows = items.map((item) => ({
    Código: item.cod_item,
    Descrição: item.descr_item || "[Sem descrição]",
    Unidade: item.unid || "UN",
    "Estoque Inicial": item.estoque_inicial,
    Entradas: item.entradas,
    Saídas: item.saidas,
    "Estoque Teórico": item.estoque_teorico,
    "Ajustes Recebidos": item.ajustes_recebidos,
    "Ajustes Fornecidos": item.ajustes_fornecidos,
    "Ajuste Quantidade": item.ajustes_recebidos - item.ajustes_fornecidos,
    "Estoque Final": item.estoque_final,
    "Custo Médio": item.unit_cost,
    "Valor Estoque Final": item.valor_estoque_final,
  }));

  const inventorySheet = XLSX.utils.json_to_sheet(inventoryRows);
  XLSX.utils.book_append_sheet(workbook, inventorySheet, "Inventário Final");

  // Aba 2: Resumo
  const totalItens = items.length;
  const totalQuantidade = items.reduce((acc, item) => acc + item.estoque_final, 0);
  const totalValor = items.reduce((acc, item) => acc + item.valor_estoque_final, 0);
  const itensNegativos = items.filter((item) => item.estoque_final < 0).length;
  const itensPositivos = items.filter((item) => item.estoque_final > 0).length;
  const itensZerados = items.filter((item) => item.estoque_final === 0).length;

  const summaryRows = [
    { Métrica: "Total de Itens", Valor: totalItens },
    { Métrica: "Quantidade Total", Valor: totalQuantidade },
    { Métrica: "Valor Total", Valor: totalValor },
    { Métrica: "Itens Positivos", Valor: itensPositivos },
    { Métrica: "Itens Negativos", Valor: itensNegativos },
    { Métrica: "Itens Zerados", Valor: itensZerados },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inventario_final_${fileName}.xlsx"`,
    },
  });
}

function generateCSVFile(items: any[], fileName: string): NextResponse {
  const headers = [
    "Código",
    "Descrição",
    "Unidade",
    "Estoque Inicial",
    "Entradas",
    "Saídas",
    "Estoque Teórico",
    "Ajustes Recebidos",
    "Ajustes Fornecidos",
    "Ajuste Quantidade",
    "Estoque Final",
    "Custo Médio",
    "Valor Estoque Final",
  ];

  const rows = items.map((item) => [
    item.cod_item,
    item.descr_item || "[Sem descrição]",
    item.unid || "UN",
    item.estoque_inicial.toFixed(2),
    item.entradas.toFixed(2),
    item.saidas.toFixed(2),
    item.estoque_teorico.toFixed(2),
    item.ajustes_recebidos.toFixed(2),
    item.ajustes_fornecidos.toFixed(2),
    (item.ajustes_recebidos - item.ajustes_fornecidos).toFixed(2),
    item.estoque_final.toFixed(2),
    item.unit_cost.toFixed(2),
    item.valor_estoque_final.toFixed(2),
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.join(";")),
  ].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario_final_${fileName}.csv"`,
    },
  });
}

