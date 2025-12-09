/**
 * Script de Debug Completo - Problemas do Inventário
 *
 * Investiga:
 * 1. Por que ajustes criados hoje não aparecem no inventário
 * 2. Por que saídas não aparecem no Excel
 * 3. Outros problemas relacionados a período/SPED/XMLs
 *
 * Uso: npx tsx scripts/debug-inventory-issues.ts
 */

import { getSupabaseAdmin } from "../lib/supabaseServer";

async function debugInventoryIssues() {
  const supabase = getSupabaseAdmin();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  DEBUG COMPLETO - PROBLEMAS DO INVENTÁRIO                 ║");
  console.log("║  Data:", new Date().toLocaleString("pt-BR").padEnd(42), "║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // ============================================================
  // 1. VERIFICAR PERÍODO ATIVO
  // ============================================================
  console.log("📊 1. PERÍODO ATIVO");
  console.log("─".repeat(60));

  const { data: activePeriod, error: periodError } = await supabase
    .from("periods")
    .select("*")
    .eq("is_active", true)
    .single();

  if (periodError || !activePeriod) {
    console.log("❌ ERRO: Nenhum período ativo encontrado!");
    console.log("   Erro:", periodError?.message || "Não encontrado");
    return;
  }

  console.log(`✅ Período ativo: ${activePeriod.year}/${String(activePeriod.month).padStart(2, "0")} - ${activePeriod.name}`);
  console.log(`   ID: ${activePeriod.id}`);
  console.log();

  // ============================================================
  // 2. VERIFICAR SPED BASE DO PERÍODO
  // ============================================================
  console.log("📊 2. SPED BASE DO PERÍODO");
  console.log("─".repeat(60));

  const { data: baseSped } = await supabase
    .from("sped_files")
    .select("*")
    .eq("period_id", activePeriod.id)
    .eq("is_base", true)
    .single();

  if (!baseSped) {
    console.log("⚠️  Nenhum SPED marcado como base para o período!");

    const { data: spedsOfPeriod } = await supabase
      .from("sped_files")
      .select("id, name, is_base")
      .eq("period_id", activePeriod.id);

    console.log(`   SPEDs do período: ${spedsOfPeriod?.length ?? 0}`);
    if (spedsOfPeriod && spedsOfPeriod.length > 0) {
      spedsOfPeriod.forEach(sped => {
        console.log(`   - ${sped.name} (base: ${sped.is_base})`);
      });
    }
  } else {
    console.log(`✅ SPED base: ${baseSped.name}`);
    console.log(`   ID: ${baseSped.id}`);
  }
  console.log();

  const spedFileId = baseSped?.id;

  if (!spedFileId) {
    console.log("❌ Não é possível continuar sem SPED base");
    return;
  }

  // ============================================================
  // 3. VERIFICAR AJUSTES CRIADOS HOJE
  // ============================================================
  console.log("📊 3. AJUSTES CRIADOS HOJE");
  console.log("─".repeat(60));

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeISO = hoje.toISOString();

  const { data: ajustesHoje } = await supabase
    .from("code_offset_adjustments")
    .select("*")
    .gte("created_at", hojeISO);

  console.log(`Total de ajustes criados hoje: ${ajustesHoje?.length ?? 0}`);

  if (ajustesHoje && ajustesHoje.length > 0) {
    console.log();
    ajustesHoje.forEach((adj, index) => {
      console.log(`  ${index + 1}. Ajuste ID: ${adj.id}`);
      console.log(`     Código Negativo: ${adj.cod_negativo} → Código Positivo: ${adj.cod_positivo}`);
      console.log(`     Quantidade: ${adj.qtd_baixada}`);
      console.log(`     SPED File ID: ${adj.sped_file_id}`);
      console.log(`     Period ID: ${adj.period_id}`);
      console.log(`     Criado em: ${new Date(adj.created_at).toLocaleString("pt-BR")}`);

      // Verificar compatibilidade
      const spedMatch = adj.sped_file_id === spedFileId;
      const periodMatch = adj.period_id === activePeriod.id || adj.period_id === null;

      console.log(`     ✓ SPED match: ${spedMatch ? "✅ SIM" : "❌ NÃO"} (esperado: ${spedFileId})`);
      console.log(`     ✓ Period match: ${periodMatch ? "✅ SIM" : "❌ NÃO"} (esperado: ${activePeriod.id} ou NULL)`);
      console.log();
    });
  } else {
    console.log("   ℹ️  Nenhum ajuste criado hoje");
  }
  console.log();

  // ============================================================
  // 4. VERIFICAR TODOS OS AJUSTES DO SPED/PERÍODO
  // ============================================================
  console.log("📊 4. AJUSTES DO SPED BASE NO PERÍODO ATIVO");
  console.log("─".repeat(60));

  const { data: ajustesSpedPeriodo } = await supabase
    .from("code_offset_adjustments")
    .select("*")
    .eq("sped_file_id", spedFileId)
    .or(`period_id.eq.${activePeriod.id},period_id.is.null`);

  console.log(`Total de ajustes (SPED ${spedFileId.substring(0, 8)}... + período ${activePeriod.id.substring(0, 8)}...): ${ajustesSpedPeriodo?.length ?? 0}`);

  if (ajustesSpedPeriodo && ajustesSpedPeriodo.length > 0) {
    console.log();
    console.log("Últimos 5 ajustes:");
    ajustesSpedPeriodo.slice(0, 5).forEach((adj, index) => {
      console.log(`  ${index + 1}. ${adj.cod_negativo} ← ${adj.cod_positivo} (qtd: ${adj.qtd_baixada})`);
      console.log(`     Criado: ${new Date(adj.created_at).toLocaleString("pt-BR")}`);
    });
  }
  console.log();

  // ============================================================
  // 5. VERIFICAR XMLs DO PERÍODO
  // ============================================================
  console.log("📊 5. XMLs (SAÍDAS) DO PERÍODO");
  console.log("─".repeat(60));

  const { data: xmls } = await supabase
    .from("xml_sales_imports")
    .select("id, label, created_at, total_xmls, total_items, sped_file_id, period_id, is_base")
    .eq("period_id", activePeriod.id)
    .order("created_at", { ascending: false });

  console.log(`Total de importações XML no período: ${xmls?.length ?? 0}`);

  if (xmls && xmls.length > 0) {
    console.log();
    const xmlsBase = xmls.filter(x => x.is_base);
    console.log(`XMLs marcados como BASE: ${xmlsBase.length}`);

    console.log();
    console.log("Todas as importações:");
    xmls.forEach((xml, index) => {
      console.log(`  ${index + 1}. ${xml.label || "[Sem label]"}`);
      console.log(`     ID: ${xml.id}`);
      console.log(`     Total XMLs: ${xml.total_xmls ?? "?"} | Total Itens: ${xml.total_items ?? "?"}`);
      console.log(`     Base: ${xml.is_base ? "✅ SIM" : "⚪ Não"}`);
      console.log(`     SPED: ${xml.sped_file_id === spedFileId ? "✅ Match" : "❌ Diferente"}`);
      console.log(`     Criado: ${new Date(xml.created_at).toLocaleString("pt-BR")}`);
      console.log();
    });
  } else {
    console.log("   ⚠️  Nenhuma importação XML no período!");
  }

  // ============================================================
  // 6. VERIFICAR TOTAL DE SAÍDAS NOS XMLs
  // ============================================================
  console.log("📊 6. TOTAL DE SAÍDAS NOS XMLs DO PERÍODO");
  console.log("─".repeat(60));

  if (xmls && xmls.length > 0) {
    const xmlIds = xmls.map(x => x.id);

    const { count: totalSaidas } = await supabase
      .from("document_items")
      .select("*", { count: "exact", head: true })
      .in("xml_import_id", xmlIds)
      .eq("movement_type", "saida");

    console.log(`Total de itens de saída nos XMLs do período: ${totalSaidas ?? 0}`);

    if (totalSaidas && totalSaidas > 0) {
      // Buscar alguns exemplos
      const { data: exemplosSaidas } = await supabase
        .from("document_items")
        .select("cod_item, movement_qty, qtd, vl_item")
        .in("xml_import_id", xmlIds)
        .eq("movement_type", "saida")
        .limit(5);

      if (exemplosSaidas && exemplosSaidas.length > 0) {
        console.log();
        console.log("Exemplos de saídas:");
        exemplosSaidas.forEach((item, index) => {
          console.log(`  ${index + 1}. Código: ${item.cod_item} | Qtd: ${item.movement_qty || item.qtd} | Valor: R$ ${item.vl_item}`);
        });
      }
    }
  } else {
    console.log("   ⚠️  Sem XMLs, sem saídas para verificar");
  }
  console.log();

  // ============================================================
  // 7. VERIFICAR XMLs ÓRFÃOS (sem period_id)
  // ============================================================
  console.log("📊 7. XMLs ÓRFÃOS (sem period_id)");
  console.log("─".repeat(60));

  const { data: xmlsOrfaos } = await supabase
    .from("xml_sales_imports")
    .select("id, label, created_at, total_xmls, sped_file_id")
    .is("period_id", null)
    .order("created_at", { ascending: false })
    .limit(10);

  console.log(`Total de XMLs sem period_id (exibindo até 10): ${xmlsOrfaos?.length ?? 0}`);

  if (xmlsOrfaos && xmlsOrfaos.length > 0) {
    console.log();
    xmlsOrfaos.forEach((xml, index) => {
      console.log(`  ${index + 1}. ${xml.label || "[Sem label]"}`);
      console.log(`     Total XMLs: ${xml.total_xmls ?? "?"}`);
      console.log(`     SPED: ${xml.sped_file_id === spedFileId ? "Match" : "Diferente"}`);
      console.log(`     Criado: ${new Date(xml.created_at).toLocaleString("pt-BR")}`);
    });
  }
  console.log();

  // ============================================================
  // 8. RESUMO E DIAGNÓSTICO
  // ============================================================
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  RESUMO E DIAGNÓSTICO                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  console.log("📋 CONFIGURAÇÃO ATUAL:");
  console.log(`   Período Ativo: ${activePeriod.year}/${activePeriod.month} (${activePeriod.id.substring(0, 8)}...)`);
  console.log(`   SPED Base: ${baseSped?.name || "NÃO DEFINIDO"} (${spedFileId?.substring(0, 8) || "N/A"}...)`);
  console.log(`   XMLs no Período: ${xmls?.length ?? 0}`);
  console.log(`   Ajustes no SPED+Período: ${ajustesSpedPeriodo?.length ?? 0}`);
  console.log(`   Ajustes criados hoje: ${ajustesHoje?.length ?? 0}`);
  console.log();

  // Diagnósticos
  const diagnosticos: string[] = [];

  if (!baseSped) {
    diagnosticos.push("⚠️  CRÍTICO: Nenhum SPED marcado como base no período ativo");
  }

  if (!xmls || xmls.length === 0) {
    diagnosticos.push("⚠️  CRÍTICO: Nenhum XML vinculado ao período ativo (saídas estarão zeradas)");
  }

  if (ajustesHoje && ajustesHoje.length > 0) {
    const ajustesIncompativeis = ajustesHoje.filter(adj =>
      adj.sped_file_id !== spedFileId ||
      (adj.period_id !== activePeriod.id && adj.period_id !== null)
    );

    if (ajustesIncompativeis.length > 0) {
      diagnosticos.push(`⚠️  PROBLEMA: ${ajustesIncompativeis.length} ajuste(s) de hoje com SPED ou período incompatível`);
    }
  }

  if (xmlsOrfaos && xmlsOrfaos.length > 0) {
    diagnosticos.push(`ℹ️  INFO: ${xmlsOrfaos.length} XML(s) órfão(s) sem period_id (podem contaminar dados)`);
  }

  if (diagnosticos.length > 0) {
    console.log("🔍 DIAGNÓSTICOS:");
    diagnosticos.forEach(d => console.log(`   ${d}`));
  } else {
    console.log("✅ Nenhum problema crítico detectado na configuração");
  }

  console.log();
  console.log("Debug concluído!");
}

// Executar debug
debugInventoryIssues()
  .then(() => {
    console.log("\n✅ Script finalizado com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao executar debug:", error);
    process.exit(1);
  });
