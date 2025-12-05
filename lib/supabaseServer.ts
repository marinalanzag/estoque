import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseAdminInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Log para debug (sem expor a chave completa)
  const env = process.env.NODE_ENV || 'unknown';
  const urlPreview = supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NÃO CONFIGURADO';
  console.log(`[getSupabaseAdmin] Ambiente: ${env}`);
  console.log(`[getSupabaseAdmin] URL do Supabase: ${urlPreview}`);
  console.log(`[getSupabaseAdmin] Service Key configurada: ${!!supabaseKey}`);

  if (!supabaseUrl || !supabaseKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    
    const errorMsg = `Variáveis de ambiente do Supabase não configuradas: ${missingVars.join(', ')}. Verifique no arquivo .env.local ou nas configurações do Vercel.`;
    console.error(`[getSupabaseAdmin] ❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validar formato da URL
  try {
    new URL(supabaseUrl);
  } catch {
    const errorMsg = `URL do Supabase inválida: "${supabaseUrl}". Deve ser uma URL válida (ex: https://xxxxx.supabase.co)`;
    console.error(`[getSupabaseAdmin] ❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseKey);
    console.log(`[getSupabaseAdmin] ✅ Cliente Supabase criado com sucesso`);
    return supabaseAdminInstance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    const errorMsg = `Erro ao criar cliente Supabase: ${errorMessage}. Verifique se a URL e a chave estão corretas.`;
    console.error(`[getSupabaseAdmin] ❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
}

// Não exportar supabaseAdmin diretamente para evitar inicialização na importação
// Use getSupabaseAdmin() dentro de funções async/try-catch

