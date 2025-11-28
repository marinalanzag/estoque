import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export interface Period {
  id: string;
  year: number;
  month: number;
  name: string;
  label?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

const monthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const monthNamesFull = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Gera label do período no formato "Jan/2022", "Fev/2025", etc.
 */
function generatePeriodLabel(year: number, month: number): string {
  const monthName = monthNames[month - 1];
  return `${monthName}/${year}`;
}

/**
 * Busca todos os períodos disponíveis, ordenados por year, month (mais recente primeiro)
 */
export async function getAvailablePeriods(): Promise<Period[]> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("periods")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (error) {
    console.error("Erro ao buscar períodos:", error);
    return [];
  }

  return (data || []) as Period[];
}

/**
 * Procura um período com year e month.
 * Se não existir, cria com label no formato "Jan/2022", "Fev/2025", etc.
 */
export async function getOrCreatePeriod(
  year: number,
  month: number
): Promise<Period | null> {
  const supabaseAdmin = getSupabaseAdmin();

  if (month < 1 || month > 12) {
    throw new Error("month deve estar entre 1 e 12");
  }

  // Buscar período existente
  const { data: existing, error: searchError } = await supabaseAdmin
    .from("periods")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .single();

  if (existing && !searchError) {
    return existing as Period;
  }

  // Se não encontrou, criar novo
  const label = generatePeriodLabel(year, month);
  const name = `${monthNamesFull[month - 1]} ${year}`;

  const { data: created, error: createError } = await supabaseAdmin
    .from("periods")
    .insert({
      year,
      month,
      name,
      label,
      is_active: false,
    })
    .select()
    .single();

  if (createError) {
    console.error("Erro ao criar período:", createError);
    return null;
  }

  return created as Period;
}

/**
 * Lê o período ativo a partir de:
 * 1. Query param ?period=YYYY-MM
 * 2. Cookie activePeriod=YYYY-MM
 * 3. Período marcado como is_active=true no banco
 * 
 * Retorna o registro completo de periods ou null.
 */
export async function getActivePeriodFromRequest(
  searchParams?: { period?: string } | URLSearchParams
): Promise<Period | null> {
  const supabaseAdmin = getSupabaseAdmin();

  let periodParam: string | null = null;

  // 1. Tentar ler do query param
  if (searchParams) {
    if (searchParams instanceof URLSearchParams) {
      periodParam = searchParams.get("period");
    } else if (typeof searchParams === "object" && "period" in searchParams) {
      periodParam = searchParams.period || null;
    }
  }

  // 2. Se não encontrou no query param, tentar ler do cookie
  if (!periodParam) {
    const cookieStore = await cookies();
    const activePeriodCookie = cookieStore.get("activePeriod");
    if (activePeriodCookie?.value) {
      periodParam = activePeriodCookie.value;
    }
  }

  // 3. Se encontrou parâmetro, buscar período específico
  if (periodParam) {
    const match = periodParam.match(/^(\d{4})-(\d{1,2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);

      if (month >= 1 && month <= 12) {
        const { data, error } = await supabaseAdmin
          .from("periods")
          .select("*")
          .eq("year", year)
          .eq("month", month)
          .single();

        if (!error && data) {
          return data as Period;
        }
      }
    }
  }

  // 4. Fallback: buscar período ativo no banco
  const { data, error } = await supabaseAdmin
    .from("periods")
    .select("*")
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Period;
}

/**
 * Função server-side para setar o cookie de período ativo.
 * Formato do cookie: activePeriod=YYYY-MM
 */
export async function setActivePeriodCookie(
  year: number,
  month: number
): Promise<void> {
  const cookieStore = await cookies();
  const cookieValue = `${year}-${month}`;
  
  cookieStore.set("activePeriod", cookieValue, {
    httpOnly: false, // Permitir acesso via JavaScript se necessário
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 ano
    path: "/",
  });
}

/**
 * Busca o SPED base do período (is_base = true para o period_id)
 */
export async function getBaseSpedFileForPeriod(
  periodId: string
): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("sped_files")
    .select("id")
    .eq("period_id", periodId)
    .eq("is_base", true)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Busca todas as importações de XML base do período (is_base = true para o period_id)
 */
export async function getBaseXmlImportsForPeriod(
  periodId: string
): Promise<string[]> {
  const supabaseAdmin = getSupabaseAdmin();

  console.log("[getBaseXmlImportsForPeriod] Buscando XMLs base para período:", periodId);
  
  const { data, error } = await supabaseAdmin
    .from("xml_sales_imports")
    .select("id, label, is_base, period_id")
    .eq("period_id", periodId)
    .eq("is_base", true);

  if (error) {
    console.error("[getBaseXmlImportsForPeriod] Erro ao buscar XMLs base:", error);
    return [];
  }

  if (!data || data.length === 0) {
    console.warn("[getBaseXmlImportsForPeriod] Nenhum XML base encontrado para período:", periodId);
    // Verificar se há XMLs do período mas sem is_base
    const { data: allPeriodXmls } = await supabaseAdmin
      .from("xml_sales_imports")
      .select("id, label, is_base, period_id")
      .eq("period_id", periodId);
    console.log("[getBaseXmlImportsForPeriod] Total de XMLs do período (sem filtro is_base):", allPeriodXmls?.length || 0);
    return [];
  }

  console.log("[getBaseXmlImportsForPeriod] XMLs base encontrados:", data.length);
  return data.map((imp) => imp.id);
}

/**
 * Busca a importação de estoque inicial base do período (is_base = true para o period_id)
 */
export async function getBaseStockImportForPeriod(
  periodId: string
): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("stock_initial_imports")
    .select("id")
    .eq("period_id", periodId)
    .eq("is_base", true)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Busca todos os SPEDs do período
 */
export async function getSpedFilesForPeriod(
  periodId: string
): Promise<Array<{ id: string; name: string; uploaded_at: string; is_base: boolean }>> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at, is_base")
    .eq("period_id", periodId)
    .order("uploaded_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Busca todas as importações de XML do período
 */
export async function getXmlImportsForPeriod(
  periodId: string
): Promise<Array<{ 
  id: string; 
  label: string | null; 
  total_xmls: number | null; 
  total_items: number | null; 
  created_at: string; 
  is_base: boolean;
  sped_file_id: string | null;
}>> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("xml_sales_imports")
    .select("id, label, total_xmls, total_items, created_at, is_base, sped_file_id")
    .eq("period_id", periodId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Busca todas as importações de estoque inicial do período
 */
export async function getStockImportsForPeriod(
  periodId: string
): Promise<Array<{ 
  id: string; 
  label: string | null; 
  total_items: number | null; 
  total_value: number | null; 
  created_at: string; 
  is_base: boolean;
}>> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("stock_initial_imports")
    .select("id, label, total_items, total_value, created_at, is_base")
    .eq("period_id", periodId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}
