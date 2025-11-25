import ConsolidatedTable, {
  ConsolidatedRow,
} from "@/components/movements/ConsolidatedTable";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem } from "@/lib/utils";

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

async function fetchDocumentIdsByIndOper(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  spedFileId: string,
  indOper: "0" | "1"
) {
  const documentIds: string[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, ind_oper")
      .eq("sped_file_id", spedFileId)
      .order("dt_doc", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(
        `Erro ao buscar documentos com ind_oper=${indOper}: ${error.message}`
      );
    }

    const page = data ?? [];
    page.forEach((doc) => {
      const value = (doc.ind_oper ?? "").trim();
      if (value === indOper && doc.id) {
        documentIds.push(doc.id);
      }
    });

    if (page.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return documentIds;
}

async function fetchEntryAggregates(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  spedFileId: string
) {
  const documentIds = await fetchDocumentIdsByIndOper(
    supabaseAdmin,
    spedFileId,
    "0"
  );
  if (documentIds.length === 0) {
    return new Map<string, { qty: number; valor: number }>();
  }

  const aggregate = new Map<string, { qty: number; valor: number }>();
  const chunkSize = 1000;

  for (let i = 0; i < documentIds.length; i += chunkSize) {
    const chunk = documentIds.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from("document_items")
      .select(
        `
        id,
        document_id,
        cod_item,
        qtd,
        vl_item,
        document_item_adjustments(adjusted_qty)
      `
      )
      .in("document_id", chunk);

    if (error) {
      throw new Error(`Erro ao buscar itens de entrada: ${error.message}`);
    }

    const items = data ?? [];
    if (items.length === 0) continue;

    items.forEach((item) => {
      if (!item.cod_item) return;
      // Normalizar cod_item para garantir agregação correta
      const codItemNormalizado = normalizeCodItem(item.cod_item);
      const adjustedQty =
        item.document_item_adjustments?.[0]?.adjusted_qty ?? null;
      const qty =
        adjustedQty ?? (item.qtd === null ? 0 : Number(item.qtd));
      const valor = item.vl_item ?? 0;

      const current = aggregate.get(codItemNormalizado) || {
        qty: 0,
        valor: 0,
      };
      current.qty += qty;
      current.valor += valor;
      aggregate.set(codItemNormalizado, current);
    });
  }

  return aggregate;
}

async function fetchExitAggregates(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  spedFileId: string
) {
  const aggregate = new Map<
    string,
    { qty: number; valor: number; descr?: string | null; unid?: string | null }
  >();

  // Buscar todas as importações de XMLs deste SPED
  const { data: xmlImports } = await supabaseAdmin
    .from("xml_sales_imports")
    .select("id")
    .eq("sped_file_id", spedFileId);

  if (!xmlImports || xmlImports.length === 0) {
    // Se não há importações de XMLs, retornar agregado vazio
    return aggregate;
  }

  // Buscar itens de saída usando xml_import_id (mesma lógica da página de saídas)
  // Isso garante que pegamos todos os itens dos XMLs importados
  const allImportIds = xmlImports.map((imp) => imp.id);
  const PAGE_SIZE = 1000;
  const BATCH_SIZE = 50;

  // Buscar em lotes de importações para evitar query muito grande
  for (let i = 0; i < allImportIds.length; i += BATCH_SIZE) {
    const batchIds = allImportIds.slice(i, i + BATCH_SIZE);

    let from = 0;
    while (true) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabaseAdmin
        .from("document_items")
        .select("cod_item, movement_qty, movement_type, qtd, vl_item, descr_compl, unid")
        .in("xml_import_id", batchIds)
        .eq("movement_type", "saida")
        .range(from, to);

      if (error) {
        throw new Error(`Erro ao buscar itens de saída: ${error.message}`);
      }

      const page = data ?? [];
      if (page.length === 0) {
        break;
      }

      page.forEach((item: any) => {
        if (!item.cod_item) return;
        // Garantir que só processamos itens de saída
        if (item.movement_type !== "saida") return;
        
        // Normalizar cod_item para garantir agregação correta
        const codItemNormalizado = normalizeCodItem(item.cod_item);
        
        const qty = item.movement_qty !== null
          ? Math.abs(Number(item.movement_qty))
          : Math.abs(item.qtd ?? 0);
        const valor = Number(item.vl_item ?? 0);

        const current = aggregate.get(codItemNormalizado) || {
          qty: 0,
          valor: 0,
          descr: item.descr_compl ?? null,
          unid: item.unid ?? null,
        };

        current.qty += qty;
        current.valor += valor;
        if (!current.descr && item.descr_compl) {
          current.descr = item.descr_compl;
        }
        if (!current.unid && item.unid) {
          current.unid = item.unid;
        }

        aggregate.set(codItemNormalizado, current);
      });

      if (page.length < PAGE_SIZE) {
        break;
      }
      from += PAGE_SIZE;
    }
  }

  return aggregate;
}

interface ConsolidadoPageProps {
  searchParams?: {
    fileId?: string;
    importId?: string;
  };
}

export default async function MovimentacoesConsolidadoPage({
  searchParams,
}: ConsolidadoPageProps) {
  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: stockImports }, { data: spedFiles }] = await Promise.all([
    supabaseAdmin
      .from("stock_initial_imports")
      .select("id, label, total_items, total_value, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("sped_files")
      .select("id, name, uploaded_at")
      .order("uploaded_at", { ascending: false }),
  ]);

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

  const stockData = await fetchAllRows(async (from, to) => {
    const { data, error } = await supabaseAdmin
      .from("stock_initial")
      .select("cod_item, descr_item, qtd, unid, unit_cost, import_id")
      .eq("import_id", selectedImportId)
      .order("cod_item")
      .range(from, to);
    if (error) {
      throw new Error(`Erro ao buscar estoque inicial: ${error.message}`);
    }
    return data ?? [];
  });

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

  const [entradaAggregates, saidaAggregates] = await Promise.all([
    fetchEntryAggregates(supabaseAdmin, selectedFileId),
    fetchExitAggregates(supabaseAdmin, selectedFileId),
  ]);

  const productMap = new Map<
    string,
    { descr_item?: string | null; unid_inv?: string | null }
  >();
  products.forEach((prod) => {
    if (prod.cod_item) {
      // Normalizar cod_item para garantir busca correta
      const codItemNormalizado = normalizeCodItem(prod.cod_item);
      productMap.set(codItemNormalizado, {
        descr_item: prod.descr_item,
        unid_inv: prod.unid_inv,
      });
    }
  });

  const stockMap = new Map<
    string,
    { qty: number; valor: number; descr?: string | null; unid?: string | null }
  >();
  stockData.forEach((item) => {
    if (!item.cod_item) return;
    // Normalizar cod_item para garantir agregação correta
    const codItemNormalizado = normalizeCodItem(item.cod_item);
    const qty = item.qtd ?? 0;
    const valorLinha = (item.unit_cost ?? 0) * qty;
    const current = stockMap.get(codItemNormalizado);
    if (current) {
      current.qty += qty;
      current.valor += valorLinha;
      if (!current.descr && item.descr_item) current.descr = item.descr_item;
      if (!current.unid && item.unid) current.unid = item.unid;
    } else {
      stockMap.set(codItemNormalizado, {
        qty,
        valor: valorLinha,
        descr: item.descr_item,
        unid: item.unid,
      });
    }
  });

  const codigos = new Set<string>([
    ...Array.from(stockMap.keys()),
    ...Array.from(entradaAggregates.keys()),
    ...Array.from(saidaAggregates.keys()),
  ]);

  const rows: ConsolidatedRow[] = Array.from(codigos).map((cod) => {
    const stock = stockMap.get(cod);
    const entradas = entradaAggregates.get(cod);
    const saidas = saidaAggregates.get(cod);
    const productInfo = productMap.get(cod);

    const qtdInicial = stock?.qty ?? 0;
    const valorInicial = stock?.valor ?? 0;
    const qtdEntradas = entradas?.qty ?? 0;
    const valorEntradas = entradas?.valor ?? 0;
    const qtdSaidas = saidas?.qty ?? 0;
    const valorSaidas = saidas?.valor ?? 0;
    const qtdFinal = qtdInicial + qtdEntradas - qtdSaidas;
    const baseQty = qtdInicial + qtdEntradas;
    const custoMedio =
      baseQty > 0 ? (valorInicial + valorEntradas) / baseQty : null;
    const valorTotal =
      custoMedio !== null
        ? custoMedio * qtdFinal
        : valorInicial + valorEntradas - valorSaidas;

    const descr =
      stock?.descr ||
      productInfo?.descr_item ||
      saidas?.descr ||
      (qtdEntradas > 0 ? "(sem cadastro no estoque inicial)" : "[Sem descrição]");

    const unidade =
      stock?.unid ||
      productInfo?.unid_inv ||
      saidas?.unid ||
      (qtdEntradas > 0 ? "UN" : null);

    return {
      cod_item: cod,
      descr_item: descr,
      unidade,
      qtd_inicial: qtdInicial,
      valor_inicial: valorInicial,
      entradas: qtdEntradas,
      valor_entradas: valorEntradas,
      saidas: qtdSaidas,
      qtd_final: qtdFinal,
      custo_medio: custoMedio,
      valor_total: valorTotal,
    };
  });

  rows.sort((a, b) => a.cod_item.localeCompare(b.cod_item));

  const totalValor = rows.reduce((acc, row) => acc + row.valor_total, 0);
  const totalQuantidadeFinal = rows.reduce(
    (acc, row) => acc + row.qtd_final,
    0
  );
  const totalValorEntradas = Array.from(entradaAggregates.values()).reduce(
    (acc, item) => acc + item.valor,
    0
  );
  const totalValorSaidas = Array.from(saidaAggregates.values()).reduce(
    (acc, item) => acc + item.valor,
    0
  );

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
        <form className="grid md:grid-cols-2 gap-4">
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
          <div className="md:col-span-2 flex justify-end">
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
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Itens consolidados</p>
          <p className="text-2xl font-semibold text-gray-900">{rows.length}</p>
        </div>
      </div>

      <ConsolidatedTable rows={rows} />
    </div>
  );
}

