import EntriesTable from "@/components/entries/EntriesTable";
import RefreshOnMount from "@/components/entries/RefreshOnMount";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { buildEntradasItems } from "@/lib/entradas";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
    const itemIds = items.map((item) => item.id).filter(Boolean); // Filtrar IDs nulos/vazios
    console.log(`[fetchDocumentItems] Buscando ajustes para ${itemIds.length} itens (de ${items.length} total)`);
    
    if (itemIds.length === 0) {
      console.warn(`[fetchDocumentItems] Nenhum ID válido encontrado nos itens!`);
      return { items, adjustments, adjustmentsError: "Nenhum ID de item válido encontrado" };
    }
    
    // Reduzir tamanho do chunk para evitar "Bad Request" (Supabase tem limite)
    const adjustmentChunkSize = 50; // Reduzir para 50 para evitar problemas
    
    for (let i = 0; i < itemIds.length; i += adjustmentChunkSize) {
      const chunk = itemIds.slice(i, i + adjustmentChunkSize);
      try {
        console.log(`[fetchDocumentItems] Buscando chunk ${Math.floor(i / adjustmentChunkSize) + 1}: ${chunk.length} IDs`);
        
        // Verificar se todos os IDs são válidos (UUIDs)
        const validChunk = chunk.filter(id => {
          const isValid = typeof id === 'string' && id.length > 0;
          if (!isValid) {
            console.warn(`[fetchDocumentItems] ID inválido encontrado: ${id}`);
          }
          return isValid;
        });
        
        if (validChunk.length === 0) {
          console.warn(`[fetchDocumentItems] Chunk sem IDs válidos, pulando...`);
          continue;
        }
        
        const { data, error } = await supabaseAdmin
          .from("document_item_adjustments")
          .select("document_item_id, adjusted_qty")
          .in("document_item_id", validChunk);
        
        if (error) {
          console.error(`[fetchDocumentItems] Erro na busca do chunk:`, error);
          console.error(`[fetchDocumentItems] IDs do chunk que falhou:`, validChunk.slice(0, 10));
          // Continuar com o próximo chunk ao invés de quebrar tudo
          adjustmentsError = `Erro ao buscar alguns ajustes: ${error.message}`;
          continue;
        }
        
        console.log(`[fetchDocumentItems] Resultado da busca: ${(data ?? []).length} ajustes encontrados`);

        // Processar ajustes (pode haver duplicatas por causa do unique constraint, pegar o primeiro)
        const seenIds = new Set<string>();
        (data ?? []).forEach((adj) => {
          if (adj.document_item_id && !seenIds.has(adj.document_item_id)) {
            if (adj.adjusted_qty !== null && adj.adjusted_qty !== undefined) {
              const qty = Number(adj.adjusted_qty);
              adjustments.set(adj.document_item_id, qty);
              seenIds.add(adj.document_item_id);
              console.log(`[fetchDocumentItems] Ajuste encontrado: document_item_id=${adj.document_item_id}, adjusted_qty=${qty}`);
            }
          }
        });
        
        console.log(`[fetchDocumentItems] Chunk processado: ${validChunk.length} itens, ${(data ?? []).length} ajustes encontrados, total no Map: ${adjustments.size}`);
      } catch (error) {
        console.error("Falha ao buscar ajustes de itens:", error);
        adjustmentsError =
          error instanceof Error
            ? `Não foi possível carregar todos os ajustes (parcialmente exibidos). Detalhes: ${error.message}`
            : "Não foi possível carregar todos os ajustes (parcialmente exibidos).";
        // Continuar processando outros chunks ao invés de quebrar
        continue;
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

  // Buscar período ativo
  const { data: activePeriod } = await supabaseAdmin
    .from("periods")
    .select("id")
    .eq("is_active", true)
    .single();

  // Buscar arquivos SPED do período ativo (ou todos se não houver período ativo)
  const spedQuery = supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false });

  if (activePeriod) {
    spedQuery.eq("period_id", activePeriod.id);
  }

  const { data: spedFiles, error: spedError } = await spedQuery;

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
  const activePeriodId = activePeriod?.id ?? null;
  
  // Debug: verificar qual SPED está sendo usado
  console.log(`[entradas/page] SPED selecionado: ${selectedFileId}`);
  console.log("[DEBUG ENTRADAS] activePeriodId:", activePeriodId);
  console.log("[DEBUG ENTRADAS] spedFileId:", selectedFileId);

  // Usar a função compartilhada para construir entries (mesma lógica usada na consolidação)
  const entries = await buildEntradasItems(
    supabaseAdmin,
    selectedFileId,
    "ENTRADAS"
  );
  
  
  // Debug: contar quantos entries têm adjusted_qty
  const entriesComAjuste = entries.filter(e => e.adjusted_qty !== null && e.adjusted_qty !== undefined);
  console.log(`[entradas/page] Entries criados: ${entries.length}, com ajuste: ${entriesComAjuste.length}`);
  
  // Debug: verificar itens do código 842
  const entries842 = entries.filter(e => e.cod_item === '000842' || e.cod_item === '842');
  console.log(`[entradas/page] Itens do código 842: ${entries842.length}`);
  for (const e of entries842) {
    console.log(`[entradas/page] Item 842:`, {
      documentItemId: e.documentItemId,
      qtd_nf: e.quantidade_nf,
      adjusted_qty: e.adjusted_qty,
      qtd_produto: e.qtd_produto,
      qty_usada_para_calculo: e.adjusted_qty ?? e.quantidade_nf,
    });
  }
  
  // ============================================================================
  // DEBUG ENTRADAS - TOTAL GERAL
  // ============================================================================
  console.log("===== DEBUG ENTRADAS - TOTAL GERAL =====");
  console.log("Qtde de linhas em Entradas:", entries.length);
  
  const totalQtdEntradas = entries.reduce((acc, e) => acc + (e.adjusted_qty ?? e.quantidade_nf ?? 0), 0);
  const totalValorEntradas = entries.reduce((acc, e) => acc + (e.custo_total ?? 0), 0);
  
  console.log("Entradas - Total quantidade:", totalQtdEntradas);
  console.log("Entradas - Total valor:", totalValorEntradas.toFixed(2));
  console.log("===== FIM DEBUG ENTRADAS - TOTAL GERAL =====");
  
  // ============================================================================
  // DEBUG ENTRADAS - MAPA POR COD_ITEM
  // ============================================================================
  type MapaEntradas = Record<string, { qty: number; valor: number }>;
  type ItensPorCodItem = Record<string, Array<{
    documentItemId: string;
    documentId: string;
    qtd_nf: number;
    qtd_ajustada: number | null;
    qty_usada: number;
    valor: number;
    nota: string;
  }>>;
  
  const mapaEntradas: MapaEntradas = {};
  const itensPorCodItem: ItensPorCodItem = {};
  
  for (const e of entries) {
    const cod = e.cod_item;
    const qty = e.adjusted_qty ?? e.quantidade_nf ?? 0;
    const valor = e.custo_total ?? 0;
    
    if (!mapaEntradas[cod]) {
      mapaEntradas[cod] = { qty: 0, valor: 0 };
      itensPorCodItem[cod] = [];
    }
    
    mapaEntradas[cod].qty += qty;
    mapaEntradas[cod].valor += valor;
    
    itensPorCodItem[cod].push({
      documentItemId: e.documentItemId,
      documentId: e.documentId,
      qtd_nf: e.quantidade_nf,
      qtd_ajustada: e.adjusted_qty,
      qty_usada: qty,
      valor: valor,
      nota: e.nota,
    });
  }
  
  console.log("===== DEBUG ENTRADAS - MAPA POR COD_ITEM =====");
  console.log("Total cod_items em Entradas:", Object.keys(mapaEntradas).length);
  
  // Log detalhado para itens problemáticos específicos
  const codItemsProblema = ['003482', '002795', '004616', '000018', '000842', '013968'];
  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🔍 DEBUG ENTRADAS - ITENS PROBLEMÁTICOS DETALHADOS 🔍");
  console.log("═══════════════════════════════════════════════════════════════");
  for (const codItem of codItemsProblema) {
    const data = mapaEntradas[codItem];
    const itens = itensPorCodItem[codItem] || [];
    if (data) {
      const somaQty = itens.reduce((acc, item) => acc + item.qty_usada, 0);
      const somaValor = itens.reduce((acc, item) => acc + item.valor, 0);
      console.log(`\n[${codItem}]`);
      console.log(`  Total em Entradas: qty=${data.qty}, valor=${data.valor.toFixed(2)}`);
      console.log(`  Itens encontrados: ${itens.length}`);
      console.log(`  Soma dos itens: qty=${somaQty}, valor=${somaValor.toFixed(2)}`);
      if (Math.abs(data.qty - somaQty) > 0.01 || Math.abs(data.valor - somaValor) > 0.01) {
        console.log(`  ⚠️ ATENÇÃO: Diferença entre total e soma!`);
      }
      if (itens.length > 0) {
        console.log(`  Detalhes dos itens em Entradas:`);
        itens.forEach((item, idx) => {
          console.log(`    [${idx + 1}] id=${item.documentItemId.substring(0, 8)}..., doc_id=${item.documentId.substring(0, 8)}..., qtd_nf=${item.qtd_nf}, qtd_ajustada=${item.qtd_ajustada !== null ? item.qtd_ajustada : 'null'}, qty_usada=${item.qty_usada}, valor=${item.valor.toFixed(2)}, nota=${item.nota}`);
        });
      }
    } else {
      console.log(`\n[${codItem}] ❌ NÃO encontrado em Entradas`);
    }
  }
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("🔍 FIM DEBUG ITENS PROBLEMÁTICOS ENTRADAS 🔍");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  // ============================================================================
  // DEBUG - COMPARAÇÃO DE VALORES PARA ITENS COM AJUSTE
  // ============================================================================
  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("🔍 DEBUG ENTRADAS - ITENS COM AJUSTE (VALORES) 🔍");
  console.log("═══════════════════════════════════════════════════════════════");
  
  const itensComAjuste = entries.filter(e => e.adjusted_qty !== null && e.adjusted_qty !== undefined);
  console.log(`Total de itens com ajuste em Entradas: ${itensComAjuste.length}`);
  
  // Mapa para armazenar valores por item (será usado na comparação)
  const valoresPorItemEntradas = new Map<string, {
    cod_item: string;
    documentItemId: string;
    qtd_original: number;
    adjustedQty: number;
    valorOriginal: number;
    valorEntradas: number; // custo_total usado na aba Entradas
  }>();
  
  let somaValoresEntradas = 0;
  
  for (const e of itensComAjuste) {
    const valorEntradas = e.custo_total; // Valor usado na aba Entradas (NÃO recalculado)
    valoresPorItemEntradas.set(e.documentItemId, {
      cod_item: e.cod_item,
      documentItemId: e.documentItemId,
      qtd_original: e.quantidade_nf,
      adjustedQty: e.adjusted_qty!,
      valorOriginal: e.custo_total, // vl_item original da NF
      valorEntradas: valorEntradas,
    });
    somaValoresEntradas += valorEntradas;
  }
  
  console.log(`Soma dos valores (custo_total) dos itens com ajuste em Entradas: ${somaValoresEntradas.toFixed(2)}`);
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("🔍 FIM DEBUG ENTRADAS - ITENS COM AJUSTE 🔍");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  // Estatísticas de conversões (para exibir na página)
  const statsConversoes = {
    total: entries.filter(e => e.fat_conv !== null).length,
    itensComConversao: new Set(entries.filter(e => e.fat_conv !== null).map(e => e.cod_item)).size,
    itensSemConversao: new Set(entries.map(e => e.cod_item)).size - new Set(entries.filter(e => e.fat_conv !== null).map(e => e.cod_item)).size,
  };

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
        <div className="flex gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
            <p>
              Entradas: <strong>{entries.length}</strong>
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <p>
              Conversões 0220: <strong>{statsConversoes.total}</strong> ({statsConversoes.itensComConversao} itens)
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            <p>
              Ajustes salvos: <strong>{entries.filter(e => e.adjusted_qty !== null && e.adjusted_qty !== undefined).length}</strong>
            </p>
          </div>
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

      <EntriesTable entries={entries} />
    </div>
  );
}

