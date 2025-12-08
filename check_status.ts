
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getSupabaseAdmin } from "@/lib/supabaseServer";

async function checkStatus() {
    const admin = getSupabaseAdmin();
    const target = "011141";

    console.log(`🕵️  Verificando estado ATUAL do item ${target}...`);

    // 1. Check Adjustments (Any period or null)
    const { data: adjustments } = await admin
        .from("code_offset_adjustments")
        .select("*")
        .or(`cod_positivo.ilike.%${target}%,cod_negativo.ilike.%${target}%`);

    if (!adjustments || adjustments.length === 0) {
        console.log("✅ Zero ajustes encontrados no banco.");
    } else {
        console.log(`⚠️  Encontrados ${adjustments.length} ajustes:`);
        adjustments.forEach(adj => {
            const de = adj.cod_positivo;
            const para = adj.cod_negativo;
            const qtd = adj.qtd_baixada;
            const quando = new Date(adj.created_at).toLocaleString('pt-BR');
            console.log(`   - [${quando}] ${de} -> ${para} : ${qtd} (Period: ${adj.period_id})`);
        });
    }
}

checkStatus().catch(console.error);
