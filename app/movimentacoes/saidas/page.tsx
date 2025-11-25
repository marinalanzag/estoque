import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem } from "@/lib/utils";
import ExitsTable from "@/components/movements/ExitsTable";
import SaidasFilter from "@/components/movements/SaidasFilter";

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
  };
}

export default async function MovimentacoesSaidasPage({
  searchParams,
}: SaidasPageProps) {
  const supabaseAdmin = getSupabaseAdmin();

  // Buscar arquivos SPED disponíveis
  const { data: spedFiles } = await supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false });

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

  // Buscar importações de XMLs para este SPED
  const { data: xmlImports } = await supabaseAdmin
    .from("xml_sales_imports")
    .select("id, label, total_xmls, total_items, created_at")
    .eq("sped_file_id", selectedFileId)
    .order("created_at", { ascending: false });

  // Suportar múltiplos importIds
  const requestedImportIds = searchParams?.importId
    ? Array.isArray(searchParams.importId)
      ? searchParams.importId
      : [searchParams.importId]
    : null;

  const selectedImportIds =
    requestedImportIds && xmlImports
      ? requestedImportIds.filter((id) =>
          xmlImports.some((imp) => imp.id === id)
        )
      : null;

  // Se nenhum foi selecionado, usar "Todas as importações" (null)

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

  // Criar mapa de produtos para buscar descrições
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
    // Buscar em lotes para evitar query muito grande
    const BATCH_SIZE = 50;
    for (let i = 0; i < selectedImportIds.length; i += BATCH_SIZE) {
      const batchIds = selectedImportIds.slice(i, i + BATCH_SIZE);

      const batchItems = await fetchAllRows(async (from, to) => {
        const { data, error } = await supabaseAdmin
          .from("document_items")
          .select("cod_item, qtd, vl_item, descr_compl, unid")
          .in("xml_import_id", batchIds)
          .eq("movement_type", "saida")
          .range(from, to);

        if (error) {
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

      exitItems.push(...batchItems);
    }
  } else {
    // Se "Todas as importações", buscar todos os xml_import_ids deste sped_file_id
    // e depois buscar os document_items de todas essas importações
    if (xmlImports && xmlImports.length > 0) {
      const allImportIds = xmlImports.map((imp) => imp.id);

      // Buscar em lotes para evitar query muito grande
      const BATCH_SIZE = 50;
      for (let i = 0; i < allImportIds.length; i += BATCH_SIZE) {
        const batchIds = allImportIds.slice(i, i + BATCH_SIZE);

        const batchItems = await fetchAllRows(async (from, to) => {
          const { data, error } = await supabaseAdmin
            .from("document_items")
            .select("cod_item, qtd, vl_item, descr_compl, unid")
            .in("xml_import_id", batchIds)
            .eq("movement_type", "saida")
            .range(from, to);

          if (error) {
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

        exitItems.push(...batchItems);
      }
    }
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
      consolidated.set(codItemNormalizado, {
        cod_item: codItemNormalizado,
        descr_item:
          productInfo?.descr_item ||
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
        xmlImports={xmlImports}
        selectedFileId={selectedFileId}
        selectedImportIds={selectedImportIds}
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
            Nenhum item de saída encontrado para este arquivo SPED.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Importe XMLs de venda para visualizar as saídas.
          </p>
        </div>
      )}
    </div>
  );
}

