import DashboardTabs from "@/components/dashboard/DashboardTabs";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { fetchProductDescriptions } from "@/lib/utils";

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

interface HomePageProps {
  searchParams?: {
    importId?: string;
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: stockImports, error: stockImportsError } =
    await supabaseAdmin
      .from("stock_initial_imports")
      .select("id, label, total_items, total_value, created_at")
      .order("created_at", { ascending: false });

  if (stockImportsError) {
    throw new Error(
      `Erro ao buscar histórico de importações: ${stockImportsError.message}`
    );
  }

  const requestedImportId = searchParams?.importId ?? null;
  const selectedImportId =
    requestedImportId &&
    (stockImports || []).some((imp) => imp.id === requestedImportId)
      ? requestedImportId
      : stockImports?.[0]?.id ?? null;

  const stockData =
    selectedImportId !== null
      ? await fetchAllRows(async (from, to) => {
          const { data, error } = await supabaseAdmin
            .from("stock_initial")
            .select(
              "cod_item, descr_item, qtd, unid, unit_cost, created_at, import_id"
            )
            .eq("import_id", selectedImportId)
            .order("cod_item")
            .range(from, to);
          if (error) {
            throw new Error(`Erro ao buscar estoque inicial: ${error.message}`);
          }
          return data ?? [];
        })
      : [];

  const { data: latestSpedFile } = await supabaseAdmin
    .from("sped_files")
    .select("id")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  const latestSpedId = latestSpedFile?.[0]?.id ?? null;

  const productDescriptionMap = new Map<string, string>();

  if (latestSpedId) {
    const productData = await fetchAllRows(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("cod_item, descr_item")
        .eq("sped_file_id", latestSpedId)
        .order("cod_item")
        .range(from, to);
      if (error) {
        throw new Error(`Erro ao buscar produtos do SPED: ${error.message}`);
      }
      return data ?? [];
    });

    for (const product of productData) {
      if (product.cod_item && product.descr_item) {
        productDescriptionMap.set(product.cod_item, product.descr_item);
      }
    }
  }

  const inventoryMap = new Map<
    string,
    {
      cod_item: string;
      descr_item: string;
      qtd: number;
      unid?: string | null;
      unit_cost: number | null;
      valor_total: number;
    }
  >();

  // Buscar descrições faltantes no cadastro de produtos (PRIORIDADE 2)
  const codItemsSemDescricao = stockData
    .filter(item => {
      const descrFromStock = item.descr_item?.trim();
      const descrFromSped = productDescriptionMap.get(item.cod_item);
      return (!descrFromStock || descrFromStock === "") && 
             (!descrFromSped || descrFromSped.trim() === "");
    })
    .map(item => item.cod_item);
  
  let catalogDescriptions = new Map<string, string>();
  if (codItemsSemDescricao.length > 0) {
    catalogDescriptions = await fetchProductDescriptions(supabaseAdmin, codItemsSemDescricao);
  }

  for (const item of stockData) {
    // Ordem de prioridade: 1) item.descr_item, 2) SPED (productDescriptionMap), 3) Cadastro de produtos, 4) "[Sem descrição]"
    const descrFromCatalog = catalogDescriptions.get(item.cod_item);
    const descr =
      item.descr_item?.trim() ||
      productDescriptionMap.get(item.cod_item) ||
      descrFromCatalog ||
      "[Sem descrição]";
    const quantity = item.qtd ?? 0;
    const lineUnitCost = item.unit_cost ?? 0;
    const lineValue = lineUnitCost * quantity;

    const existing = inventoryMap.get(item.cod_item);

    if (!existing) {
      inventoryMap.set(item.cod_item, {
        cod_item: item.cod_item,
        descr_item: descr,
        qtd: quantity,
        unid: item.unid,
        unit_cost: quantity > 0 ? lineValue / quantity : null,
        valor_total: lineValue,
      });
    } else {
      const newQtd = existing.qtd + quantity;
      const newValor = existing.valor_total + lineValue;
      inventoryMap.set(item.cod_item, {
        cod_item: item.cod_item,
        descr_item: existing.descr_item || descr,
        qtd: newQtd,
        unid: existing.unid ?? item.unid,
        unit_cost: newQtd !== 0 ? newValor / newQtd : existing.unit_cost,
        valor_total: newValor,
      });
    }
  }

  const inventoryRows = Array.from(inventoryMap.values());

  const inventorySummary = {
    totalItems: inventoryRows.length,
    totalQuantity: inventoryRows.reduce((acc, row) => acc + row.qtd, 0),
    totalValue: inventoryRows.reduce((acc, row) => acc + row.valor_total, 0),
  };

  return (
    <DashboardTabs
      inventoryRows={inventoryRows}
      inventorySummary={inventorySummary}
      stockImports={stockImports ?? []}
      currentImportId={selectedImportId}
    />
  );
}
