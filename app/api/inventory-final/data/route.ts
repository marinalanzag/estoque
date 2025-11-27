import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getInventoryFinalData } from "@/lib/inventoryFinal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
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

    const cookieStore = cookies();
    const cookieImportIdsRaw =
      cookieStore.get("selectedXmlImportIds")?.value ?? null;
    const cookieImportIds = cookieImportIdsRaw
      ? cookieImportIdsRaw.split(",").filter(Boolean)
      : null;
    const xmlImportIds = xmlImportIdsParam
      ? xmlImportIdsParam.split(",").filter(Boolean)
      : cookieImportIds ?? undefined;

    const { items, summary } = await getInventoryFinalData(
      spedFileId,
      periodId,
      { xmlImportIds }
    );

    return NextResponse.json({
      ok: true,
      items,
      summary,
    });
  } catch (error) {
    console.error("Erro ao buscar inventário final:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

