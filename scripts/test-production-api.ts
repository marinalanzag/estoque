/**
 * Testa a API de produção do Vercel diretamente
 */

async function testProductionAPI() {
  const productionUrl = "https://estoque-beryl-pi.vercel.app/api/sped/list";

  console.log("🔍 Testando API de PRODUÇÃO...");
  console.log(`URL: ${productionUrl}\n`);
  console.log("=" .repeat(100));

  try {
    // Adicionar headers para evitar cache
    const res = await fetch(productionUrl, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });

    console.log(`\n📡 Status da resposta: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      console.error("❌ Erro na requisição!");
      const text = await res.text();
      console.error("Resposta:", text.substring(0, 500));
      return;
    }

    const data = await res.json();

    if (!data.ok) {
      console.error("❌ API retornou erro:", data.error || "Erro desconhecido");
      return;
    }

    const files = data.files || [];
    console.log(`\n📁 Total de arquivos retornados: ${files.length}\n`);

    if (files.length === 0) {
      console.log("❌ Nenhum arquivo SPED retornado pela API de produção!");
      return;
    }

    // Mostrar os primeiros 10
    console.log("📋 Primeiros 10 arquivos (mais recentes):");
    console.log("-".repeat(100));

    files.slice(0, 10).forEach((file: any, index: number) => {
      const uploadDate = file.uploaded_at
        ? new Date(file.uploaded_at).toLocaleString("pt-BR")
        : "N/A";
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   Uploaded: ${uploadDate}`);
      console.log("");
    });

    // Procurar especificamente pelo arquivo de fevereiro
    const fevFile = files.find((f: any) => f.name?.includes("fev2023"));

    console.log("\n🔍 Procurando arquivo de Fevereiro/2023...");
    console.log("-".repeat(100));

    if (fevFile) {
      console.log("✅ ENCONTRADO na API de produção!");
      console.log(`   Nome: ${fevFile.name}`);
      console.log(`   ID: ${fevFile.id}`);
      console.log(
        `   Uploaded: ${new Date(fevFile.uploaded_at).toLocaleString("pt-BR")}`
      );
    } else {
      console.log("❌ NÃO ENCONTRADO na resposta da API de produção!");
      console.log("\n⚠️  Isso indica que a API de produção está com CACHE ANTIGO!");
      console.log(
        "\nArquivos que contêm 'fev', 'Feb' ou '2023' no nome (primeiros 20):"
      );
      const fevFiles = files.filter(
        (f: any) =>
          f.name?.toLowerCase().includes("fev") ||
          f.name?.toLowerCase().includes("feb") ||
          f.name?.includes("2023")
      );
      if (fevFiles.length > 0) {
        fevFiles.slice(0, 20).forEach((f: any) => console.log(`  - ${f.name}`));
      } else {
        console.log(
          '  Nenhum arquivo encontrado com "fev", "Feb" ou "2023" no nome.'
        );
      }
    }

    // Comparar com o que esperamos (49 arquivos)
    console.log("\n\n📊 ANÁLISE:");
    console.log("-".repeat(100));
    console.log(`Arquivos retornados pela API de produção: ${files.length}`);
    console.log(`Arquivos no banco de dados (do script anterior): 49`);

    if (files.length < 49) {
      console.log(
        `\n⚠️  PROBLEMA CONFIRMADO: API está retornando ${49 - files.length} arquivo(s) a menos!`
      );
      console.log("   Isso indica CACHE DESATUALIZADO no Vercel!");
    } else if (files.length === 49) {
      console.log("\n✅ API retorna o número correto de arquivos.");
      console.log("   Mas o arquivo de fevereiro pode estar sendo filtrado no frontend.");
    } else {
      console.log(
        `\n⚠️  API retorna MAIS arquivos (${files.length - 49} a mais) do que esperado.`
      );
    }
  } catch (error) {
    console.error("\n❌ Erro ao testar API de produção:", error);
    if (error instanceof Error) {
      console.error("Mensagem:", error.message);
    }
  }
}

testProductionAPI().catch(console.error);
