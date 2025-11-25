import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const documentItemId = body.documentItemId as string | undefined;
    const adjustedQty =
      body.adjustedQty === null || body.adjustedQty === undefined
        ? null
        : Number(body.adjustedQty);
    const reason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : null;

    if (!documentItemId) {
      return NextResponse.json(
        { error: "documentItemId é obrigatório" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    if (adjustedQty === null) {
      const { error: deleteError } = await supabaseAdmin
        .from("document_item_adjustments")
        .delete()
        .eq("document_item_id", documentItemId);

      if (deleteError) {
        console.error("Erro ao remover ajuste:", deleteError);
        return NextResponse.json(
          { error: `Erro ao remover ajuste: ${deleteError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, removed: true });
    }

    if (Number.isNaN(adjustedQty)) {
      return NextResponse.json(
        { error: "adjustedQty inválido" },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from("document_item_adjustments")
      .upsert(
        {
          document_item_id: documentItemId,
          adjusted_qty: adjustedQty,
          reason,
        },
        { onConflict: "document_item_id" }
      );

    if (upsertError) {
      console.error("Erro ao salvar ajuste:", upsertError);
      return NextResponse.json(
        { error: `Erro ao salvar ajuste: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro inesperado ao ajustar quantidade:", error);
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao ajustar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

