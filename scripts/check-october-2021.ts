import { getSupabaseAdmin } from "@/lib/supabaseServer";

async function checkOctober2021() {
  const supabase = getSupabaseAdmin();

  console.log("=== VERIFICANDO OUTUBRO 2021 ===\n");

  // Buscar TODOS os períodos
  const { data: allPeriods, error: allError } = await supabase
    .from("periods")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (allError) {
    console.error("Erro ao buscar períodos:", allError);
    return;
  }

  console.log(`📅 Total de períodos no banco: ${allPeriods?.length || 0}\n`);

  // Mostrar todos os períodos
  console.log("TODOS OS PERÍODOS:");
  allPeriods?.forEach((p) => {
    const active = p.is_active ? "✅ ATIVO" : "❌ Inativo";
    console.log(`  ${active} - ${p.month}/${p.year} (ID: ${p.id})`);
  });

  // Buscar especificamente outubro/2021
  const { data: oct2021, error: octError } = await supabase
    .from("periods")
    .select("*")
    .eq("year", 2021)
    .eq("month", 10);

  console.log("\n=== OUTUBRO 2021 ===");
  if (octError) {
    console.error("Erro ao buscar outubro 2021:", octError);
  } else if (!oct2021 || oct2021.length === 0) {
    console.log("✅ Nenhum período de outubro/2021 encontrado no banco");
  } else {
    console.log(`⚠️ Encontrados ${oct2021.length} período(s) de outubro/2021:`);
    oct2021.forEach((p) => {
      console.log(`  - ID: ${p.id}`);
      console.log(`    Ativo: ${p.is_active}`);
      console.log(`    Criado em: ${p.created_at}`);
    });
  }

  // Buscar período ativo
  const { data: activePeriods, error: activeError } = await supabase
    .from("periods")
    .select("*")
    .eq("is_active", true);

  console.log("\n=== PERÍODOS ATIVOS ===");
  if (activeError) {
    console.error("Erro ao buscar períodos ativos:", activeError);
  } else if (!activePeriods || activePeriods.length === 0) {
    console.log("⚠️ Nenhum período ativo encontrado!");
  } else {
    console.log(`Total de períodos ativos: ${activePeriods.length}`);
    activePeriods.forEach((p) => {
      console.log(`  ✅ ${p.month}/${p.year} (ID: ${p.id})`);
    });
  }
}

checkOctober2021().then(() => process.exit(0));
