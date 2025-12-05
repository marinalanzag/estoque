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
 * Alias para getAvailablePeriods - retorna todos os períodos
 * Centraliza a leitura de períodos para uso em Server Components
 */
export async function getAllPeriods(): Promise<Period[]> {
  return getAvailablePeriods();
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
 * Lê o período ativo SEMPRE do banco de dados (fonte de verdade).
 * Valida query params/cookies apenas se corresponderem ao período realmente ativo.
 * 
 * Retorna o registro completo de periods ou null.
 */
export async function getActivePeriodFromRequest(
  searchParams?: { period?: string } | URLSearchParams
): Promise<Period | null> {
  const supabaseAdmin = getSupabaseAdmin();

  // SEMPRE buscar período ativo no banco PRIMEIRO (fonte de verdade)
  // IMPORTANTE: Usar array ao invés de .single() para lidar com múltiplos períodos ativos
  const { data: activePeriods, error } = await supabaseAdmin
    .from("periods")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false }); // Mais recente primeiro

  if (error) {
    console.error("[getActivePeriodFromRequest] Erro ao buscar período ativo:", error);
    return null;
  }

  // Se houver múltiplos períodos ativos, corrigir no banco
  if (activePeriods && activePeriods.length > 1) {
    console.warn(
      `[getActivePeriodFromRequest] ⚠️ Encontrados ${activePeriods.length} períodos ativos. Corrigindo no banco...`
    );
    
    const mostRecent = activePeriods[0];
    const duplicates = activePeriods.slice(1);
    
    if (duplicates.length > 0) {
      const duplicateIds = duplicates.map((p) => p.id);
      await supabaseAdmin
        .from("periods")
        .update({ is_active: false })
        .in("id", duplicateIds);
      
      console.log(
        `[getActivePeriodFromRequest] ✅ ${duplicates.length} períodos duplicados foram desativados. Mantendo apenas ${mostRecent.year}/${mostRecent.month}.`
      );
    }
    
    // Retornar o mais recente
    return mostRecent as Period;
  }

  // Se não houver período ativo, retornar null
  if (!activePeriods || activePeriods.length === 0) {
    console.log("[getActivePeriodFromRequest] Nenhum período ativo encontrado no banco.");
    return null;
  }

  // Um único período ativo encontrado - usar este como fonte de verdade
  const activePeriod = activePeriods[0] as Period;
  
  // Validar se query param corresponde ao período ativo (para sincronização de URL)
  let periodParam: string | null = null;
  if (searchParams) {
    if (searchParams instanceof URLSearchParams) {
      periodParam = searchParams.get("period");
    } else if (typeof searchParams === "object" && "period" in searchParams) {
      periodParam = searchParams.period || null;
    }
  }
  
  // Se há query param mas não corresponde ao período ativo, logar aviso
  if (periodParam) {
    const expectedParam = `${activePeriod.year}-${activePeriod.month}`;
    if (periodParam !== expectedParam) {
      console.warn(
        `[getActivePeriodFromRequest] ⚠️ Query param (${periodParam}) não corresponde ao período ativo (${expectedParam}). Usando período ativo do banco.`
      );
    }
  }
  
  console.log(
    `[getActivePeriodFromRequest] ✅ Período ativo encontrado: ${activePeriod.year}/${activePeriod.month} - ${activePeriod.name}`
  );
  
  return activePeriod;
}

/**
 * Busca o período ativo do banco de dados (sem validação de query params/cookies)
 * Centraliza a leitura do período ativo para uso em Server Components
 */
export async function getActivePeriod(): Promise<Period | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: activePeriods, error } = await supabaseAdmin
    .from("periods")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getActivePeriod] Erro ao buscar período ativo:", error);
    return null;
  }

  if (!activePeriods || activePeriods.length === 0) {
    return null;
  }

  // Se houver múltiplos períodos ativos, retornar o mais recente
  return activePeriods[0] as Period;
}

/**
 * Busca o SPED base do período (is_base = true para o period_id)
 */
export async function getBaseSpedFileForPeriod(
  periodId: string
): Promise<string | null> {
  const supabaseAdmin = getSupabaseAdmin();

  console.log(`[getBaseSpedFileForPeriod] 🔍 Buscando SPED base para período: ${periodId}`);
  
  // Primeiro, buscar todos os SPEDs do período para debug
  const { data: allSpedFiles, error: allError } = await supabaseAdmin
    .from("sped_files")
    .select("id, name, is_base, period_id")
    .eq("period_id", periodId);
  
  if (allError) {
    console.error(`[getBaseSpedFileForPeriod] ❌ Erro ao buscar SPEDs do período:`, allError);
  }
  
  console.log(`[getBaseSpedFileForPeriod] 📊 Total de SPEDs vinculados ao período: ${allSpedFiles?.length || 0}`);
  if (allSpedFiles && allSpedFiles.length > 0) {
    allSpedFiles.forEach(sped => {
      console.log(`  - ${sped.name} (id: ${sped.id.substring(0, 8)}..., is_base: ${sped.is_base || false}, period_id: ${sped.period_id?.substring(0, 8) || 'null'}...)`);
    });
  } else {
    console.warn(`[getBaseSpedFileForPeriod] ⚠️ Nenhum SPED encontrado vinculado ao período ${periodId}`);
    
    // Buscar todos os SPEDs marcados como base para debug
    const { data: allBaseSpeds } = await supabaseAdmin
      .from("sped_files")
      .select("id, name, is_base, period_id")
      .eq("is_base", true);
    
    if (allBaseSpeds && allBaseSpeds.length > 0) {
      console.warn(`[getBaseSpedFileForPeriod] ⚠️ Encontrados ${allBaseSpeds.length} SPED(s) marcados como base em outros períodos:`);
      allBaseSpeds.forEach(sped => {
        console.warn(`  - ${sped.name} (period_id: ${sped.period_id?.substring(0, 8) || 'null'}...)`);
      });
    }
  }
  
  // Buscar SPED base do período
  const { data, error } = await supabaseAdmin
    .from("sped_files")
    .select("id, name, is_base, period_id")
    .eq("period_id", periodId)
    .eq("is_base", true)
    .maybeSingle();

  if (error) {
    console.error(`[getBaseSpedFileForPeriod] ❌ Erro ao buscar SPED base:`, error);
    return null;
  }

  if (!data) {
    console.warn(`[getBaseSpedFileForPeriod] ⚠️ Nenhum SPED base encontrado para o período ${periodId}`);
    
    // Se houver SPEDs vinculados mas nenhum como base, usar o primeiro como fallback
    if (allSpedFiles && allSpedFiles.length > 0) {
      console.warn(`[getBaseSpedFileForPeriod] ⚠️ Usando primeiro SPED do período como fallback (${allSpedFiles[0].name})`);
      return allSpedFiles[0].id;
    }
    
    return null;
  }

  console.log(`[getBaseSpedFileForPeriod] ✅ SPED base encontrado: ${data.name} (id: ${data.id.substring(0, 8)}...)`);
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
  period_id: string | null;
}>> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("stock_initial_imports")
    .select("id, label, total_items, total_value, created_at, is_base, period_id")
    .eq("period_id", periodId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

/**
 * Busca todas as importações de estoque inicial não vinculadas a nenhum período
 */
export async function getUnlinkedStockImports(): Promise<Array<{ 
  id: string; 
  label: string | null; 
  total_items: number | null; 
  total_value: number | null; 
  created_at: string; 
  is_base: boolean;
  period_id: string | null;
}>> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("stock_initial_imports")
    .select("id, label, total_items, total_value, created_at, is_base, period_id")
    .is("period_id", null)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}
