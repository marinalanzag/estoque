/**
 * Script de Auditoria de Dados Órfãos
 *
 * Identifica registros sem period_id que podem contaminar dados do sistema
 *
 * Uso: npx tsx scripts/audit-orphan-data.ts
 */

import { getSupabaseAdmin } from "../lib/supabaseServer";

interface AuditResult {
  tabela: string;
  total_orfaos: number;
  primeiro_registro?: string;
  ultimo_registro?: string;
}

async function auditOrphanData() {
  const supabase = getSupabaseAdmin();

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  AUDITORIA DE DADOS ÓRFÃOS (SEM PERIOD_ID)                ║");
  console.log("║  Data:", new Date().toLocaleString("pt-BR").padEnd(42), "║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // ============================================================
  // 1. AJUSTES SEM PERÍODO
  // ============================================================
  console.log("📊 1. AJUSTES (code_offset_adjustments)");
  console.log("─".repeat(60));

  const { data: adjustments, error: adjError } = await supabase
    .from("code_offset_adjustments")
    .select("id, cod_negativo, cod_positivo, qtd_baixada, total_value, created_at, created_by, sped_file_id, period_id")
    .is("period_id", null)
    .order("created_at", { ascending: false });

  if (adjError) {
    console.error("❌ Erro ao buscar ajustes:", adjError.message);
  } else {
    console.log(`Total de ajustes órfãos: ${adjustments?.length ?? 0}`);

    if (adjustments && adjustments.length > 0) {
      console.log("\n⚠️  AJUSTES SEM PERÍODO:");
      adjustments.forEach((adj, index) => {
        console.log(`\n  ${index + 1}. ID: ${adj.id}`);
        console.log(`     Código Negativo: ${adj.cod_negativo}`);
        console.log(`     Código Positivo: ${adj.cod_positivo}`);
        console.log(`     Quantidade: ${adj.qtd_baixada}`);
        console.log(`     Valor Total: R$ ${adj.total_value}`);
        console.log(`     Criado em: ${new Date(adj.created_at).toLocaleString("pt-BR")}`);
        console.log(`     Criado por: ${adj.created_by || "N/A"}`);
        console.log(`     SPED File ID: ${adj.sped_file_id}`);
      });
    } else {
      console.log("✅ Nenhum ajuste órfão encontrado");
    }
  }

  console.log("\n");

  // ============================================================
  // 2. SPED FILES SEM PERÍODO
  // ============================================================
  console.log("📊 2. ARQUIVOS SPED (sped_files)");
  console.log("─".repeat(60));

  const { data: speds, error: spedError } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at, is_base, period_id")
    .is("period_id", null)
    .order("uploaded_at", { ascending: false });

  if (spedError) {
    console.error("❌ Erro ao buscar SPEDs:", spedError.message);
  } else {
    console.log(`Total de SPEDs órfãos: ${speds?.length ?? 0}`);

    if (speds && speds.length > 0) {
      console.log("\n⚠️  SPEDs SEM PERÍODO:");
      speds.forEach((sped, index) => {
        console.log(`\n  ${index + 1}. ID: ${sped.id}`);
        console.log(`     Nome: ${sped.name}`);
        console.log(`     Uploaded em: ${new Date(sped.uploaded_at).toLocaleString("pt-BR")}`);
        console.log(`     É base: ${sped.is_base ? "Sim" : "Não"}`);
      });
    } else {
      console.log("✅ Nenhum SPED órfão encontrado");
    }
  }

  console.log("\n");

  // ============================================================
  // 3. XML IMPORTS SEM PERÍODO
  // ============================================================
  console.log("📊 3. IMPORTAÇÕES XML (xml_imports)");
  console.log("─".repeat(60));

  const { data: xmls, error: xmlError } = await supabase
    .from("xml_imports")
    .select("id, label, created_at, total_xmls, total_items, sped_file_id, period_id")
    .is("period_id", null)
    .order("created_at", { ascending: false });

  if (xmlError) {
    console.error("❌ Erro ao buscar XMLs:", xmlError.message);
  } else {
    console.log(`Total de importações XML órfãs: ${xmls?.length ?? 0}`);

    if (xmls && xmls.length > 0) {
      console.log("\n⚠️  XMLs SEM PERÍODO:");
      xmls.forEach((xml, index) => {
        console.log(`\n  ${index + 1}. ID: ${xml.id}`);
        console.log(`     Label: ${xml.label || "N/A"}`);
        console.log(`     Criado em: ${new Date(xml.created_at).toLocaleString("pt-BR")}`);
        console.log(`     Total XMLs: ${xml.total_xmls ?? 0}`);
        console.log(`     Total Itens: ${xml.total_items ?? 0}`);
        console.log(`     SPED File ID: ${xml.sped_file_id || "N/A"}`);
      });
    } else {
      console.log("✅ Nenhuma importação XML órfã encontrada");
    }
  }

  console.log("\n");

  // ============================================================
  // 4. STOCK IMPORTS SEM PERÍODO
  // ============================================================
  console.log("📊 4. IMPORTAÇÕES DE ESTOQUE (stock_imports)");
  console.log("─".repeat(60));

  const { data: stocks, error: stockError } = await supabase
    .from("stock_imports")
    .select("id, filename, uploaded_at, period_id")
    .is("period_id", null)
    .order("uploaded_at", { ascending: false });

  if (stockError) {
    console.error("❌ Erro ao buscar stock imports:", stockError.message);
  } else {
    console.log(`Total de importações de estoque órfãs: ${stocks?.length ?? 0}`);

    if (stocks && stocks.length > 0) {
      console.log("\n⚠️  STOCK IMPORTS SEM PERÍODO:");
      stocks.forEach((stock, index) => {
        console.log(`\n  ${index + 1}. ID: ${stock.id}`);
        console.log(`     Filename: ${stock.filename}`);
        console.log(`     Uploaded em: ${new Date(stock.uploaded_at).toLocaleString("pt-BR")}`);
      });
    } else {
      console.log("✅ Nenhuma importação de estoque órfã encontrada");
    }
  }

  console.log("\n");

  // ============================================================
  // 5. RESUMO GERAL
  // ============================================================
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  RESUMO GERAL                                             ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Ajustes órfãos:                ${adjustments?.length ?? 0}`);
  console.log(`  SPEDs órfãos:                  ${speds?.length ?? 0}`);
  console.log(`  Importações XML órfãs:         ${xmls?.length ?? 0}`);
  console.log(`  Importações de estoque órfãs:  ${stocks?.length ?? 0}`);
  console.log();

  const totalOrfaos =
    (adjustments?.length ?? 0) +
    (speds?.length ?? 0) +
    (xmls?.length ?? 0) +
    (stocks?.length ?? 0);

  if (totalOrfaos > 0) {
    console.log("⚠️  ATENÇÃO: Foram encontrados dados órfãos!");
    console.log();
    console.log("RECOMENDAÇÕES:");
    console.log("1. Vincule esses registros a um período existente OU");
    console.log("2. Delete os registros órfãos se não forem mais necessários OU");
    console.log("3. Mantenha-os (serão incluídos via .or(period_id.is.null) por compatibilidade)");
  } else {
    console.log("✅ EXCELENTE! Nenhum dado órfão encontrado.");
    console.log("   Todos os registros estão vinculados a períodos.");
  }

  console.log();

  // ============================================================
  // 6. PERÍODOS EXISTENTES
  // ============================================================
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  PERÍODOS CADASTRADOS                                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  const { data: periods, error: periodError } = await supabase
    .from("periods")
    .select("id, year, month, name, is_active, created_at")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (periodError) {
    console.error("❌ Erro ao buscar períodos:", periodError.message);
  } else if (periods && periods.length > 0) {
    periods.forEach((period, index) => {
      const isActive = period.is_active ? "🟢 ATIVO" : "⚪ Inativo";
      console.log(`  ${index + 1}. ${period.year}/${String(period.month).padStart(2, "0")} - ${period.name} ${isActive}`);
      console.log(`     ID: ${period.id}`);
      console.log(`     Criado em: ${new Date(period.created_at).toLocaleString("pt-BR")}`);
      console.log();
    });
  } else {
    console.log("  ⚠️  Nenhum período cadastrado");
  }

  console.log();
  console.log("Auditoria concluída!");
}

// Executar auditoria
auditOrphanData()
  .then(() => {
    console.log("\n✅ Script finalizado com sucesso");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao executar auditoria:", error);
    process.exit(1);
  });
