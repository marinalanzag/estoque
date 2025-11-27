import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json();

    const { importId, importIds } = body;

    // Suportar tanto um único importId quanto múltiplos importIds
    const idsToLink = importIds && Array.isArray(importIds) ? importIds : (importId ? [importId] : []);

    if (idsToLink.length === 0) {
      return NextResponse.json(
        { ok: false, error: "importId ou importIds é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar período ativo
    const { data: activePeriod } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("is_active", true)
      .single();

    if (!activePeriod) {
      return NextResponse.json(
        { ok: false, error: "Nenhum período ativo encontrado. Ative um período primeiro." },
        { status: 400 }
      );
    }

    // Vincular imports ao período ativo
    const { data, error } = await supabaseAdmin
      .from("xml_sales_imports")
      .update({ period_id: activePeriod.id })
      .in("id", idsToLink)
      .select();

    if (error) {
      console.error("Erro ao vincular imports de XMLs ao período:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      imports: data,
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("Erro ao vincular imports de XMLs ao período:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

