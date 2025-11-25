import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

// Rota para verificar se as saídas estão sendo gravadas corretamente
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId é obrigatório" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verificar documentos de saída (ind_oper = '1')
    const { data: documentsSaida, error: docsError } = await supabaseAdmin
      .from("documents")
      .select("id, chv_nfe, ind_oper")
      .eq("sped_file_id", fileId)
      .eq("ind_oper", "1");

    // Verificar document_items de saída
    const { data: itemsSaida, error: itemsError } = await supabaseAdmin
      .from("document_items")
      .select(`
        id,
        cod_item,
        movement_type,
        movement_qty,
        vl_item,
        document_id,
        documents!inner (
          id,
          sped_file_id,
          ind_oper,
          chv_nfe
        )
      `)
      .eq("documents.sped_file_id", fileId)
      .eq("movement_type", "saida");

    // Verificar document_items sem movement_type mas com ind_oper = '1'
    const { data: itemsSemTipo, error: itemsSemTipoError } = await supabaseAdmin
      .from("document_items")
      .select(`
        id,
        cod_item,
        movement_type,
        movement_qty,
        vl_item,
        document_id,
        documents!inner (
          id,
          sped_file_id,
          ind_oper,
          chv_nfe
        )
      `)
      .eq("documents.sped_file_id", fileId)
      .is("movement_type", null)
      .eq("documents.ind_oper", "1");

    // Estatísticas
    const totalDocumentosSaida = documentsSaida?.length || 0;
    const totalItemsSaida = itemsSaida?.length || 0;
    const totalItemsSemTipo = itemsSemTipo?.length || 0;
    const totalQtdSaida = itemsSaida?.reduce((sum, item) => sum + Math.abs(item.movement_qty || 0), 0) || 0;

    return NextResponse.json({
      ok: true,
      fileId,
      estatisticas: {
        documentos_saida: totalDocumentosSaida,
        items_com_movement_type_saida: totalItemsSaida,
        items_sem_tipo_com_ind_oper_1: totalItemsSemTipo,
        quantidade_total_saida: totalQtdSaida,
      },
      documentos: documentsSaida?.slice(0, 10) || [],
      items_amostra: itemsSaida?.slice(0, 10) || [],
      items_sem_tipo_amostra: itemsSemTipo?.slice(0, 10) || [],
    });
  } catch (error) {
    console.error("[api/sped/verify-sales] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao verificar saídas", detail: String(error) },
      { status: 500 }
    );
  }
}

