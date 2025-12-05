/**
 * Função utilitária para fazer fetch SEM CACHE
 * Força o navegador a buscar dados frescos do servidor
 */
export async function fetchNoCache(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Gerar timestamp único para evitar cache
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  
  // Adicionar query params para tornar URL única
  const separator = url.includes('?') ? '&' : '?';
  const uniqueUrl = `${url}${separator}_t=${timestamp}&_r=${random}`;
  
  // Headers mais agressivos para evitar cache
  const headers = new Headers(options.headers);
  
  // Headers anti-cache
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.set('If-Modified-Since', '0');
  headers.set('If-None-Match', '*');
  
  // Criar opções de fetch sem cache
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    cache: 'no-store',
    // Forçar bypass de cache
    credentials: 'same-origin',
  };
  
  // Adicionar next config se disponível (Next.js)
  if (typeof window !== 'undefined') {
    // Cliente: usar fetch padrão com headers agressivos
    return fetch(uniqueUrl, fetchOptions);
  }
  
  return fetch(uniqueUrl, fetchOptions);
}

