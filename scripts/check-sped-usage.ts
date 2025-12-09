import { getSupabaseAdmin } from "../lib/supabaseServer";

async function checkSpedUsage() {
  const supabase = getSupabaseAdmin();

  // Buscar período ativo
  const { data: activePeriod } = await supabase
    .from("periods")
    .select("id, year, month, name")
    .eq("is_active", true)
    .single();

  if (!activePeriod) {
    console.log("❌ Nenhum período ativo encontrado");
    return;
  }

  console.log(`\n🟢 Período ativo: ${activePeriod.year}/${activePeriod.month} - ${activePeriod.name}`);
  console.log(`   ID: ${activePeriod.id}\n`);

  // Verificar se há SPED órfão marcado como base no período ativo
  const { data: baseSpeds } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at, period_id, is_base")
    .eq("period_id", activePeriod.id)
    .eq("is_base", true);

  console.log(`📁 SPEDs base do período ativo: ${baseSpeds?.length ?? 0}`);

  if (baseSpeds && baseSpeds.length > 0) {
    baseSpeds.forEach(sped => {
      console.log(`   - ${sped.name} (${sped.id})`);
    });
  }

  // Verificar SPEDs órfãos marcados como base
  const { data: orphanBaseSpeds } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at, is_base")
    .is("period_id", null)
    .eq("is_base", true);

  console.log(`\n⚠️  SPEDs ÓRFÃOS marcados como BASE: ${orphanBaseSpeds?.length ?? 0}`);

  if (orphanBaseSpeds && orphanBaseSpeds.length > 0) {
    orphanBaseSpeds.forEach(sped => {
      console.log(`   - ${sped.name} (${new Date(sped.uploaded_at).toLocaleString("pt-BR")})`);
      console.log(`     ID: ${sped.id}`);
    });

    console.log(`\n❌ PERIGO: Estes SPEDs órfãos estão marcados como BASE mas sem período!`);
    console.log(`   Eles NÃO serão usados nas abas porque o sistema busca SPEDs do período ativo.`);
    console.log(`   RECOMENDAÇÃO: Remover a flag is_base=true deles OU deletá-los.`);
  } else {
    console.log(`   ✅ Nenhum SPED órfão está marcado como base`);
  }
}

checkSpedUsage().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
