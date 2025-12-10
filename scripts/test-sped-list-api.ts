import { getSupabaseAdmin } from "../lib/supabaseServer";

async function testSpedListAPI() {
  const supabase = getSupabaseAdmin();

  console.log("🔍 Testando query da API /api/sped/list...\n");
  console.log("Query: .from('sped_files').select('id, name, uploaded_at').order('uploaded_at', { ascending: false })");
  console.log("=" .repeat(100));

  const { data: spedFiles, error } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("❌ Erro:", error);
    return;
  }

  if (!spedFiles || spedFiles.length === 0) {
    console.log("❌ Nenhum arquivo SPED encontrado!");
    return;
  }

  console.log(`\n📁 Total de arquivos retornados: ${spedFiles.length}\n`);

  // Mostrar os primeiros 10
  console.log("📋 Primeiros 10 arquivos (mais recentes):");
  console.log("-".repeat(100));

  spedFiles.slice(0, 10).forEach((file, index) => {
    const uploadDate = new Date(file.uploaded_at).toLocaleString("pt-BR");
    console.log(`${index + 1}. ${file.name}`);
    console.log(`   ID: ${file.id}`);
    console.log(`   Uploaded: ${uploadDate}`);
    console.log("");
  });

  // Procurar especificamente pelo arquivo de fevereiro
  const fevFile = spedFiles.find(f => f.name.includes("fev2023"));

  console.log("\n🔍 Procurando arquivo de Fevereiro/2023...");
  console.log("-".repeat(100));

  if (fevFile) {
    console.log("✅ ENCONTRADO!");
    console.log(`   Nome: ${fevFile.name}`);
    console.log(`   ID: ${fevFile.id}`);
    console.log(`   Uploaded: ${new Date(fevFile.uploaded_at).toLocaleString("pt-BR")}`);
  } else {
    console.log("❌ NÃO ENCONTRADO na lista retornada pela query da API!");
    console.log("\nArquivos que contêm 'fev' ou 'Feb' no nome:");
    const fevFiles = spedFiles.filter(f =>
      f.name.toLowerCase().includes("fev") ||
      f.name.toLowerCase().includes("feb")
    );
    if (fevFiles.length > 0) {
      fevFiles.forEach(f => console.log(`  - ${f.name}`));
    } else {
      console.log("  Nenhum arquivo encontrado com 'fev' ou 'Feb' no nome.");
    }
  }

  // Comparar com query completa (incluindo period_id)
  console.log("\n\n🔍 Agora testando query COMPLETA (com period_id)...");
  console.log("=" .repeat(100));

  const { data: completeFiles, error: error2 } = await supabase
    .from("sped_files")
    .select("id, name, uploaded_at, period_id")
    .order("uploaded_at", { ascending: false });

  if (error2) {
    console.error("❌ Erro:", error2);
    return;
  }

  console.log(`\n📁 Total com period_id: ${completeFiles?.length || 0}`);

  const fevFileComplete = completeFiles?.find(f => f.name.includes("fev2023"));

  if (fevFileComplete) {
    console.log("\n✅ Arquivo de Fevereiro/2023 encontrado:");
    console.log(`   Nome: ${fevFileComplete.name}`);
    console.log(`   ID: ${fevFileComplete.id}`);
    console.log(`   Period ID: ${fevFileComplete.period_id}`);
    console.log(`   Uploaded: ${new Date(fevFileComplete.uploaded_at).toLocaleString("pt-BR")}`);
  } else {
    console.log("\n❌ Arquivo de Fevereiro/2023 NÃO encontrado mesmo na query completa!");
  }

  // Verificar se há diferença entre as duas queries
  if (spedFiles.length !== completeFiles?.length) {
    console.log(`\n⚠️  ATENÇÃO: Diferença no número de registros!`);
    console.log(`   Query sem period_id: ${spedFiles.length}`);
    console.log(`   Query com period_id: ${completeFiles?.length || 0}`);
  } else {
    console.log(`\n✅ Ambas as queries retornaram o mesmo número de registros: ${spedFiles.length}`);
  }
}

testSpedListAPI().catch(console.error);
