import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getInventoryFinalData } from "@/lib/inventoryFinal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const spedFileId = searchParams.get("sped_file_id");
    const periodId = searchParams.get("period_id");
    const xmlImportIdsParam = searchParams.get("xml_import_ids");

    if (!spedFileId) {
      return NextResponse.json(
        { error: "sped_file_id é obrigatório" },
        { status: 400 }
      );
    }

    const cookieImportIdsRaw =
      req.cookies.get("selectedXmlImportIds")?.value ?? null;
    const cookieImportIds = cookieImportIdsRaw
      ? cookieImportIdsRaw.split(",").filter(Boolean)
      : null;
    const xmlImportIds = xmlImportIdsParam
      ? xmlImportIdsParam.split(",").filter(Boolean)
      : cookieImportIds ?? undefined;

    // Buscar dados do inventário final
    const { items } = await getInventoryFinalData(spedFileId, periodId, {
      xmlImportIds,
    });

    // Buscar informações do arquivo SPED
    const { data: spedFile } = await supabaseAdmin
      .from("sped_files")
      .select("name, year, period")
      .eq("id", spedFileId)
      .single();

    // Gerar arquivo SPED H010
    const lines: string[] = [];

    // Calcular valor total do inventário
    const valorTotal = items
      .filter((item) => item.estoque_final > 0)
      .reduce((acc, item) => acc + (item.valor_estoque_final || 0), 0);

    // Cabeçalho (H005)
    const today = new Date();
    const dtInv = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const vlInv = valorTotal.toFixed(2).replace(".", ",");
    lines.push(`|H005|${dtInv}|${vlInv}|01|`);

    // Itens (H010) - apenas itens com estoque final > 0
    items
      .filter((item) => item.estoque_final > 0)
      .forEach((item) => {
        const codItem = item.cod_item;
        const unid = item.unid || "UN";

        // FONTE DA VERDADE: VL_ITEM (valor total)
        // VL_UNIT é CALCULADO como VL_ITEM ÷ QTD (padrão fiscal SPED)
        const quantidade = item.estoque_final;
        const valorTotal = item.valor_estoque_final;

        // 1. QTD: 6 decimais com vírgula
        const qtd = quantidade.toFixed(6).replace(".", ",");

        // 2. VL_UNIT: Calculado = VL_ITEM ÷ QTD, 6 decimais com vírgula
        const vlUnitCalculado = valorTotal / quantidade;
        const vlUnit = vlUnitCalculado.toFixed(6).replace(".", ",");

        // 3. VL_ITEM: 2 decimais com vírgula
        const vlItem = valorTotal.toFixed(2).replace(".", ",");

        // 4. Campos fixos obrigatórios
        const indProp = "0"; // Sempre 0
        const codCta = "281"; // Sempre 281
        const vlItemIR = "0,00"; // Sempre 0,00

        lines.push(`|H010|${codItem}|${unid}|${qtd}|${vlUnit}|${vlItem}|${indProp}|||${codCta}|${vlItemIR}|`);
      });

    // Rodapé (H990)
    lines.push(`|H990|${lines.length + 1}|`);

    const content = lines.join("\n");

    // Retornar como download
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventario_final_${spedFile?.name || spedFileId}.txt"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar arquivo SPED:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

