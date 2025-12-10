import ConsolidatedTable from "@/components/movements/ConsolidatedTable";
import XmlGroupSelect, {
  XmlGroupOption,
} from "@/components/movements/XmlGroupSelect";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { buildConsolidado } from "@/lib/consolidado";
import { cookies } from "next/headers";
import Link from "next/link";

// CRÍTICO: Desabilitar cache completamente para esta página
// Isso garante que sempre mostre o período ativo correto do banco de dados
// Sem isso, o Vercel pode cachear a página e mostrar períodos desatualizados
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface XmlImport {
    id: string;
  label: string | null;
  created_at: string;
  total_xmls: number | null;
  total_items: number | null;
  sped_file_id: string | null;
}

interface XmlImportGroup {
  key: string;
  sped_file_id: string | null;
  sped_name: string | null;
  date: string;
  import_ids: string[];
  total_xmls: number;
  total_items: number;
  import_count: number;
}

interface ConsolidadoPageProps {
  searchParams?: {
    importId?: string;
    fileId?: string;
    xmlImportId?: string;
    xmlGroupKey?: string;
  };
}


export default async function MovimentacoesConsolidadoPage({
  searchParams,
}: ConsolidadoPageProps) {
  const supabaseAdmin = getSupabaseAdmin();

  // Buscar período ativo usando helper
  const { getActivePeriodFromRequest, getBaseSpedFileForPeriod, getBaseXmlImportsForPeriod, getBaseStockImportForPeriod } = await import("@/lib/periods");

  // ✅ CRÍTICO: NÃO passar searchParams para getActivePeriodFromRequest
  // Sempre buscar o período ativo diretamente do banco, sem influência de query params
  const activePeriod = await getActivePeriodFromRequest();

  console.log("[consolidado/page] ========================================");
  console.log("[consolidado/page] 🔍 DEBUG PERÍODO ATIVO");
  console.log("[consolidado/page] Período retornado:", activePeriod ? `${activePeriod.year}/${activePeriod.month} - ${activePeriod.name}` : "NENHUM");
  console.log("[consolidado/page] ID do período:", activePeriod?.id || "null");
  console.log("[consolidado/page] searchParams recebidos:", searchParams);
  console.log("[consolidado/page] ========================================");

  // Buscar arquivos SPED do período ativo (ou todos se não houver período ativo)
  // IMPORTANTE: Usar a mesma lógica da aba Entradas
  const spedQuery = supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at, is_base")
    .order("uploaded_at", { ascending: false });

  if (activePeriod) {
    spedQuery.eq("period_id", activePeriod.id);
  }

  // Buscar inventários iniciais (filtrar por período se houver período ativo)
  const stockQuery = supabaseAdmin
    .from("stock_initial_imports")
    .select("id, label, total_items, total_value, created_at, period_id, is_base")
    .order("created_at", { ascending: false });

  if (activePeriod) {
    stockQuery.eq("period_id", activePeriod.id);
  }

  const [
    { data: stockImports },
    { data: spedFiles, error: spedError },
    { data: xmlImportsRaw, error: xmlError },
  ] = await Promise.all([
    stockQuery,
    spedQuery,
    supabaseAdmin
      .from("xml_sales_imports")
      .select("id, label, total_xmls, total_items, created_at, sped_file_id, period_id, is_base")
      .order("created_at", { ascending: false }),
  ]);

  if (spedError) {
    throw new Error(`Erro ao buscar arquivos SPED: ${spedError.message}`);
  }
  if (xmlError) {
    throw new Error(`Erro ao buscar importações de XML: ${xmlError.message}`);
  }

  // CRÍTICO: Verificar se há dados vinculados ao período quando há período ativo
  if (activePeriod) {
    if (!stockImports || stockImports.length === 0) {
      return (
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Consolidação de movimentos
          </h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium mb-2">
              ⚠️ Nenhum estoque inicial vinculado ao período ativo
            </p>
            <p className="text-yellow-700 text-sm mb-3">
              Este período não possui estoque inicial importado. Por favor, importe o estoque inicial na página de configuração do período.
            </p>
            <p className="text-yellow-600 text-xs mb-2">
              Período: {activePeriod.label || `${activePeriod.year}/${activePeriod.month}`}
            </p>
            <Link
              href="/periodos/configuracao"
              className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium"
            >
              Configurar período
            </Link>
          </div>
        </div>
      );
    }
    
    if (!spedFiles || spedFiles.length === 0) {
      return (
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Consolidação de movimentos
          </h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium mb-2">
              ⚠️ Nenhum SPED vinculado ao período ativo
            </p>
            <p className="text-yellow-700 text-sm mb-3">
              Este período não possui arquivo SPED importado. Por favor, importe o arquivo SPED na página de importação.
            </p>
            <p className="text-yellow-600 text-xs mb-2">
              Período: {activePeriod.label || `${activePeriod.year}/${activePeriod.month}`}
            </p>
            <Link
              href="/sped/upload"
              className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium"
            >
              Importar SPED
            </Link>
          </div>
        </div>
      );
    }
  } else {
    // Se não há período ativo, verificação genérica (compatibilidade)
    if (!stockImports || stockImports.length === 0 || !spedFiles || spedFiles.length === 0) {
      return (
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Consolidação de movimentos
          </h1>
          <p className="text-gray-600">
            Cadastre pelo menos um estoque inicial e um SPED para visualizar os
            dados consolidados.
          </p>
        </div>
      );
    }
  }

  // IMPORTANTE: Se houver período ativo, SEMPRE usar o SPED base e estoque base, ignorando qualquer seleção manual
  let selectedFileId: string | null = null;
  let selectedImportId: string | null = null;
  let baseSpedId: string | null = null;
  let baseStockId: string | null = null;
  
  if (activePeriod) {
    baseSpedId = await getBaseSpedFileForPeriod(activePeriod.id);
    baseStockId = await getBaseStockImportForPeriod(activePeriod.id);
    
    // Usar o estoque base do período
    if (baseStockId) {
      selectedImportId = baseStockId;
      console.log("[consolidado/page] Usando estoque base do período:", baseStockId);
    } else {
      // Se não há base, tentar qualquer import do período
      const periodImport = stockImports.find((imp: any) => imp.period_id === activePeriod.id);
      if (periodImport) {
        selectedImportId = periodImport.id;
        console.log("[consolidado/page] ⚠️ Não há estoque base, usando qualquer import do período:", periodImport.id);
      }
    }
    
    if (baseSpedId) {
      selectedFileId = baseSpedId;
      console.log("[consolidado/page] Usando SPED base do período:", baseSpedId);
    } else {
      // Se não há base, mostrar aviso
      return (
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Consolidação de movimentos
          </h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium mb-2">
              ⚠️ Nenhum SPED base configurado para este período
            </p>
            <p className="text-yellow-700 text-sm mb-3">
              Configure o SPED base na página de configuração do período.
            </p>
            <Link
              href="/periodos/configuracao"
              className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium"
            >
              Configurar período
            </Link>
          </div>
        </div>
      );
    }
  } else {
    // Se não há período ativo, usar o primeiro SPED disponível (compatibilidade)
    selectedFileId = spedFiles[0]?.id ?? null;
    selectedImportId = stockImports[0]?.id ?? null;
  }
  
  if (!selectedFileId || !selectedImportId) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Consolidação de movimentos
        </h1>
        <p className="text-gray-600">
          Não foi possível determinar um SPED ou importação de estoque. Verifique
          se há dados disponíveis.
        </p>
      </div>
    );
  }

  const xmlImports: XmlImport[] = (xmlImportsRaw ?? []).map((imp: any) => ({
    id: imp.id,
    label: imp.label,
    created_at: imp.created_at,
    total_xmls: imp.total_xmls ?? null,
    total_items: imp.total_items ?? null,
    sped_file_id: imp.sped_file_id ?? null,
  }));

  const spedNameMap = new Map(
    spedFiles.map((file) => [file.id, file.name] as const)
  );

  const groupedMap = new Map<string, XmlImportGroup>();
  xmlImports.forEach((imp) => {
    const dateKey = new Date(imp.created_at).toISOString().split("T")[0];
    const key = `${imp.sped_file_id || "sem-sped"}_${dateKey}`;

    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        key,
        sped_file_id: imp.sped_file_id ?? null,
        sped_name: imp.sped_file_id
          ? spedNameMap.get(imp.sped_file_id) ?? null
          : null,
        date: dateKey,
        import_ids: [],
        total_xmls: 0,
        total_items: 0,
        import_count: 0,
      });
    }

    const group = groupedMap.get(key)!;
    group.import_ids.push(imp.id);
    group.total_xmls += imp.total_xmls ?? 0;
    group.total_items += imp.total_items ?? 0;
    group.import_count += 1;
  });

  const groupedXmlImports = Array.from(groupedMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const requestedXmlGroupKey = searchParams?.xmlGroupKey ?? null;
  const fallbackXmlImportId = searchParams?.xmlImportId ?? null;

  const cookieStore = cookies();
  const cookieGroupKey = cookieStore.get("selectedXmlGroupKey")?.value ?? null;
  const cookieImportIdsRaw =
    cookieStore.get("selectedXmlImportIds")?.value ?? null;
  const cookieImportIds = cookieImportIdsRaw
    ? cookieImportIdsRaw.split(",").filter(Boolean)
    : [];

  const findGroupByKey = (key: string | null) =>
    key ? groupedXmlImports.find((group) => group.key === key) ?? null : null;

  const findGroupByImportId = (importId: string | null) =>
    importId
      ? groupedXmlImports.find((group) =>
          group.import_ids.includes(importId)
        ) ?? null
      : null;

  // Se houver período ativo, SEMPRE buscar XMLs base
  let baseXmlImportIds: string[] = [];
  if (activePeriod) {
    baseXmlImportIds = await getBaseXmlImportsForPeriod(activePeriod.id);
    console.log("[consolidado/page] XMLs base encontrados:", baseXmlImportIds.length);
  }

  let selectedXmlGroup: XmlImportGroup | null =
    findGroupByKey(requestedXmlGroupKey) ??
    findGroupByImportId(fallbackXmlImportId) ??
    findGroupByKey(cookieGroupKey) ??
    null;

  let selectedXmlImportIds = selectedXmlGroup?.import_ids ?? [];

  // IMPORTANTE: Se houver período ativo e XMLs base, SEMPRE usar os XMLs base (ignorar seleções manuais)
  // Isso garante que consolidação e saídas sempre usem a mesma fonte de dados
  if (activePeriod && baseXmlImportIds.length > 0) {
    // Sempre usar XMLs base quando houver período ativo
    selectedXmlImportIds = baseXmlImportIds;
    console.log("[consolidado/page] Usando XMLs base do período (ignorando seleções manuais):", selectedXmlImportIds.length);
    
    // Encontrar grupo que contenha todos os XMLs base
    const baseGroup = groupedXmlImports.find(group => 
      baseXmlImportIds.every(id => group.import_ids.includes(id)) &&
      group.import_ids.every(id => baseXmlImportIds.includes(id))
    );
    if (baseGroup) {
      selectedXmlGroup = baseGroup;
    } else if (baseXmlImportIds.length > 0) {
      // Criar um grupo virtual para os XMLs base se não existir
      const baseImports = xmlImports.filter(imp => baseXmlImportIds.includes(imp.id));
      if (baseImports.length > 0) {
        const firstImport = baseImports[0];
        const dateKey = new Date(firstImport.created_at).toISOString().split("T")[0];
        selectedXmlGroup = {
          key: `base_${dateKey}`,
          sped_file_id: firstImport.sped_file_id,
          sped_name: firstImport.sped_file_id ? spedNameMap.get(firstImport.sped_file_id) ?? null : null,
          date: dateKey,
          import_ids: baseXmlImportIds,
          total_xmls: baseImports.reduce((sum, imp) => sum + (imp.total_xmls ?? 0), 0),
          total_items: baseImports.reduce((sum, imp) => sum + (imp.total_items ?? 0), 0),
          import_count: baseImports.length,
        };
      }
    }
  } else if ((!selectedXmlGroup || selectedXmlImportIds.length === 0) && cookieImportIds.length > 0) {
    // Fallback para cookies se não há base
    selectedXmlImportIds = cookieImportIds;
  } else if (!selectedXmlGroup && fallbackXmlImportId) {
    // Fallback para importId único
    selectedXmlImportIds = [fallbackXmlImportId];
  } else if (!selectedXmlGroup && groupedXmlImports.length > 0) {
    // Último fallback: primeiro grupo disponível
    selectedXmlGroup = groupedXmlImports[0];
    selectedXmlImportIds = selectedXmlGroup.import_ids;
  }

  const xmlGroupOptions: XmlGroupOption[] = groupedXmlImports.map((group) => {
    const dateStr = new Date(group.date).toLocaleDateString("pt-BR");
    const labelParts = [
      group.sped_name || "SPED indefinido",
      dateStr,
      `${group.total_xmls} XMLs`,
      `${group.total_items} itens`,
      `${group.import_count} importação${group.import_count > 1 ? "ões" : ""}`,
    ];
    return {
      key: group.key,
      label: labelParts.join(" • "),
      importIds: group.import_ids,
    };
  });

  if (!selectedFileId || !selectedImportId) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Consolidação de movimentos
        </h1>
        <p className="text-gray-600">
          Não foi possível determinar um SPED ou importação de estoque. Verifique
          se há dados disponíveis.
        </p>
      </div>
    );
  }

  // Logs de debug focados em ENTRADAS (conforme solicitado)
  console.log("[DEBUG ENTRADAS] periodId:", activePeriod?.id);
  console.log("[DEBUG ENTRADAS] spedBaseId:", selectedFileId);
  
  // Verificar quantos documentos de entrada existem no SPED base
  if (selectedFileId) {
    const { data: documentsEntrada } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("sped_file_id", selectedFileId)
      .eq("ind_oper", "0");
    
    const documentIdsEntrada = documentsEntrada?.map(d => d.id) || [];
    
    const { data: documentItemsEntrada } = await supabaseAdmin
      .from("document_items")
      .select("id")
      .in("document_id", documentIdsEntrada);
    
    console.log("[DEBUG ENTRADAS] totalDocumentsEntrada:", documentsEntrada?.length || 0);
    console.log("[DEBUG ENTRADAS] totalDocumentItemsEntrada:", documentItemsEntrada?.length || 0);
  }

  // ✅ CORREÇÃO: Se há período ativo e nenhum XML selecionado, usar XMLs base
  // Isso garante que não haja contaminação de dados de outros períodos
  let xmlsParaUsar = selectedXmlImportIds.length > 0 ? selectedXmlImportIds : undefined;

  if (activePeriod && (!xmlsParaUsar || xmlsParaUsar.length === 0)) {
    const { getBaseXmlImportsForPeriod } = await import("@/lib/periods");
    const baseXmlImportIds = await getBaseXmlImportsForPeriod(activePeriod.id);

    if (baseXmlImportIds.length > 0) {
      xmlsParaUsar = baseXmlImportIds;
      console.log(`[consolidado] Usando ${baseXmlImportIds.length} XMLs base do período para evitar contaminação entre períodos`);
    }
  }

  // ✅ CRÍTICO: Passar selectedImportId (estoque inicial), NUNCA activePeriod.id
  if (!selectedImportId) {
    console.error("[consolidado/page] ❌ ERRO: selectedImportId está null!");
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Consolidação de movimentos
        </h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium mb-2">
            ❌ Erro: Estoque inicial não encontrado
          </p>
          <p className="text-red-700 text-sm">
            O ID do estoque inicial está null. Verifique se há estoque inicial vinculado ao período.
          </p>
        </div>
      </div>
    );
  }

  const consolidado = await buildConsolidado(
    selectedImportId, // ✅ SEMPRE usar selectedImportId (ID do estoque inicial)
    selectedFileId,
    {
      xmlImportIds: xmlsParaUsar,
    }
  );

  const rows = consolidado.rows;
  const totalValor = consolidado.summary.totalValor;
  const totalValorEntradas = consolidado.summary.totalValorEntradas;
  const totalValorSaidas = consolidado.summary.totalValorSaidas;
  const totalQuantidadeFinal = consolidado.summary.totalQuantidadeFinal;
  
  // Log final de entradas após processamento
  // NOTA: Este é a SOMA das quantidades de entrada, não o número de entries
  const totalQuantidadeEntradas = consolidado.rows.reduce((acc, row) => acc + (row.entradas || 0), 0);
  console.log("[DEBUG ENTRADAS] totalQuantidadeEntradas (soma de todas as quantidades):", totalQuantidadeEntradas);
  console.log("[DEBUG ENTRADAS] totalValorEntradas:", totalValorEntradas);
  console.log("[DEBUG ENTRADAS] totalRowsConsolidado:", consolidado.rows.length);

  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Consolidação de movimentos
        </h1>
        <p className="text-gray-600">
          Visão integrada do estoque inicial, entradas ajustadas e saídas
          (XML).
        </p>
        {activePeriod && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              Base do período {activePeriod.label || `${activePeriod.month}/${activePeriod.year}`}:
            </p>
            <div className="mt-1 text-sm text-blue-700 space-y-1">
              {baseSpedId && (
                <p>
                  SPED: <span className="font-medium">{spedFiles.find(f => f.id === baseSpedId)?.name || "Não encontrado"}</span>
                </p>
              )}
              {baseStockId && (
                <p>
                  Estoque: <span className="font-medium">{stockImports.find(s => s.id === baseStockId)?.label || "Não encontrado"}</span>
                </p>
              )}
              {baseXmlImportIds.length > 0 && (
                <p>
                  XMLs: <span className="font-medium">{baseXmlImportIds.length} importação(ões) base</span>
                </p>
              )}
              {activePeriod && (!baseSpedId || !baseStockId || baseXmlImportIds.length === 0) && (
                <p className="text-yellow-700">
                  ⚠️ Alguns arquivos base não estão configurados.{" "}
                  <Link href="/periodos/configuracao" className="underline hover:text-yellow-900">
                    Configure agora
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        {activePeriod && selectedFileId ? (
          // Quando há período ativo e base definida, mostrar formulário de seleção com base pré-selecionada
          <form className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importação do estoque inicial
              </label>
              <select
                name="importId"
                defaultValue={selectedImportId || undefined}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {stockImports && stockImports.length > 0 ? (
                  stockImports
                    .sort((a, b) => {
                      // Ordenar: base primeiro, depois por data (mais recente primeiro)
                      if (a.is_base && !b.is_base) return -1;
                      if (!a.is_base && b.is_base) return 1;
                      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    })
                    .map((imp) => (
                      <option key={imp.id} value={imp.id}>
                        {(imp.is_base ? "✔ BASE - " : "") +
                          (imp.label || "Sem descrição") +
                          " - " +
                          new Date(imp.created_at).toLocaleString("pt-BR")}
                      </option>
                    ))
                ) : (
                  <option value="">Nenhum inventário disponível</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arquivo SPED (entradas/saídas)
              </label>
              <select
                name="fileId"
                defaultValue={selectedFileId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {spedFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {(file.is_base ? "✔ BASE - " : "") +
                      file.name +
                      " (" +
                      new Date(file.uploaded_at).toLocaleDateString("pt-BR") +
                      ")"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arquivo de XML (agrupado)
              </label>
              <XmlGroupSelect
                name="xmlGroupKey"
                options={xmlGroupOptions}
                defaultValue={selectedXmlGroup?.key ?? xmlGroupOptions[0]?.key ?? ""}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                disabledPlaceholder="Nenhuma importação de XML encontrada."
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Aplicar filtros
              </button>
            </div>
          </form>
        ) : (
          // Quando não há base, mostrar formulário de seleção
          <form className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Importação do estoque inicial
              </label>
              <select
                name="importId"
                defaultValue={selectedImportId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {stockImports && stockImports.length > 0 ? (
                  stockImports.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {(imp.label || "Sem descrição") +
                        " - " +
                        new Date(imp.created_at).toLocaleString("pt-BR")}
                    </option>
                  ))
                ) : (
                  <option value="">Nenhum inventário disponível</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arquivo SPED (entradas/saídas)
              </label>
              <select
                name="fileId"
                defaultValue={selectedFileId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {spedFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name} (
                      {new Date(file.uploaded_at).toLocaleDateString("pt-BR")}
                    )
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arquivo de XML (agrupado)
              </label>
              <XmlGroupSelect
                name="xmlGroupKey"
                options={xmlGroupOptions}
                defaultValue={selectedXmlGroup?.key ?? xmlGroupOptions[0]?.key ?? ""}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                disabledPlaceholder="Nenhuma importação de XML encontrada."
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Aplicar filtros
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
          <p className="text-sm text-indigo-700">Valor total teórico</p>
          <p className="text-2xl font-semibold text-indigo-900">
            {totalValor.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-100 rounded-lg p-4">
          <p className="text-sm text-sky-700">Valor total de entradas</p>
          <p className="text-2xl font-semibold text-sky-900">
            {totalValorEntradas.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-lg p-4">
          <p className="text-sm text-rose-700">Valor total de saídas</p>
          <p className="text-2xl font-semibold text-rose-900">
            {totalValorSaidas.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
          <p className="text-sm text-emerald-700">Quantidade final</p>
          <p className="text-2xl font-semibold text-emerald-900">
            {totalQuantidadeFinal.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
          <p className="text-sm text-gray-600">
            Grupo de importações de XML selecionado
          </p>
          {selectedXmlGroup ? (
            <>
              <p className="text-base font-semibold text-gray-900">
                {selectedXmlGroup.sped_name || "SPED indefinido"}
              </p>
              <p className="text-xs text-gray-500">
                Dia {new Date(selectedXmlGroup.date).toLocaleDateString("pt-BR")}
              </p>
              <p className="text-sm text-gray-700">
                Total de XMLs{" "}
                <span className="font-semibold">
                  {selectedXmlGroup.total_xmls}
                </span>
              </p>
              <p className="text-sm text-gray-700">
                Itens importados{" "}
                <span className="font-semibold">
                  {selectedXmlGroup.total_items}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {selectedXmlGroup.import_count} importação
                {selectedXmlGroup.import_count > 1 ? "ões" : ""}
                {" • "}
                {selectedXmlGroup.import_ids.length} registro
                {selectedXmlGroup.import_ids.length > 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Nenhuma importação de XML disponível.
            </p>
          )}
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Itens consolidados</p>
          <p className="text-2xl font-semibold text-gray-900">{rows.length}</p>
        </div>
      </div>

      <ConsolidatedTable rows={rows} />
    </div>
  );
}

