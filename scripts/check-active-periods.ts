import { getSupabaseAdmin } from "../lib/supabaseServer";

async function checkPeriods() {
  const supabase = getSupabaseAdmin();

  const { data: periods, error } = await supabase
    .from("periods")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro:", error);
    return;
  }

  console.log("📅 TODOS OS PERÍODOS:\n");
  periods?.forEach((p, i) => {
    const active = p.is_active ? "✅ ATIVO" : "⚪ Inativo";
    console.log(`${i+1}. ${p.year}/${p.month} - ${p.name}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Status: ${active}`);
    console.log(`   Criado em: ${new Date(p.created_at).toLocaleString("pt-BR")}`);
    console.log("");
  });

  const activePeriods = periods?.filter(p => p.is_active) || [];
  console.log(`⚠️  Total de períodos ATIVOS: ${activePeriods.length}`);

  if (activePeriods.length > 1) {
    console.log("❌ PROBLEMA: Há múltiplos períodos ativos!");
    console.log("\nPeríodos ativos encontrados:");
    activePeriods.forEach(p => {
      console.log(`  - ${p.year}/${p.month} - ${p.name} (ID: ${p.id})`);
    });
  } else if (activePeriods.length === 0) {
    console.log("❌ PROBLEMA: Nenhum período está ativo!");
  } else {
    const active = activePeriods[0];
    console.log(`\n✅ Período ativo único: ${active.year}/${active.month} - ${active.name}`);
    console.log(`   ID: ${active.id}`);
  }
}

checkPeriods().catch(console.error);
