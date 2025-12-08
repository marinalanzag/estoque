import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getSupabaseAdmin } from "@/lib/supabaseServer";

async function manualDelete() {
    const admin = getSupabaseAdmin();
    const target = "011141";

    // 1. Get current adjustments
    const { data: before } = await admin
        .from("code_offset_adjustments")
        .select("*")
        .or(`cod_positivo.ilike.%${target}%,cod_negativo.ilike.%${target}%`);

    console.log(`📊 Ajustes ANTES da exclusão: ${before?.length || 0}`);
    before?.forEach(adj => {
        console.log(`   - ID: ${adj.id.substring(0, 8)} | ${adj.cod_positivo} -> ${adj.cod_negativo} : ${adj.qtd_baixada}`);
    });

    if (!before || before.length === 0) {
        console.log("✅ Nenhum ajuste para deletar!");
        return;
    }

    // 2. Delete the +28 adjustment (from 013671 to 011141)
    const adjustmentToDelete = before.find(a =>
        a.cod_positivo === "013671" && a.cod_negativo === "011141"
    );

    if (!adjustmentToDelete) {
        console.log("⚠️  Ajuste de +28 não encontrado.");
        return;
    }

    console.log(`\n🗑️  Deletando ajuste: ${adjustmentToDelete.id}`);

    const { error } = await admin
        .from("code_offset_adjustments")
        .delete()
        .eq("id", adjustmentToDelete.id);

    if (error) {
        console.error("❌ Erro ao deletar:", error);
        return;
    }

    console.log("✅ Ajuste deletado com sucesso!");

    // 3. Verify deletion
    const { data: after } = await admin
        .from("code_offset_adjustments")
        .select("*")
        .or(`cod_positivo.ilike.%${target}%,cod_negativo.ilike.%${target}%`);

    console.log(`\n📊 Ajustes DEPOIS da exclusão: ${after?.length || 0}`);
    after?.forEach(adj => {
        console.log(`   - ID: ${adj.id.substring(0, 8)} | ${adj.cod_positivo} -> ${adj.cod_negativo} : ${adj.qtd_baixada}`);
    });

    if ((after?.length || 0) === 0) {
        console.log("\n🎉 Sucesso! Todos os ajustes foram removidos.");
    }
}

manualDelete().catch(console.error);
