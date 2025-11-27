/**
 * Remove pontos de milhar e troca vírgula por ponto
 * Converte string numérica brasileira para number
 */
export function parseNumberBR(value?: string | null): number | null {
  if (!value) return null;
  const cleaned = value.toString().trim();
  if (cleaned === "" || cleaned === "-") return null;
  
  // Remove pontos de milhar e troca vírgula por ponto
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  
  return isNaN(parsed) ? null : parsed;
}

/**
 * Normaliza string para comparação (minúsculo, sem acentos, sem espaços extras)
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .trim()
    .replace(/\s+/g, "_");
}

/**
 * Mapeia cabeçalho para campo conhecido
 */
export function mapHeaderToField(header: string): string | null {
  const normalized = normalizeHeader(header);
  
  // Mapeamento de variações comuns
  if (
    normalized.includes("cod_item") ||
    normalized.includes("codigo") ||
    normalized.includes("codproduto") ||
    normalized === "cod"
  ) {
    return "cod_item";
  }
  
  if (
    normalized.includes("descricao") ||
    normalized.includes("descricao_item") ||
    normalized.includes("descricao_produto") ||
    normalized === "desc"
  ) {
    return "descr_item";
  }
  
  if (
    normalized.includes("qtd") ||
    normalized.includes("quantidade") ||
    normalized.includes("qtd_inicial") ||
    normalized === "qt"
  ) {
    return "qtd";
  }
  
  if (
    normalized.includes("unid") ||
    normalized.includes("unidade") ||
    normalized.includes("unidade_medida") ||
    normalized === "um"
  ) {
    return "unid";
  }
  
  if (
    normalized.includes("custo_unitario") ||
    normalized.includes("custo_unit") ||
    normalized.includes("unit_cost") ||
    normalized.includes("preco_unitario") ||
    normalized.includes("preco_unit") ||
    normalized.includes("vl_unit") ||
    normalized.includes("valor_unitario") ||
    normalized.includes("valor_unit") ||
    normalized === "custo" ||
    normalized === "preco"
  ) {
    return "unit_cost";
  }
  
  return null;
}

/**
 * Normaliza código de item para 6 dígitos (com zeros à esquerda)
 * Exemplos:
 * - "123" → "000123"
 * - "1234" → "001234"
 * - "12345" → "012345"
 * - "123456" → "123456"
 * - "1234567" → "234567" (mantém últimos 6 dígitos)
 * - "ABC123" → "000123" (remove não numéricos)
 */
export function normalizeCodItem(cod_item: string | number | null | undefined): string {
  if (!cod_item) return "000000";
  
  // Converter para string e remover espaços
  let cod = String(cod_item).trim();
  
  // Remover caracteres não numéricos (exceto se for um código alfanumérico válido)
  // Primeiro, tentar extrair apenas números
  const numericOnly = cod.replace(/\D/g, "");
  
  // Se houver números, usar apenas eles
  if (numericOnly.length > 0) {
    cod = numericOnly;
  }
  
  // Se ainda estiver vazio após remover não numéricos, retornar zeros
  if (cod.length === 0) {
    return "000000";
  }
  
  // Preencher com zeros à esquerda até 6 dígitos
  // Se tiver mais de 6 dígitos, manter os últimos 6
  if (cod.length > 6) {
    cod = cod.slice(-6);
  }
  
  return cod.padStart(6, "0");
}

/**
 * Busca descrições do cadastro de produtos (product_catalog) para códigos que não têm descrição
 * Retorna um Map com cod_item -> descr_item
 */
export async function fetchProductDescriptions(
  supabaseAdmin: ReturnType<typeof import("@/lib/supabaseServer").getSupabaseAdmin>,
  codItems: string[]
): Promise<Map<string, string>> {
  if (codItems.length === 0) {
    return new Map();
  }

  const descriptionsMap = new Map<string, string>();
  
  // Normalizar códigos
  const normalizedCodes = codItems.map(cod => normalizeCodItem(cod));
  const uniqueCodes = Array.from(new Set(normalizedCodes));

  // Buscar em lotes para evitar queries muito grandes
  const batchSize = 500;
  for (let i = 0; i < uniqueCodes.length; i += batchSize) {
    const batch = uniqueCodes.slice(i, i + batchSize);
    
    const { data, error } = await supabaseAdmin
      .from("product_catalog")
      .select("cod_item, descr_item")
      .in("cod_item", batch);

    if (!error && data) {
      data.forEach((item) => {
        if (item.cod_item && item.descr_item) {
          descriptionsMap.set(item.cod_item, item.descr_item);
        }
      });
    }
  }

  return descriptionsMap;
}

