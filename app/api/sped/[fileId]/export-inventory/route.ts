import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getInventoryFinalData } from "@/lib/inventoryFinal";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Calcula o último dia do mês considerando anos bissextos
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Formata data no formato DDMMAAAA
 */
function formatDateDDMMAAAA(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, "0")}${String(month).padStart(2, "0")}${year}`;
}

/**
 * Formata número no formato N(19.6) - 13 inteiros + 6 decimais
 */
function formatNumber19_6(value: number): string {
  return value.toFixed(6);
}

/**
 * Formata número no formato N(19.2) - 17 inteiros + 2 decimais
 */
function formatNumber19_2(value: number): string {
  return value.toFixed(2);
}

/**
 * Formata número no formato N(17.2) - 13 inteiros + 2 decimais
 */
function formatNumber17_2(value: number): string {
  return value.toFixed(2);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const fileId = params.fileId;
    const periodId = searchParams.get("period_id");
    const xmlImportIdsParam = searchParams.get("xml_import_ids");

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId é obrigatório" },
        { status: 400 }
      );
    }

    // VALIDAÇÃO: periodId é obrigatório para gerar SPED
    if (!periodId) {
      return NextResponse.json(
        { error: "period_id é obrigatório para gerar arquivo SPED. Informe o ID do período." },
        { status: 400 }
      );
    }

    const format = searchParams.get("format") || "sped_txt";
    const removeZeros = searchParams.get("removeZeros") === "true";
    const removeNegatives = searchParams.get("removeNegatives") === "true";

    // VALIDAÇÃO: Buscar período e validar se existe
    const { data: period, error: periodError } = await supabaseAdmin
      .from("periods")
      .select("id, year, month")
      .eq("id", periodId)
      .single();

    if (periodError || !period) {
      return NextResponse.json(
        { error: `Período não encontrado. ID informado: ${periodId}. Verifique se o período existe no sistema.` },
        { status: 400 }
      );
    }

    if (!period.year || !period.month) {
      return NextResponse.json(
        { error: `Período inválido: ano ou mês não informado. Período ID: ${periodId}` },
        { status: 400 }
      );
    }

    // CRÍTICO: Buscar XMLs base do período (mesma lógica da API /api/inventory-final/data)
    // Isso garante que as saídas sejam calculadas corretamente no Excel e SPED TXT
    let xmlImportIds: string[] | undefined = undefined;

    if (periodId) {
      const { getBaseXmlImportsForPeriod } = await import("@/lib/periods");
      const baseXmlImportIds = await getBaseXmlImportsForPeriod(periodId);

      if (baseXmlImportIds.length > 0) {
        xmlImportIds = baseXmlImportIds;
        console.log(`[export-inventory] Usando ${baseXmlImportIds.length} XMLs base do período`);
      } else {
        console.warn(`[export-inventory] Nenhum XML base encontrado para o período ${periodId}`);
      }
    }

    // Se não há XMLs base ou não há período, tentar usar parâmetro de URL ou cookie como fallback
    if (!xmlImportIds || xmlImportIds.length === 0) {
      const cookieImportIdsRaw = req.cookies.get("selectedXmlImportIds")?.value ?? null;
      const cookieImportIds = cookieImportIdsRaw
        ? cookieImportIdsRaw.split(",").filter(Boolean)
        : null;

      if (xmlImportIdsParam) {
        xmlImportIds = xmlImportIdsParam.split(",").filter(Boolean);
        console.log(`[export-inventory] Usando XMLs do parâmetro de URL: ${xmlImportIds.length}`);
      } else if (cookieImportIds && cookieImportIds.length > 0) {
        xmlImportIds = cookieImportIds;
        console.log(`[export-inventory] Usando XMLs dos cookies: ${xmlImportIds.length}`);
      } else {
        console.warn(`[export-inventory] Nenhum XML disponível - saídas estarão zeradas`);
      }
    }

    const { items } = await getInventoryFinalData(fileId, periodId, {
      xmlImportIds: xmlImportIds ?? null,
    });

    // Aplicar filtros ANTES de calcular valores
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

    // Calcular data do último dia do mês do período (formato DDMMAAAA)
    const lastDay = getLastDayOfMonth(period.year, period.month);
    const dtInv = formatDateDDMMAAAA(period.year, period.month, lastDay);

    // Gerar arquivo conforme formato
    if (format === "sped_txt") {
      return generateSPEDFile(filteredItems, fileName, dtInv, periodId);
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
  dtInv: string,
  periodId: string
): NextResponse {
  const lines: string[] = [];
  const errors: string[] = [];

  // VALIDAÇÃO: Verificar se há itens para gerar
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Nenhum item encontrado para gerar o arquivo SPED. Verifique os filtros aplicados." },
      { status: 400 }
    );
  }

  // Validar cada item antes de processar
  items.forEach((item, index) => {
    // VALIDAÇÃO: Código do item obrigatório e normalizado
    if (!item.cod_item || item.cod_item.trim() === "") {
      errors.push(`Item na posição ${index + 1}: Código do item (COD_ITEM) não informado.`);
      return;
    }

    // VALIDAÇÃO: Código deve ter 6 dígitos (normalizado)
    if (item.cod_item.length !== 6 || !/^\d{6}$/.test(item.cod_item)) {
      errors.push(
        `Item ${item.cod_item} (posição ${index + 1}): Código do item deve ter exatamente 6 dígitos numéricos. Código atual: "${item.cod_item}" (${item.cod_item.length} caracteres).`
      );
      return;
    }

    // VALIDAÇÃO: Unidade de medida obrigatória
    if (!item.unid || item.unid.trim() === "") {
      errors.push(
        `Item ${item.cod_item} (posição ${index + 1}): Unidade de medida (UNID) não informada. Este item não possui registro no Bloco 020/0220 do SPED ou unidade não foi cadastrada.`
      );
      return;
    }

    // VALIDAÇÃO: Quantidade deve ser um número válido
    if (item.estoque_final === null || item.estoque_final === undefined || isNaN(item.estoque_final)) {
      errors.push(
        `Item ${item.cod_item} (posição ${index + 1}): Quantidade (QTD) inválida ou não informada.`
      );
      return;
    }

    // VALIDAÇÃO: Valor unitário deve ser um número válido
    if (item.unit_cost === null || item.unit_cost === undefined || isNaN(item.unit_cost)) {
      errors.push(
        `Item ${item.cod_item} (posição ${index + 1}): Valor unitário (VL_UNIT) inválido ou não informado.`
      );
      return;
    }

    // VALIDAÇÃO: Valor do item deve ser um número válido
    if (item.valor_estoque_final === null || item.valor_estoque_final === undefined || isNaN(item.valor_estoque_final)) {
      errors.push(
        `Item ${item.cod_item} (posição ${index + 1}): Valor do item (VL_ITEM) inválido ou não informado.`
      );
      return;
    }
  });

  // Se houver erros de validação, retornar todos de uma vez
  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: "Erros de validação encontrados nos itens do inventário:",
        details: errors,
      },
      { status: 400 }
    );
  }

  // Calcular valor total do inventário (VL_INV) - soma dos VL_ITEM dos itens filtrados
  const valorTotal = items.reduce(
    (acc, item) => acc + (item.valor_estoque_final || 0),
    0
  );

  // Formatar VL_INV: N(17.2) - 13 inteiros + 2 decimais, ponto como decimal
  const vlInv = formatNumber17_2(valorTotal);

  // Cabeçalho (H005)
  // |H005|DT_INV|VL_INV|MOT_INV|
  // DT_INV: DDMMAAAA
  // VL_INV: N(17.2) com ponto como decimal
  // MOT_INV: sempre "01"
  lines.push(`|H005|${dtInv}|${vlInv}|01|`);

  // Itens (H010)
  // |H010|COD_ITEM|UNID|QTD|VL_UNIT|VL_ITEM|IND_PROP|COD_PART|TXT_COMP|COD_CTA|VL_ITEM_IR|
  items.forEach((item) => {
    const codItem = item.cod_item; // Já normalizado com 6 dígitos
    const unid = item.unid; // Já validado acima
    const qtd = formatNumber19_6(item.estoque_final); // N(19.6) - 6 decimais, ponto
    const vlUnit = formatNumber19_6(item.unit_cost); // N(19.6) - 6 decimais, ponto
    const vlItem = formatNumber19_2(item.valor_estoque_final); // N(19.2) - 2 decimais, ponto
    const indProp = "0"; // Sempre 0
    const codPart = ""; // Vazio
    const txtComp = ""; // Vazio
    const codCta = "281"; // Sempre 281
    const vlItemIR = "0,00"; // Sempre 0,00 (vírgula como decimal)

    lines.push(
      `|H010|${codItem}|${unid}|${qtd}|${vlUnit}|${vlItem}|${indProp}|||${codCta}|${vlItemIR}|`
    );
  });

  // Rodapé (H990) - contagem de registros do bloco H (incluindo o próprio H990)
  lines.push(`|H990|${lines.length + 1}|`);

  const content = lines.join("\n");

  // Formatar nome do arquivo com data no formato DDMMAAAA
  const dateForFilename = dtInv; // Já está em DDMMAAAA

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventario_final_${fileName}_${dateForFilename}.txt"`,
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

