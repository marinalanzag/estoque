import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const adjustmentId = searchParams.get("id");

    if (!adjustmentId) {
      return NextResponse.json(
        { error: "ID do ajuste é obrigatório" },
        { status: 400 }
      );
    }

    // Deletar ajuste
    const { error } = await supabaseAdmin
      .from("code_offset_adjustments")
      .delete()
      .eq("id", adjustmentId);

    if (error) {
      console.error("Erro ao deletar ajuste:", error);
      return NextResponse.json(
        { error: `Erro ao deletar ajuste: ${error.message}` },
        { status: 500 }
      );
    }

    // Revalidar as rotas afetadas
    revalidatePath("/inventario-final");
    revalidatePath("/api/inventory-final/data");
    revalidatePath("/movimentacoes/consolidado");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}









