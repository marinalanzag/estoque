import { getSupabaseAdmin } from "../lib/supabaseServer";

async function checkRLSPolicies() {
  const supabase = getSupabaseAdmin();

  console.log("🔍 Verificando políticas RLS na tabela sped_files...\n");

  // Tentar buscar informações sobre RLS
  const { data: tables, error } = await supabase
    .from("information_schema.tables")
    .select("*")
    .eq("table_name", "sped_files");

  if (error) {
    console.log("⚠️  Não foi possível verificar RLS via information_schema");
    console.log("   Erro:", error.message);
  }

  console.log("\n🔍 Testando acesso direto ao arquivo de fevereiro...\n");

  // Testar acesso ao arquivo específico
  const { data: fevFile, error: fevError } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at, period_id, is_base")
    .eq("id", "5763a50b-7787-4acf-bab6-9a167fdfcb80")
    .single();

  if (fevError) {
    console.log("❌ ERRO ao buscar arquivo de fevereiro!");
    console.log("   Código:", fevError.code);
    console.log("   Mensagem:", fevError.message);
    console.log("   Detalhes:", fevError.details);
    console.log("   Hint:", fevError.hint);

    if (fevError.code === "PGRST116" || fevError.message?.includes("RLS")) {
      console.log("\n⚠️  POSSÍVEL PROBLEMA: Row Level Security (RLS) pode estar bloqueando o acesso!");
    }
  } else {
    console.log("✅ Arquivo de fevereiro acessível:");
    console.log(JSON.stringify(fevFile, null, 2));
  }

  console.log("\n\n🔍 Comparando queries...\n");

  // Query 1: Como a API faz (sem filtros)
  const { data: allFiles1, error: error1 } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false });

  console.log(`Query 1 (como API): ${allFiles1?.length || 0} arquivos`);

  // Query 2: Com limit
  const { data: allFiles2, error: error2 } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(100);

  console.log(`Query 2 (com limit 100): ${allFiles2?.length || 0} arquivos`);

  // Query 3: Com range
  const { data: allFiles3, error: error3 } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .range(0, 99);

  console.log(`Query 3 (com range 0-99): ${allFiles3?.length || 0} arquivos`);

  // Verificar se fevereiro está em cada uma
  const inQuery1 = allFiles1?.some(f => f.id === "5763a50b-7787-4acf-bab6-9a167fdfcb80");
  const inQuery2 = allFiles2?.some(f => f.id === "5763a50b-7787-4acf-bab6-9a167fdfcb80");
  const inQuery3 = allFiles3?.some(f => f.id === "5763a50b-7787-4acf-bab6-9a167fdfcb80");

  console.log(`\nArquivo de fevereiro presente:`);
  console.log(`  Query 1: ${inQuery1 ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`  Query 2: ${inQuery2 ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`  Query 3: ${inQuery3 ? "✅ SIM" : "❌ NÃO"}`);

  // Mostrar primeiro arquivo de cada query
  console.log(`\nPrimeiro arquivo de cada query:`);
  console.log(`  Query 1: ${allFiles1?.[0]?.name || "N/A"} (${allFiles1?.[0]?.uploaded_at || "N/A"})`);
  console.log(`  Query 2: ${allFiles2?.[0]?.name || "N/A"} (${allFiles2?.[0]?.uploaded_at || "N/A"})`);
  console.log(`  Query 3: ${allFiles3?.[0]?.name || "N/A"} (${allFiles3?.[0]?.uploaded_at || "N/A"})`);
}

checkRLSPolicies().catch(console.error);
