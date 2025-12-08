import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem, fetchProductDescriptions } from "@/lib/utils";
import ExitsTable from "@/components/movements/ExitsTable";
import SaidasFilter from "@/components/movements/SaidasFilter";
import { cookies } from "next/headers";
import {
  getActivePeriodFromRequest,
  getBaseXmlImportsForPeriod,
} from "@/lib/periods";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const page = await fetchPage(from, to);
    if (!page.length) break;
    results.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return results;
}

interface SaidasPageProps {
  searchParams?: {
    fileId?: string;
    importId?: string | string[];
    groupKey?: string;
  };
}

export default async function MovimentacoesSaidasPage({
  searchParams,
}: SaidasPageProps) {
  const supabaseAdmin = getSupabaseAdmin();
  const cookieStore = cookies();
  const cookieGroupKey = cookieStore.get("selectedXmlGroupKey")?.value ?? null;
  const cookieImportIdsRaw =
    cookieStore.get("selectedXmlImportIds")?.value ?? null;
  const cookieImportIds = cookieImportIdsRaw
    ? cookieImportIdsRaw.split(",").filter(Boolean)
    : [];

  // Buscar período ativo usando helper
  const activePeriod = await getActivePeriodFromRequest();

  console.log("[saidas/page] ========================================");
  console.log("[saidas/page] 🔍 DEBUG PERÍODO ATIVO");
  console.log("[saidas/page] Período retornado:", activePeriod ? `${activePeriod.year}/${activePeriod.month} - ${activePeriod.name}` : "NENHUM");
  console.log("[saidas/page] ID do período:", activePeriod?.id || "null");
  console.log("[saidas/page] searchParams recebidos:", searchParams);
  console.log("[saidas/page] ========================================");

  // Buscar arquivos SPED do período ativo (ou todos se não houver período ativo)
  const spedQuery = supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false });

  if (activePeriod) {
    spedQuery.eq("period_id", activePeriod.id);
  }

  const { data: spedFiles } = await spedQuery;

  if (!spedFiles || spedFiles.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Saídas (XMLs)</h1>
        <p className="text-gray-600">
          Nenhum arquivo SPED encontrado. Importe um arquivo SPED primeiro.
        </p>
      </div>
    );
  }

  const requestedFileId = searchParams?.fileId ?? null;
  const selectedFileId =
    requestedFileId && spedFiles.some((file) => file.id === requestedFileId)
      ? requestedFileId
      : spedFiles[0]?.id ?? null;

  if (!selectedFileId) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Saídas (XMLs)</h1>
        <p className="text-gray-600">
          Não foi possível determinar um arquivo SPED.
        </p>
      </div>
    );
  }

  // Buscar grupos de importações de XMLs (usando a mesma API da aba de importações)
  // Isso agrupa por SPED e data, facilitando a seleção
  let groupedXmlImports: Array<{
    key: string;
    sped_file_id: string;
    sped_name: string | null;
    date: string;
    imports: Array<{
      id: string;
      label: string | null;
      total_xmls: number;
      total_items: number;
      created_at: string;
      period_id: string | null;
      sped_file_id: string | null;
    }>;
    total_xmls: number;
    total_items: number;
    all_linked: boolean;
    import_ids: string[];
  }> = [];

  try {
    // Buscar todas as importações do período ativo
    const xmlImportsQuery = supabaseAdmin
      .from("xml_sales_imports")
      .select("id, label, total_xmls, total_items, created_at, period_id, sped_file_id")
      .order("created_at", { ascending: false });

    if (activePeriod) {
      xmlImportsQuery.eq("period_id", activePeriod.id);
    }

    const { data: xmlImports } = await xmlImportsQuery;

    if (xmlImports && xmlImports.length > 0) {
      // Buscar nomes dos arquivos SPED relacionados
      const spedFileIds = Array.from(new Set(xmlImports.map(imp => imp.sped_file_id).filter(Boolean)));
      const spedFilesMap = new Map<string, string>();
      
      if (spedFileIds.length > 0) {
        const { data: spedFiles } = await supabaseAdmin
          .from("sped_files")
          .select("id, name")
          .in("id", spedFileIds);
        
        spedFiles?.forEach(file => {
          spedFilesMap.set(file.id, file.name);
        });
      }

      // Agrupar imports por SPED e data (mesmo dia) - mesma lógica da API
      const groupedMap = new Map<string, typeof groupedXmlImports[0]>();
      
      xmlImports.forEach(imp => {
        const date = new Date(imp.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
        const key = `${imp.sped_file_id || 'null'}_${date}`;
        
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            key,
            sped_file_id: imp.sped_file_id || '',
            sped_name: spedFilesMap.get(imp.sped_file_id || '') || null,
            date,
            imports: [],
            total_xmls: 0,
            total_items: 0,
            all_linked: true,
            import_ids: [],
          });
        }

        const group = groupedMap.get(key)!;
        group.imports.push(imp);
        group.total_xmls += imp.total_xmls || 0;
        group.total_items += imp.total_items || 0;
        group.import_ids.push(imp.id);
        
        if (!imp.period_id) {
          group.all_linked = false;
        }
      });

      // Converter para array e ordenar por data (mais recente primeiro)
      groupedXmlImports = Array.from(groupedMap.values())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    console.log(`[saidas/page] Período ativo: ${activePeriod?.id || "nenhum"}`);
    console.log(`[saidas/page] Grupos de importações encontrados: ${groupedXmlImports.length}`);
  } catch (error) {
    console.error(`[saidas/page] Erro ao buscar grupos de importações:`, error);
  }

  // Se houver período ativo, usar XMLs base
  let baseXmlImportIds: string[] = [];
  if (activePeriod) {
    baseXmlImportIds = await getBaseXmlImportsForPeriod(activePeriod.id);
  }

  // Suportar seleção por grupo (groupKey) ou por importIds individuais
  const requestedGroupKey = searchParams?.groupKey as string | undefined;
  const requestedImportIds = searchParams?.importId
    ? Array.isArray(searchParams.importId)
      ? searchParams.importId
      : [searchParams.importId]
    : null;

  let selectedGroupKey = requestedGroupKey ?? null;
  if (
    !selectedGroupKey &&
    cookieGroupKey &&
    groupedXmlImports.some((group) => group.key === cookieGroupKey)
  ) {
    selectedGroupKey = cookieGroupKey;
  }

  let selectedImportIds: string[] | null = null;

  // ✅ CRÍTICO: Se há período ativo E XMLs base, SEMPRE usar XMLs base (ignorar seleções manuais)
  // Isso garante que não haja contaminação de dados de outros períodos
  if (activePeriod && baseXmlImportIds.length > 0) {
    selectedImportIds = baseXmlImportIds;
    console.log(
      `[saidas/page] ✅ Usando ${baseXmlImportIds.length} XMLs base do período (ignorando seleções manuais)`
    );
  } else if (selectedGroupKey) {
    const selectedGroup = groupedXmlImports.find(
      (group) => group.key === selectedGroupKey
    );
    if (selectedGroup) {
      selectedImportIds = selectedGroup.import_ids;
      console.log(
        `[saidas/page] Grupo selecionado: ${selectedGroup.key}, ${selectedImportIds.length} imports`
      );
    }
  } else if (requestedImportIds) {
    const allImportIds = groupedXmlImports.flatMap((g) => g.import_ids);
    selectedImportIds = requestedImportIds.filter((id) =>
      allImportIds.includes(id)
    );
  } else if (cookieImportIds.length > 0) {
    selectedImportIds = cookieImportIds;
  }

  // Buscar produtos do SPED para pegar descrições
  const products = await fetchAllRows(async (from, to) => {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("cod_item, descr_item, unid_inv")
      .eq("sped_file_id", selectedFileId)
      .order("cod_item")
      .range(from, to);
    if (error) {
      throw new Error(`Erro ao buscar produtos: ${error.message}`);
    }
    return data ?? [];
  });

  // Criar mapa de produtos para buscar descrições (SPED - PRIORIDADE 1)
  const productMap = new Map<
    string,
    { descr_item?: string | null; unid_inv?: string | null }
  >();
  products.forEach((prod) => {
    if (prod.cod_item) {
      const codItemNormalizado = normalizeCodItem(prod.cod_item);
      productMap.set(codItemNormalizado, {
        descr_item: prod.descr_item,
        unid_inv: prod.unid_inv,
      });
    }
  });

  // Buscar itens de saída (apenas dos XMLs importados)
  // Suporta múltiplas importações selecionadas
  const exitItems: Array<{
    cod_item: string;
    qtd: number;
    vl_item: number;
    descr_compl?: string | null;
    unid?: string | null;
  }> = [];

  if (selectedImportIds && selectedImportIds.length > 0) {
    // Se importações específicas foram selecionadas, buscar diretamente por xml_import_id
    console.log(`[saidas/page] Buscando itens de ${selectedImportIds.length} importações selecionadas`);
    // Buscar em lotes para evitar query muito grande
    const BATCH_SIZE = 50;
    for (let i = 0; i < selectedImportIds.length; i += BATCH_SIZE) {
      const batchIds = selectedImportIds.slice(i, i + BATCH_SIZE);
      console.log(`[saidas/page] Buscando lote ${i / BATCH_SIZE + 1} com ${batchIds.length} importIds`);

      const batchItems = await fetchAllRows(async (from, to) => {
        const { data, error } = await supabaseAdmin
          .from("document_items")
          .select("cod_item, qtd, vl_item, descr_compl, unid")
          .in("xml_import_id", batchIds)
          .eq("movement_type", "saida")
          .range(from, to);

        if (error) {
          console.error(`[saidas/page] Erro ao buscar itens:`, error);
          throw new Error(`Erro ao buscar itens de saída: ${error.message}`);
        }

        return (data ?? []).map((item: any) => ({
          cod_item: item.cod_item,
          qtd: Math.abs(Number(item.qtd ?? 0)),
          vl_item: Number(item.vl_item ?? 0),
          descr_compl: item.descr_compl,
          unid: item.unid,
        }));
      });

      console.log(`[saidas/page] Lote ${i / BATCH_SIZE + 1}: ${batchItems.length} itens encontrados`);
      exitItems.push(...batchItems);
    }
  } else {
    // Se "Todas as importações", buscar todos os xml_import_ids do período ativo
    // (independente do SPED, porque o período é o que importa)
    if (groupedXmlImports && groupedXmlImports.length > 0) {
      const allImportIds = groupedXmlImports.flatMap(g => g.import_ids);
      console.log(`[saidas/page] Buscando itens de TODAS as ${allImportIds.length} importações do período ativo (${groupedXmlImports.length} grupos)`);

      // Buscar em lotes para evitar query muito grande
      const BATCH_SIZE = 50;
      for (let i = 0; i < allImportIds.length; i += BATCH_SIZE) {
        const batchIds = allImportIds.slice(i, i + BATCH_SIZE);
        console.log(`[saidas/page] Buscando lote ${i / BATCH_SIZE + 1} com ${batchIds.length} importIds`);

        const batchItems = await fetchAllRows(async (from, to) => {
          const { data, error } = await supabaseAdmin
            .from("document_items")
            .select("cod_item, qtd, vl_item, descr_compl, unid")
            .in("xml_import_id", batchIds)
            .eq("movement_type", "saida")
            .range(from, to);

          if (error) {
            console.error(`[saidas/page] Erro ao buscar itens:`, error);
            throw new Error(`Erro ao buscar itens de saída: ${error.message}`);
          }

          return (data ?? []).map((item: any) => ({
            cod_item: item.cod_item,
            qtd: Math.abs(Number(item.qtd ?? 0)),
            vl_item: Number(item.vl_item ?? 0),
            descr_compl: item.descr_compl,
            unid: item.unid,
          }));
        });

        console.log(`[saidas/page] Lote ${i / BATCH_SIZE + 1}: ${batchItems.length} itens encontrados`);
        exitItems.push(...batchItems);
      }
    } else {
      if (activePeriod) {
        console.log(`[saidas/page] ⚠️ Nenhuma importação de XML vinculada ao período ativo (${activePeriod.id})`);
        console.log(`[saidas/page] 💡 Dica: Verifique se os XMLs foram vinculados ao período na página de configuração.`);
      } else {
        console.log(`[saidas/page] ⚠️ Nenhum período ativo. XMLs devem estar vinculados a um período para aparecer.`);
      }
    }
  }

  console.log(`[saidas/page] Total de itens brutos encontrados: ${exitItems.length}`);

  // Buscar descrições faltantes no cadastro de produtos (PRIORIDADE 2)
  const allCodItems = Array.from(new Set(exitItems.map(item => normalizeCodItem(item.cod_item))));
  const codItemsSemDescricao = allCodItems.filter(cod => {
    const productInfo = productMap.get(cod);
    return !productInfo?.descr_item || productInfo.descr_item.trim() === "";
  });
  
  let catalogDescriptions = new Map<string, string>();
  if (codItemsSemDescricao.length > 0) {
    catalogDescriptions = await fetchProductDescriptions(supabaseAdmin, codItemsSemDescricao);
  }

  // Consolidar por cod_item
  const consolidated = new Map<
    string,
    {
      cod_item: string;
      descr_item: string;
      unid: string | null;
      qtd_total: number;
      valor_total: number;
    }
  >();

  exitItems.forEach((item) => {
    if (!item.cod_item) return;
    const codItemNormalizado = normalizeCodItem(item.cod_item);
    const productInfo = productMap.get(codItemNormalizado);

    const current = consolidated.get(codItemNormalizado);
    if (current) {
      current.qtd_total += item.qtd;
      current.valor_total += item.vl_item;
    } else {
      // Ordem de prioridade: 1) SPED (productInfo), 2) Cadastro de produtos, 3) descr_compl do XML, 4) "[Sem descrição]"
      const descrFromCatalog = catalogDescriptions.get(codItemNormalizado);
      consolidated.set(codItemNormalizado, {
        cod_item: codItemNormalizado,
        descr_item:
          productInfo?.descr_item ||
          descrFromCatalog ||
          item.descr_compl ||
          "[Sem descrição]",
        unid: productInfo?.unid_inv || item.unid || null,
        qtd_total: item.qtd,
        valor_total: item.vl_item,
      });
    }
  });

  const rows = Array.from(consolidated.values()).sort((a, b) =>
    a.cod_item.localeCompare(b.cod_item)
  );

  // Calcular totais
  const totalQuantidade = rows.reduce((acc, row) => acc + row.qtd_total, 0);
  const totalValor = rows.reduce((acc, row) => acc + row.valor_total, 0);
  const totalItens = rows.length;

  // Log para debug (apenas em desenvolvimento)
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[saidas] Importações selecionadas: ${
        selectedImportIds && selectedImportIds.length > 0
          ? selectedImportIds.length + " importação(ões)"
          : "Todas"
      }`
    );
    console.log(`[saidas] Total de itens brutos encontrados: ${exitItems.length}`);
    console.log(`[saidas] Total de itens únicos consolidados: ${totalItens}`);
    console.log(`[saidas] Total quantidade: ${totalQuantidade.toFixed(2)}`);
    console.log(`[saidas] Total valor: R$ ${totalValor.toFixed(2)}`);
  }

  const selectedFile = spedFiles.find((f) => f.id === selectedFileId);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Saídas (XMLs)</h1>
        <p className="text-gray-600">
          Movimentações de saída consolidadas a partir dos XMLs de venda
          importados.
        </p>
      </div>

      {/* Filtro de SPED e Importação */}
        <SaidasFilter
          spedFiles={spedFiles}
          groupedXmlImports={groupedXmlImports}
          selectedFileId={selectedFileId}
          selectedGroupKey={selectedGroupKey}
          selectedImportIds={selectedImportIds}
          activePeriod={activePeriod}
          hasBase={baseXmlImportIds.length > 0}
        />

      {/* Cards de resumo */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <p className="text-sm text-red-700">Valor total vendido</p>
          <p className="text-2xl font-semibold text-red-900">
            {totalValor.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
          <p className="text-sm text-orange-700">Quantidade total vendida</p>
          <p className="text-2xl font-semibold text-orange-900">
            {totalQuantidade.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Itens únicos</p>
          <p className="text-2xl font-semibold text-gray-900">{totalItens}</p>
        </div>
      </div>

      {/* Tabela de saídas */}
      {rows.length > 0 ? (
        <ExitsTable
          rows={rows}
          fileName={selectedFile?.name ?? "Arquivo SPED"}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">
            Nenhum item de saída encontrado.
          </p>
          <div className="mt-4 space-y-2">
            {!activePeriod ? (
              <p className="text-sm text-orange-600">
                ⚠️ Nenhum período ativo selecionado. Selecione um período para visualizar as saídas.
              </p>
            ) : groupedXmlImports.length === 0 ? (
              <>
                <p className="text-sm text-orange-600">
                  ⚠️ Nenhuma importação de XML vinculada ao período ativo.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Importe XMLs de venda e vincule-os ao período na página de configuração.
                </p>
                <Link
                  href="/sped/upload-xml-sales"
                  className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  Importar XMLs
                </Link>
              </>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                Importe XMLs de venda ou selecione uma importação existente para visualizar as saídas.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

