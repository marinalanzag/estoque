import ConsolidatedTable from "@/components/movements/ConsolidatedTable";
import XmlGroupSelect, {
  XmlGroupOption,
} from "@/components/movements/XmlGroupSelect";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { buildConsolidado } from "@/lib/consolidado";
import { cookies } from "next/headers";

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

  // Buscar período ativo
  const { data: activePeriod } = await supabaseAdmin
    .from("periods")
    .select("id")
    .eq("is_active", true)
    .single();

  // Buscar arquivos SPED do período ativo (ou todos se não houver período ativo)
  // IMPORTANTE: Usar a mesma lógica da aba Entradas
  const spedQuery = supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false });

  if (activePeriod) {
    spedQuery.eq("period_id", activePeriod.id);
  }

  const [
    { data: stockImports },
    { data: spedFiles, error: spedError },
    { data: xmlImportsRaw, error: xmlError },
  ] = await Promise.all([
    supabaseAdmin
      .from("stock_initial_imports")
      .select("id, label, total_items, total_value, created_at")
      .order("created_at", { ascending: false }),
    spedQuery,
    supabaseAdmin
      .from("xml_sales_imports")
      .select("id, label, total_xmls, total_items, created_at, sped_file_id")
      .order("created_at", { ascending: false }),
  ]);

  if (spedError) {
    throw new Error(`Erro ao buscar arquivos SPED: ${spedError.message}`);
  }
  if (xmlError) {
    throw new Error(`Erro ao buscar importações de XML: ${xmlError.message}`);
  }

  if (!stockImports || stockImports.length === 0 || !spedFiles) {
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

  const requestedImportId = searchParams?.importId ?? null;
  const selectedImportId =
    requestedImportId &&
    stockImports.some((imp) => imp.id === requestedImportId)
      ? requestedImportId
      : stockImports[0].id;

  const requestedFileId = searchParams?.fileId ?? null;
  const selectedFileId =
    requestedFileId && spedFiles.some((file) => file.id === requestedFileId)
      ? requestedFileId
      : spedFiles[0]?.id ?? null;

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

  let selectedXmlGroup: XmlImportGroup | null =
    findGroupByKey(requestedXmlGroupKey) ??
    findGroupByImportId(fallbackXmlImportId) ??
    findGroupByKey(cookieGroupKey) ??
    null;

  if (!selectedXmlGroup && groupedXmlImports.length > 0) {
    selectedXmlGroup = groupedXmlImports[0];
  }

  let selectedXmlImportIds = selectedXmlGroup?.import_ids ?? [];

  if ((!selectedXmlGroup || selectedXmlImportIds.length === 0) && cookieImportIds.length > 0) {
    selectedXmlImportIds = cookieImportIds;
  } else if (!selectedXmlGroup && fallbackXmlImportId) {
    selectedXmlImportIds = [fallbackXmlImportId];
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

  const consolidado = await buildConsolidado(
    selectedImportId ?? activePeriod?.id ?? null,
    selectedFileId,
    {
      xmlImportIds:
        selectedXmlImportIds.length > 0 ? selectedXmlImportIds : undefined,
    }
  );

  const rows = consolidado.rows;
  const totalValor = consolidado.summary.totalValor;
  const totalValorEntradas = consolidado.summary.totalValorEntradas;
  const totalValorSaidas = consolidado.summary.totalValorSaidas;
  const totalQuantidadeFinal = consolidado.summary.totalQuantidadeFinal;

  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Consolidação de movimentos
        </h1>
        <p className="text-gray-600">
          Visão integrada do estoque inicial, entradas ajustadas e saídas
          (XML). Ajuste os filtros para comparar diferentes arquivos SPED ou
          bases de estoque.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
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
              {stockImports.map((imp) => (
                <option key={imp.id} value={imp.id}>
                  {(imp.label || "Sem descrição") +
                    " - " +
                    new Date(imp.created_at).toLocaleString("pt-BR")}
                </option>
              ))}
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

