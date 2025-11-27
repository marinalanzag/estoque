import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  // Log MUITO VISÍVEL no início da função
  console.error("\n\n");
  console.error("╔══════════════════════════════════════════════════════════════╗");
  console.error("║  🚀🚀🚀 [SALVAR AJUSTE] API CHAMADA - INÍCIO 🚀🚀🚀          ║");
  console.error("╚══════════════════════════════════════════════════════════════╝");
  console.error("\n");
  
  try {
    const body = await req.json();
    
    // ============================================================================
    // LOGS DETALHADOS DO PAYLOAD RECEBIDO
    // ============================================================================
    // Usar console.error para garantir que apareça no terminal
    console.error("========================================");
    console.error("🚀🚀🚀 [SALVAR AJUSTE] API CHAMADA 🚀🚀🚀");
    console.error("========================================");
    console.error("[SALVAR AJUSTE] Payload recebido:", JSON.stringify(body, null, 2));
    console.error("[SALVAR AJUSTE] documentItemId:", body.documentItemId);
    console.error("[SALVAR AJUSTE] adjustedQty (raw):", body.adjustedQty);
    console.error("[SALVAR AJUSTE] reason:", body.reason);
    console.error("========================================");
    
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
      console.error("[SALVAR AJUSTE] ❌ ERRO: documentItemId é obrigatório");
      return NextResponse.json(
        { error: "documentItemId é obrigatório" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    
    // ============================================================================
    // VERIFICAR SE O document_item_id EXISTE NO BANCO
    // ============================================================================
    const { data: itemExists, error: itemError } = await supabaseAdmin
      .from("document_items")
      .select("id, cod_item, document_id")
      .eq("id", documentItemId)
      .single();
    
    if (itemError || !itemExists) {
      console.error("[SALVAR AJUSTE] ❌ ERRO: document_item_id não encontrado no banco:", documentItemId);
      console.error("[SALVAR AJUSTE] Erro da query:", itemError);
      return NextResponse.json(
        { error: `document_item_id não encontrado: ${documentItemId}` },
        { status: 404 }
      );
    }
    
    console.error("[SALVAR AJUSTE] ✅ document_item_id encontrado no banco:");
    console.error("[SALVAR AJUSTE]   - id:", itemExists.id);
    console.error("[SALVAR AJUSTE]   - cod_item:", itemExists.cod_item);
    console.error("[SALVAR AJUSTE]   - document_id:", itemExists.document_id);

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
      console.error("[SALVAR AJUSTE] ❌ ERRO: adjustedQty inválido:", adjustedQty);
      return NextResponse.json(
        { error: "adjustedQty inválido" },
        { status: 400 }
      );
    }

    // ============================================================================
    // LOGS ANTES DE SALVAR
    // ============================================================================
    console.error("[SALVAR AJUSTE] Dados que serão salvos:");
    console.error("[SALVAR AJUSTE]   - document_item_id:", documentItemId);
    console.error("[SALVAR AJUSTE]   - adjusted_qty:", adjustedQty);
    console.error("[SALVAR AJUSTE]   - reason:", reason);
    console.error("[SALVAR AJUSTE]   - NOTA: A tabela document_item_adjustments NÃO tem campo period_id");

    const payloadToSave = {
      document_item_id: documentItemId,
      adjusted_qty: adjustedQty,
      reason,
    };
    
    console.error("[SALVAR AJUSTE] Payload completo para upsert:", JSON.stringify(payloadToSave, null, 2));

    const { data: savedData, error: upsertError } = await supabaseAdmin
      .from("document_item_adjustments")
      .upsert(
        payloadToSave,
        { onConflict: "document_item_id" }
      )
      .select();

    if (upsertError) {
      console.error("[SALVAR AJUSTE] ❌ ERRO ao salvar ajuste:", upsertError);
      console.error("[SALVAR AJUSTE] Detalhes do erro:", JSON.stringify(upsertError, null, 2));
      return NextResponse.json(
        { error: `Erro ao salvar ajuste: ${upsertError.message}` },
        { status: 500 }
      );
    }

    console.error("[SALVAR AJUSTE] ✅ Ajuste salvo com sucesso!");
    console.error("[SALVAR AJUSTE] Dados retornados:", JSON.stringify(savedData, null, 2));
    
    // ============================================================================
    // VERIFICAR SE O AJUSTE FOI REALMENTE SALVO (BUSCAR NO BANCO)
    // ============================================================================
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from("document_item_adjustments")
      .select("id, document_item_id, adjusted_qty, reason, updated_at")
      .eq("document_item_id", documentItemId)
      .single();
    
    if (verifyError || !verifyData) {
      console.error("[SALVAR AJUSTE] ⚠️ AVISO: Não foi possível verificar o ajuste salvo:", verifyError);
    } else {
      console.error("[SALVAR AJUSTE] ✅ VERIFICAÇÃO: Ajuste confirmado no banco:");
      console.error("[SALVAR AJUSTE]   - id:", verifyData.id);
      console.error("[SALVAR AJUSTE]   - document_item_id:", verifyData.document_item_id);
      console.error("[SALVAR AJUSTE]   - adjusted_qty:", verifyData.adjusted_qty);
      console.error("[SALVAR AJUSTE]   - reason:", verifyData.reason);
      console.error("[SALVAR AJUSTE]   - updated_at:", verifyData.updated_at);
    }
    
    console.error("========================================");
    console.error("✅✅✅ [SALVAR AJUSTE] FINALIZADO ✅✅✅");
    console.error("========================================");

    return NextResponse.json({ 
      ok: true,
      data: savedData?.[0] || null 
    });
  } catch (error) {
    console.error("Erro inesperado ao ajustar quantidade:", error);
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao ajustar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

