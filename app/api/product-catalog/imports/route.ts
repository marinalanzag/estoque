import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const periodId = req.nextUrl.searchParams.get("periodId");

    let query = supabaseAdmin
      .from("product_catalog_imports")
      .select("id, label, file_name, total_items, created_at, period_id")
      .order("created_at", { ascending: false });

    if (periodId === "null") {
      query = query.is("period_id", null);
    } else if (periodId) {
      query = query.eq("period_id", periodId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      imports: data ?? [],
    });
  } catch (error) {
    console.error("[api/product-catalog/imports] Erro:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao listar importações do cadastro.",
      },
      { status: 500 }
    );
  }
}









