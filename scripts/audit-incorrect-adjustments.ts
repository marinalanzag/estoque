/**
 * Script de Auditoria - Baixas Incorretas
 *
 * Analisa ajustes feitos com base no saldo ERRADO (após ajustes)
 * vs. o que deveria ter sido feito com saldo CORRETO (cru/teórico)
 *
 * Uso: npx tsx scripts/audit-incorrect-adjustments.ts
 */

import { getSupabaseAdmin } from "../lib/supabaseServer";
import { buildConsolidado } from "../lib/consolidado";

interface AjusteAnalysis {
  id: string;
  cod_negativo: string;
  cod_positivo: string;
  qtd_baixada: number;
  created_at: string;

  // O que o usuário VIU (ERRADO)
  saldo_visto_pelo_usuario: number; // estoque_final (após ajustes anteriores)

  // O que DEVERIA ter visto (CORRETO)
  saldo_correto_cru: number; // estoque_teorico (sem ajustes)

  // Análise do erro
  diferenca: number; // quanto o usuário foi enganado
  baixa_foi_baseada_em_valor_errado: boolean;
  impacto: string; // descrição do impacto
  sugestao: string; // o que fazer
}

async function auditIncorrectAdjustments() {
  const supabase = getSupabaseAdmin();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  AUDITORIA - BAIXAS FEITAS COM SALDO ERRADO              ║");
  console.log("║  Analisa impacto de ter usado saldo APÓS ajustes         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // 1. Buscar período ativo
  const { data: activePeriod } = await supabase
    .from("periods")
    .select("*")
    .eq("is_active", true)
    .single();

  if (!activePeriod) {
    console.log("❌ Nenhum período ativo encontrado");
    return;
  }

  console.log(`📊 Período: ${activePeriod.year}/${activePeriod.month} - ${activePeriod.name}`);
  console.log();

  // 2. Buscar SPED base
  const { data: baseSped } = await supabase
    .from("sped_files")
    .select("*")
    .eq("period_id", activePeriod.id)
    .eq("is_base", true)
    .single();

  if (!baseSped) {
    console.log("❌ SPED base não encontrado");
    return;
  }

  console.log(`📁 SPED: ${baseSped.name}`);
  console.log();

  // 3. Buscar estoque base
  const { data: baseStock } = await supabase
    .from("stock_initial_imports")
    .select("*")
    .eq("period_id", activePeriod.id)
    .eq("is_base", true)
    .single();

  if (!baseStock) {
    console.log("❌ Estoque base não encontrado");
    return;
  }

  // 4. Buscar XMLs base
  const { data: baseXmls } = await supabase
    .from("xml_sales_imports")
    .select("id")
    .eq("period_id", activePeriod.id)
    .eq("is_base", true);

  const xmlImportIds = baseXmls?.map(x => x.id) || [];

  console.log(`📦 XMLs base: ${xmlImportIds.length}`);
  console.log();

  // 5. Buscar TODOS os ajustes do período (ordenados por data)
  const { data: adjustments } = await supabase
    .from("code_offset_adjustments")
    .select("*")
    .eq("sped_file_id", baseSped.id)
    .or(`period_id.eq.${activePeriod.id},period_id.is.null`)
    .order("created_at", { ascending: true }); // Ordem cronológica

  if (!adjustments || adjustments.length === 0) {
    console.log("ℹ️  Nenhum ajuste encontrado");
    return;
  }

  console.log(`📋 Total de ajustes: ${adjustments.length}`);
  console.log();

  // 6. Construir consolidado COMPLETO (com todos os ajustes)
  console.log("🔄 Construindo consolidado completo...");
  const consolidadoCompleto = await buildConsolidado(
    baseStock.id,
    baseSped.id,
    { xmlImportIds }
  );

  // 7. Analisar cada ajuste
  const analyses: AjusteAnalysis[] = [];

  // Para simular o que o usuário viu, precisamos reconstruir o consolidado
  // ANTES de cada ajuste (removendo ajustes posteriores)
  for (let i = 0; i < adjustments.length; i++) {
    const ajuste = adjustments[i];

    // Pegar ajustes que existiam ANTES deste (índices 0 até i-1)
    const ajustesAnteriores = adjustments.slice(0, i);

    // Calcular o que o usuário VIU (estoque_teorico + ajustes anteriores)
    const itemConsolidado = consolidadoCompleto.rows.find(
      r => r.cod_item === ajuste.cod_negativo
    );

    if (!itemConsolidado) {
      console.warn(`⚠️  Item ${ajuste.cod_negativo} não encontrado no consolidado`);
      continue;
    }

    // Saldo CRU (correto) = estoque_teorico
    const saldoCorretoCru = itemConsolidado.qtd_final; // qtd_inicial + entradas - saidas

    // Calcular ajustes anteriores para este item
    const ajustesAnterioresParaEsteItem = ajustesAnteriores.filter(
      a => a.cod_negativo === ajuste.cod_negativo
    );
    const ajustesRecebidosAnteriores = ajustesAnterioresParaEsteItem.reduce(
      (acc, a) => acc + a.qtd_baixada,
      0
    );

    // Saldo que o usuário VIU (ERRADO) = estoque_teorico + ajustes anteriores
    const saldoVistoUsuario = saldoCorretoCru + ajustesRecebidosAnteriores;

    // Análise
    const diferenca = saldoVistoUsuario - saldoCorretoCru;
    const baixaBaseadaEmErro = Math.abs(diferenca) > 0.01; // Tolerância de 0.01

    let impacto = "";
    let sugestao = "";

    if (baixaBaseadaEmErro) {
      if (diferenca > 0) {
        // Usuário viu saldo MAIOR que o real (menos negativo)
        impacto = `Usuário viu saldo ${diferenca.toFixed(2)} unidades MELHOR que o real. Pode ter baixado MENOS do que precisava.`;
        sugestao = `Verificar se ainda falta baixar ${diferenca.toFixed(2)} unidades.`;
      } else {
        // Usuário viu saldo MENOR que o real (mais negativo)
        impacto = `Usuário viu saldo ${Math.abs(diferenca).toFixed(2)} unidades PIOR que o real. Pode ter baixado MAIS do que precisava.`;
        sugestao = `Verificar se baixou ${Math.abs(diferenca).toFixed(2)} unidades em excesso.`;
      }
    } else {
      impacto = "✅ Este ajuste foi baseado no saldo correto (ou é o primeiro ajuste).";
      sugestao = "Nenhuma ação necessária.";
    }

    analyses.push({
      id: ajuste.id,
      cod_negativo: ajuste.cod_negativo,
      cod_positivo: ajuste.cod_positivo,
      qtd_baixada: ajuste.qtd_baixada,
      created_at: ajuste.created_at,
      saldo_visto_pelo_usuario: saldoVistoUsuario,
      saldo_correto_cru: saldoCorretoCru,
      diferenca,
      baixa_foi_baseada_em_valor_errado: baixaBaseadaEmErro,
      impacto,
      sugestao,
    });
  }

  // 8. Relatório
  console.log("═".repeat(80));
  console.log("RELATÓRIO DE ANÁLISE");
  console.log("═".repeat(80));
  console.log();

  const ajustesComErro = analyses.filter(a => a.baixa_foi_baseada_em_valor_errado);
  const ajustesCorretos = analyses.filter(a => !a.baixa_foi_baseada_em_valor_errado);

  console.log(`✅ Ajustes baseados em saldo CORRETO: ${ajustesCorretos.length}`);
  console.log(`⚠️  Ajustes baseados em saldo ERRADO: ${ajustesComErro.length}`);
  console.log();

  if (ajustesComErro.length === 0) {
    console.log("🎉 Nenhum ajuste foi afetado pelo bug! Todos foram baseados no saldo correto.");
    return;
  }

  console.log("─".repeat(80));
  console.log("DETALHES DOS AJUSTES AFETADOS:");
  console.log("─".repeat(80));
  console.log();

  ajustesComErro.forEach((analysis, index) => {
    console.log(`${index + 1}. Ajuste ID: ${analysis.id.substring(0, 8)}...`);
    console.log(`   Data: ${new Date(analysis.created_at).toLocaleString("pt-BR")}`);
    console.log(`   Código Negativo: ${analysis.cod_negativo}`);
    console.log(`   Código Positivo: ${analysis.cod_positivo}`);
    console.log(`   Quantidade Baixada: ${analysis.qtd_baixada.toFixed(2)}`);
    console.log();
    console.log(`   📊 COMPARAÇÃO:`);
    console.log(`      Saldo CRU (correto):     ${analysis.saldo_correto_cru.toFixed(2)}`);
    console.log(`      Saldo VISTO (errado):    ${analysis.saldo_visto_pelo_usuario.toFixed(2)}`);
    console.log(`      Diferença:               ${analysis.diferenca > 0 ? "+" : ""}${analysis.diferenca.toFixed(2)}`);
    console.log();
    console.log(`   💡 IMPACTO:`);
    console.log(`      ${analysis.impacto}`);
    console.log();
    console.log(`   🔧 SUGESTÃO:`);
    console.log(`      ${analysis.sugestao}`);
    console.log();
    console.log("─".repeat(80));
    console.log();
  });

  // 9. Resumo por item
  console.log("═".repeat(80));
  console.log("RESUMO POR ITEM NEGATIVO");
  console.log("═".repeat(80));
  console.log();

  const itemsAffected = new Map<string, typeof ajustesComErro>();
  ajustesComErro.forEach(a => {
    const existing = itemsAffected.get(a.cod_negativo) || [];
    existing.push(a);
    itemsAffected.set(a.cod_negativo, existing);
  });

  itemsAffected.forEach((ajustes, codItem) => {
    const totalDiferenca = ajustes.reduce((acc, a) => acc + a.diferenca, 0);
    const totalBaixado = ajustes.reduce((acc, a) => acc + a.qtd_baixada, 0);

    console.log(`📦 Item: ${codItem}`);
    console.log(`   Ajustes afetados: ${ajustes.length}`);
    console.log(`   Total baixado: ${totalBaixado.toFixed(2)}`);
    console.log(`   Impacto acumulado: ${totalDiferenca > 0 ? "+" : ""}${totalDiferenca.toFixed(2)}`);

    if (totalDiferenca > 0) {
      console.log(`   ⚠️  Pode estar faltando baixar ${totalDiferenca.toFixed(2)} unidades`);
    } else if (totalDiferenca < 0) {
      console.log(`   ⚠️  Pode ter sido baixado ${Math.abs(totalDiferenca).toFixed(2)} unidades em excesso`);
    }
    console.log();
  });

  console.log("═".repeat(80));
  console.log("🏁 Análise concluída!");
  console.log();
  console.log("💡 RECOMENDAÇÃO:");
  console.log("   Revisar os ajustes marcados e decidir se:");
  console.log("   1. Criar ajustes compensatórios");
  console.log("   2. Desfazer e refazer os ajustes afetados");
  console.log("   3. Aceitar as discrepâncias se forem pequenas");
}

auditIncorrectAdjustments()
  .then(() => {
    console.log("\n✅ Script finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
