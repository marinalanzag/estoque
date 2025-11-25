import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getInventoryFinalData } from "@/lib/inventoryFinal";
import * as XLSX from "xlsx";

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

    // Buscar dados do inventário final
    const { items, summary } = await getInventoryFinalData(supabaseAdmin, spedFileId);

    // Buscar informações do arquivo SPED
    const { data: spedFile } = await supabaseAdmin
      .from("sped_files")
      .select("name")
      .eq("id", spedFileId)
      .single();

    // Criar workbook
    const workbook = XLSX.utils.book_new();

    // Aba 1: Inventário Final
    const inventoryRows = items.map((item) => ({
      "Código": item.cod_item,
      "Descrição": item.descr_item || "[Sem descrição]",
      "Unidade": item.unid || "UN",
      "Estoque Inicial": item.estoque_inicial,
      "Entradas": item.entradas,
      "Saídas": item.saidas,
      "Estoque Teórico": item.estoque_teorico,
      "Ajustes Recebidos": item.ajustes_recebidos,
      "Ajustes Fornecidos": item.ajustes_fornecidos,
      "Estoque Final": item.estoque_final,
      "Custo Unitário": item.unit_cost,
      "Valor Total": item.valor_estoque_final,
    }));

    const inventorySheet = XLSX.utils.json_to_sheet(inventoryRows);
    XLSX.utils.book_append_sheet(workbook, inventorySheet, "Inventário Final");

    // Aba 2: Resumo
    const summaryRows = [
      { "Métrica": "Total de Itens", "Valor": summary.total_itens },
      { "Métrica": "Quantidade Total", "Valor": summary.total_quantidade },
      { "Métrica": "Valor Total", "Valor": summary.total_valor },
      { "Métrica": "Itens Positivos", "Valor": summary.itens_positivos },
      { "Métrica": "Itens Negativos", "Valor": summary.itens_negativos },
      { "Métrica": "Itens Zerados", "Valor": summary.itens_zerados },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

    // Gerar buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Retornar como download
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inventario_final_${spedFile?.name || spedFileId}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar arquivo XLSX:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

