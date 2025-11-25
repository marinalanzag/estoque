import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabaseAdminInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Variáveis de ambiente do Supabase não configuradas. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env.local"
    );
  }

  // Validar formato da URL
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error(
      `URL do Supabase inválida: "${supabaseUrl}". Deve ser uma URL válida (ex: https://xxxxx.supabase.co)`
    );
  }

  try {
    supabaseAdminInstance = createClient(supabaseUrl, supabaseKey);
    return supabaseAdminInstance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    throw new Error(
      `Erro ao criar cliente Supabase: ${errorMessage}. Verifique se a URL e a chave estão corretas.`
    );
  }
}

// Não exportar supabaseAdmin diretamente para evitar inicialização na importação
// Use getSupabaseAdmin() dentro de funções async/try-catch

