/**
 * Script de Teste - fetchAdjustmentsMaps
 *
 * Testa se a função está buscando ajustes corretamente com filtro por período
 *
 * Uso: npx tsx scripts/test-fetch-adjustments.ts
 */

import { getSupabaseAdmin } from "../lib/supabaseServer";

async function testFetchAdjustments() {
  const supabase = getSupabaseAdmin();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  TESTE: fetchAdjustmentsMaps com filtro por período      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // Buscar período ativo
  const { data: activePeriod } = await supabase
    .from("periods")
    .select("*")
    .eq("is_active", true)
    .single();

  if (!activePeriod) {
    console.log("❌ Nenhum período ativo");
    return;
  }

  console.log(`Período ativo: ${activePeriod.year}/${activePeriod.month}`);
  console.log(`ID: ${activePeriod.id}`);
  console.log();

  // Buscar SPED base
  const { data: baseSped } = await supabase
    .from("sped_files")
    .select("*")
    .eq("period_id", activePeriod.id)
    .eq("is_base", true)
    .single();

  if (!baseSped) {
    console.log("❌ Nenhum SPED base");
    return;
  }

  console.log(`SPED base: ${baseSped.name}`);
  console.log(`ID: ${baseSped.id}`);
  console.log();

  // SIMULAR A QUERY QUE fetchAdjustmentsMaps FAZ
  console.log("─".repeat(60));
  console.log("SIMULANDO QUERY DE fetchAdjustmentsMaps:");
  console.log("─".repeat(60));

  const spedFileId = baseSped.id;
  const periodId = activePeriod.id;

  // Query COM filtro de período (nossa correção)
  let adjustmentsQuery = supabase
    .from("code_offset_adjustments")
    .select("id, cod_negativo, cod_positivo, qtd_baixada, period_id, created_at")
    .eq("sped_file_id", spedFileId);

  if (periodId) {
    adjustmentsQuery = adjustmentsQuery.or(`period_id.eq.${periodId},period_id.is.null`);
  }

  const { data: adjustments, error } = await adjustmentsQuery
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.log("❌ Erro na query:", error.message);
    return;
  }

  console.log(`✅ Query executada com sucesso`);
  console.log(`   Total de ajustes encontrados: ${adjustments?.length ?? 0}`);
  console.log();

  if (adjustments && adjustments.length > 0) {
    console.log("ÚLTIMOS 10 AJUSTES:");
    console.log("─".repeat(60));

    adjustments.slice(0, 10).forEach((adj, index) => {
      const isToday = new Date(adj.created_at).toDateString() === new Date().toDateString();
      const emoji = isToday ? "🆕" : "📅";

      console.log(`${emoji} ${index + 1}. ${adj.cod_negativo} ← ${adj.cod_positivo} (qtd: ${adj.qtd_baixada})`);
      console.log(`   Period: ${adj.period_id === periodId ? "✅ Match" : adj.period_id === null ? "⚪ NULL" : "❌ Diferente"}`);
      console.log(`   Criado: ${new Date(adj.created_at).toLocaleString("pt-BR")}`);
      console.log();
    });
  }

  // Contar ajustes de hoje
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ajustesHoje = adjustments?.filter(adj =>
    new Date(adj.created_at) >= hoje
  ) ?? [];

  console.log("─".repeat(60));
  console.log("RESUMO:");
  console.log(`  Total de ajustes retornados pela query: ${adjustments?.length ?? 0}`);
  console.log(`  Ajustes criados hoje: ${ajustesHoje.length}`);
  console.log();

  if (ajustesHoje.length > 0) {
    console.log("✅ Os ajustes de hoje ESTÃO sendo retornados pela query!");
    console.log("   Se não aparecem na tela, o problema é cache do navegador/servidor.");
  } else {
    console.log("⚠️  Nenhum ajuste de hoje foi retornado.");
  }
}

testFetchAdjustments()
  .then(() => {
    console.log("\n✅ Teste concluído");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
