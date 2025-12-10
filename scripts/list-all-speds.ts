import { getSupabaseAdmin } from "../lib/supabaseServer";

async function listAllSpeds() {
  const supabase = getSupabaseAdmin();

  console.log("🔍 Buscando todos os arquivos SPED no banco de dados...\n");

  // Buscar TODOS os SPEDs
  const { data: allSpeds, error } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at, period_id, is_base")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("❌ Erro ao buscar SPEDs:", error);
    return;
  }

  if (!allSpeds || allSpeds.length === 0) {
    console.log("❌ Nenhum arquivo SPED encontrado no banco de dados!");
    return;
  }

  console.log(`📁 Total de arquivos SPED encontrados: ${allSpeds.length}\n`);
  console.log("=" .repeat(100));

  // Buscar informações dos períodos
  const { data: periods } = await supabase
    .from("periods")
    .select("id, year, month, name, is_active");

  const periodMap = new Map();
  periods?.forEach(p => {
    periodMap.set(p.id, p);
  });

  // Listar cada SPED
  allSpeds.forEach((sped, index) => {
    const uploadDate = new Date(sped.uploaded_at).toLocaleString("pt-BR");
    const period = sped.period_id ? periodMap.get(sped.period_id) : null;

    console.log(`\n${index + 1}. ${sped.name}`);
    console.log(`   ID: ${sped.id}`);
    console.log(`   Uploaded: ${uploadDate}`);
    console.log(`   Period ID: ${sped.period_id || "NULL (sem vínculo)"}`);

    if (period) {
      const activeTag = period.is_active ? " [ATIVO]" : "";
      console.log(`   Período: ${period.year}/${period.month} - ${period.name}${activeTag}`);
    } else if (sped.period_id) {
      console.log(`   ⚠️  Período não encontrado (ID órfão: ${sped.period_id})`);
    }

    console.log(`   Base: ${sped.is_base ? "SIM ✓" : "NÃO"}`);
    console.log("-".repeat(100));
  });

  // Resumo
  const withPeriod = allSpeds.filter(s => s.period_id !== null).length;
  const withoutPeriod = allSpeds.filter(s => s.period_id === null).length;
  const markedAsBase = allSpeds.filter(s => s.is_base === true).length;

  console.log("\n📊 RESUMO:");
  console.log(`   Total: ${allSpeds.length}`);
  console.log(`   Com período vinculado: ${withPeriod}`);
  console.log(`   Sem período (órfãos): ${withoutPeriod}`);
  console.log(`   Marcados como base: ${markedAsBase}`);

  // Buscar período ativo
  const activePeriod = periods?.find(p => p.is_active);
  if (activePeriod) {
    console.log(`\n🟢 Período ativo atual: ${activePeriod.year}/${activePeriod.month} - ${activePeriod.name}`);
    const spedsInActivePeriod = allSpeds.filter(s => s.period_id === activePeriod.id);
    console.log(`   SPEDs vinculados ao período ativo: ${spedsInActivePeriod.length}`);

    if (spedsInActivePeriod.length > 0) {
      spedsInActivePeriod.forEach(s => {
        console.log(`   - ${s.name} ${s.is_base ? "(BASE ✓)" : ""}`);
      });
    }
  } else {
    console.log("\n❌ Nenhum período ativo encontrado!");
  }
}

listAllSpeds().catch(console.error);
