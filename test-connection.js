// Script para testar conexão com Supabase
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  console.log('🔍 Verificando conexão com Supabase...\n');

  // Verificar variáveis de ambiente
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ ERRO: NEXT_PUBLIC_SUPABASE_URL não está configurada');
    console.log('\n📝 Para configurar:');
    console.log('   1. Crie um arquivo .env.local na raiz do projeto');
    console.log('   2. Adicione: NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co');
    return;
  }

  if (!supabaseKey) {
    console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não está configurada');
    console.log('\n📝 Para configurar:');
    console.log('   1. Crie um arquivo .env.local na raiz do projeto');
    console.log('   2. Adicione: SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui');
    return;
  }

  console.log('✅ Variáveis de ambiente encontradas:');
  console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
  console.log(`   Key: ${supabaseKey.substring(0, 20)}...\n`);

  // Validar formato da URL
  try {
    new URL(supabaseUrl);
  } catch (error) {
    console.error('❌ ERRO: URL do Supabase inválida');
    console.error(`   URL fornecida: ${supabaseUrl}`);
    return;
  }

  // Tentar conectar
  try {
    console.log('🔌 Tentando conectar ao Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Testar conexão fazendo uma query simples
    const { data, error } = await supabase
      .from('sped_files')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ ERRO na conexão:');
      console.error(`   Mensagem: ${error.message}`);
      console.error(`   Detalhes: ${JSON.stringify(error, null, 2)}`);
      return;
    }

    console.log('✅ Conexão com Supabase estabelecida com sucesso!');
    console.log('✅ Teste de query executado com sucesso!');
    console.log('\n🎉 Servidor está pronto para uso!');
    
  } catch (error) {
    console.error('❌ ERRO ao criar cliente Supabase:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n   Stack trace:\n${error.stack}`);
    }
  }
}

testConnection();


