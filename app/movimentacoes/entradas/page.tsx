import EntriesTable from "@/components/entries/EntriesTable";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

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

async function fetchDocuments(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  spedFileId: string
) {
  const results: any[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select(
        `
          id,
          serie,
          num_doc,
          dt_doc,
          vl_doc,
          cod_part,
          sped_file_id,
          ind_oper,
          partner:partners (
            id,
            name,
            cnpj,
            cpf
          )
        `
      )
      .eq("sped_file_id", spedFileId)
      .eq("ind_oper", "0")
      .order("dt_doc", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao buscar documentos: ${error.message}`);
    }

    const page = data ?? [];
    results.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return results;
}

async function fetchDocumentItems(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  documentIds: string[]
): Promise<{
  items: any[];
  adjustments: Map<string, number>;
  adjustmentsError?: string;
}> {
  const items: any[] = [];
  const chunkSize = 500;

  for (let i = 0; i < documentIds.length; i += chunkSize) {
    const chunk = documentIds.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("document_items")
      .select(
        "id, document_id, cod_item, num_item, descr_compl, qtd, unid, vl_item, cfop"
      )
      .in("document_id", chunk)
      .order("document_id");

    if (error) {
      throw new Error(`Erro ao buscar itens de documentos: ${error.message}`);
    }

    items.push(...(data ?? []));
  }

  const adjustments = new Map<string, number>();
  let adjustmentsError: string | undefined;

  if (items.length > 0) {
    const itemIds = items.map((item) => item.id);
    for (let i = 0; i < itemIds.length; i += chunkSize) {
      const chunk = itemIds.slice(i, i + chunkSize);
      try {
        const { data, error } = await supabaseAdmin
          .from("document_item_adjustments")
          .select("document_item_id, adjusted_qty")
          .in("document_item_id", chunk);

        if (error) {
          throw error;
        }

        (data ?? []).forEach((adj) => {
          if (adj.document_item_id) {
            adjustments.set(adj.document_item_id, adj.adjusted_qty);
          }
        });
      } catch (error) {
        console.error("Falha ao buscar ajustes de itens:", error);
        adjustmentsError =
          error instanceof Error
            ? `Não foi possível carregar todos os ajustes (parcialmente exibidos). Detalhes: ${error.message}`
            : "Não foi possível carregar todos os ajustes (parcialmente exibidos).";
        break;
      }
    }
  }

  return { items, adjustments, adjustmentsError };
}

interface MovEntradasPageProps {
  searchParams?: {
    fileId?: string;
  };
}

export default async function MovEntradasPage({
  searchParams,
}: MovEntradasPageProps) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: spedFiles, error: spedError } = await supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false });

  if (spedError) {
    throw new Error(`Erro ao buscar arquivos SPED: ${spedError.message}`);
  }

  if (!spedFiles || spedFiles.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Entradas fiscais
        </h1>
        <p className="text-gray-600">
          Nenhum arquivo SPED foi importado ainda.
        </p>
      </div>
    );
  }

  const selectedFileId = searchParams?.fileId ?? spedFiles[0].id;

  const documents = await fetchDocuments(supabaseAdmin, selectedFileId);
  const documentIds = documents.map((doc) => doc.id).filter(Boolean);

  const {
    items: documentItems,
    adjustments,
    adjustmentsError,
  } = await fetchDocumentItems(
    supabaseAdmin,
    documentIds
  );

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

  const conversions = await fetchAllRows(async (from, to) => {
    const { data, error } = await supabaseAdmin
      .from("product_conversions")
      .select("cod_item, unid_conv, fat_conv")
      .eq("sped_file_id", selectedFileId)
      .order("cod_item")
      .range(from, to);
    if (error) {
      throw new Error(`Erro ao buscar conversões: ${error.message}`);
    }
    return data ?? [];
  });

  const productMap = new Map<
    string,
    { descr_item?: string | null; unid_inv?: string | null }
  >();
  (products ?? []).forEach((prod) => {
    if (prod.cod_item) {
      productMap.set(prod.cod_item, {
        descr_item: prod.descr_item,
        unid_inv: prod.unid_inv,
      });
    }
  });

  const conversionMap = new Map<string, { unid_conv: string; fat_conv: number }>();
  (conversions ?? []).forEach((conv) => {
    if (conv.cod_item && conv.unid_conv) {
      conversionMap.set(conv.cod_item, {
        unid_conv: conv.unid_conv,
        fat_conv: conv.fat_conv ?? 1,
      });
    }
  });

  const documentMap = new Map<string, any>();
  documents.forEach((doc) => {
    documentMap.set(doc.id, doc);
  });

  const entries = documentItems
    .map((item) => {
      const document = documentMap.get(item.document_id);
      if (!document) return null;

      const fornecedor =
        document.partner?.name ||
        document.cod_part ||
        "Fornecedor não identificado";
      const fornecedorDoc =
        document.partner?.cnpj ||
        document.partner?.cpf ||
        document.cod_part ||
        null;

      const unidadeProduto = conversionMap.get(item.cod_item);
      const quantidadeNF = item.qtd ?? 0;
      const custoTotal = item.vl_item ?? 0;
      const custoUnitario =
        quantidadeNF !== 0 ? custoTotal / quantidadeNF : custoTotal;
      const adjustedQty = adjustments.get(item.id) ?? null;

      const productInfo = productMap.get(item.cod_item);
      return {
        documentItemId: item.id,
        documentId: item.document_id,
        nota: `${document.serie || ""} ${document.num_doc || ""}`.trim(),
        fornecedor,
        fornecedorDoc,
        dataDocumento: document.dt_doc,
        cod_item: item.cod_item,
        descr_item:
          productInfo?.descr_item ||
          item.descr_compl ||
          "[Sem descrição]",
        unidade_0200: productInfo?.unid_inv || null,
        unidade_nf: item.unid || null,
        quantidade_nf: quantidadeNF,
        unidade_produto: unidadeProduto?.unid_conv || null,
        qtd_produto:
          unidadeProduto && unidadeProduto.fat_conv
            ? quantidadeNF * unidadeProduto.fat_conv
            : quantidadeNF,
        custo_unitario: custoUnitario,
        custo_total: custoTotal,
        adjusted_qty: adjustedQty,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entradas fiscais</h1>
          <p className="text-gray-600 mt-2">
            Revise as notas de entrada importadas do SPED e ajuste quantidades
            quando necessário.
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
          <p>
            Entradas analisadas: <strong>{entries.length}</strong>
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <form className="flex items-end gap-4">
          <div className="flex-1">
            <label
              htmlFor="fileId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Arquivo SPED
            </label>
            <select
              id="fileId"
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
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Aplicar
          </button>
        </form>
      </div>

      {adjustmentsError && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-md p-3 text-sm">
          {adjustmentsError}
        </div>
      )}

      <EntriesTable entries={entries} />
    </div>
  );
}

