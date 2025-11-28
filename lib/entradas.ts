import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { fetchProductDescriptions, normalizeCodItem } from "@/lib/utils";

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
  console.log("[fetchDocuments] Buscando documentos APENAS do SPED:", spedFileId);
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
          cod_mod,
          cod_sit,
          partner:partners (
            id,
            name,
            cnpj,
            cpf
          )
        `
      )
      .eq("sped_file_id", spedFileId) // CRÍTICO: Filtrar APENAS pelo SPED especificado
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
    const itemIds = items.map((item) => item.id).filter(Boolean);
    
    if (itemIds.length === 0) {
      return { items, adjustments, adjustmentsError: "Nenhum ID de item válido encontrado" };
    }
    
    const adjustmentChunkSize = 50;
    
    for (let i = 0; i < itemIds.length; i += adjustmentChunkSize) {
      const chunk = itemIds.slice(i, i + adjustmentChunkSize);
      try {
        const validChunk = chunk.filter(id => {
          const isValid = typeof id === 'string' && id.length > 0;
          return isValid;
        });
        
        if (validChunk.length === 0) {
          continue;
        }
        
        const { data, error } = await supabaseAdmin
          .from("document_item_adjustments")
          .select("document_item_id, adjusted_qty")
          .in("document_item_id", validChunk);
        
        if (error) {
          adjustmentsError = `Erro ao buscar alguns ajustes: ${error.message}`;
          continue;
        }

        const seenIds = new Set<string>();
        (data ?? []).forEach((adj) => {
          if (adj.document_item_id && !seenIds.has(adj.document_item_id)) {
            if (adj.adjusted_qty !== null && adj.adjusted_qty !== undefined) {
              const qty = Number(adj.adjusted_qty);
              adjustments.set(adj.document_item_id, qty);
              seenIds.add(adj.document_item_id);
            }
          }
        });
      } catch (error) {
        adjustmentsError =
          error instanceof Error
            ? `Não foi possível carregar todos os ajustes (parcialmente exibidos). Detalhes: ${error.message}`
            : "Não foi possível carregar todos os ajustes (parcialmente exibidos).";
        continue;
      }
    }
  }

  return { items, adjustments, adjustmentsError };
}

export interface EntradaItem {
  documentItemId: string;
  documentId: string;
  nota: string;
  fornecedor: string;
  fornecedorDoc: string | null;
  dataDocumento: string;
  cod_item: string;
  descr_item: string;
  unidade_nf: string | null;
  quantidade_nf: number;
  unidade_produto: string | null;
  fat_conv: number | null;
  qtd_produto: number;
  custo_unitario: number;
  custo_total: number;
  adjusted_qty: number | null;
  sped_file_id: string; // ID do SPED ao qual o item pertence
}

/**
 * Constrói o array de entries exatamente como a página Entradas faz.
 * Esta é a fonte da verdade para quais itens aparecem na aba Entradas.
 * 
 * IMPORTANTE: Quando houver período ativo com SPED base, usa SOMENTE o SPED base.
 * Não busca documentos de outros SPEDs do período para evitar duplicação.
 */
export async function buildEntradasItems(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  spedFileId: string,
  origem: "ENTRADAS" | "CONSOLIDACAO" = "ENTRADAS",
  activePeriodId?: string | null
): Promise<EntradaItem[]> {
  console.log("[DEBUG ENTRADAS] buildEntradasItems chamado", {
    spedFileId,
    origem,
    activePeriodId,
  });
  
  // 1. Buscar período ativo e verificar se há SPED base
  // Se activePeriodId foi passado, usar ele; senão, buscar período ativo
  let activePeriod: { id: string } | null = null;
  
  if (activePeriodId) {
    // Usar o período passado como parâmetro
    activePeriod = { id: activePeriodId };
    console.log("[DEBUG ENTRADAS] Usando período passado como parâmetro:", activePeriodId);
  } else {
    // Buscar período ativo do banco
    const { data: periodData } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("is_active", true)
      .single();
    activePeriod = periodData || null;
    console.log("[DEBUG ENTRADAS] Período ativo buscado do banco:", activePeriod?.id || "não encontrado");
  }
  
  let spedBaseId: string | null = null;
  if (activePeriod) {
    const { getBaseSpedFileForPeriod } = await import("@/lib/periods");
    spedBaseId = await getBaseSpedFileForPeriod(activePeriod.id);
    console.log("[DEBUG ENTRADAS] periodId:", activePeriod.id);
    console.log("[DEBUG ENTRADAS] spedBaseId:", spedBaseId);
    
    // Se há SPED base e o spedFileId passado não é o base, usar o base
    if (spedBaseId && spedFileId !== spedBaseId) {
      console.log("[DEBUG ENTRADAS] ⚠️ spedFileId passado não é o base, usando base:", spedBaseId);
      spedFileId = spedBaseId;
    }
  }
  
  // 2. Buscar documentos SOMENTE do SPED selecionado (que deve ser o base se houver período)
  // CRÍTICO: Verificar se o spedFileId realmente é o base antes de buscar documentos
  if (activePeriod && spedBaseId) {
    if (spedFileId !== spedBaseId) {
      console.error("[DEBUG ENTRADAS] ⚠️ ERRO CRÍTICO: spedFileId não é o base! Corrigindo:", {
        spedFileIdPassado: spedFileId,
        spedBaseIdCorreto: spedBaseId
      });
      spedFileId = spedBaseId;
    }
  }
  
  // VALIDAÇÃO FINAL: Garantir que estamos buscando apenas do SPED correto
  console.log("[DEBUG ENTRADAS] Buscando documentos do SPED:", spedFileId);
  console.log("[DEBUG ENTRADAS] activePeriod:", activePeriod?.id);
  console.log("[DEBUG ENTRADAS] spedBaseId:", spedBaseId);
  
  if (activePeriod && spedBaseId) {
    if (spedFileId !== spedBaseId) {
      console.error(`[DEBUG ENTRADAS] ⚠️ ERRO CRÍTICO: spedFileId (${spedFileId}) não é o base (${spedBaseId}). Corrigindo...`);
      spedFileId = spedBaseId;
    }
  } else if (activePeriod && !spedBaseId) {
    console.warn(`[DEBUG ENTRADAS] ⚠️ AVISO: Há período ativo mas não há SPED base definido. Usando spedFileId passado: ${spedFileId}`);
  }
  
  const documents = await fetchDocuments(supabaseAdmin, spedFileId);
  
  console.log("[DEBUG ENTRADAS] totalDocumentsEntrada encontrados:", documents.length);
  console.log("[DEBUG ENTRADAS] spedFileId usado na busca:", spedFileId);
  console.log("[DEBUG ENTRADAS] origem:", origem);
  
  // DEBUG: Verificar se há documentos que podem conter o item 002064
  // Buscar diretamente no banco por document_items com código 002064 do SPED
  const { data: items2064Banco, error: items2064Error } = await supabaseAdmin
    .from("document_items")
    .select(`
      id,
      cod_item,
      document_id,
      qtd,
      documents!inner(sped_file_id, ind_oper, serie, num_doc)
    `)
    .eq("documents.sped_file_id", spedFileId)
    .or("cod_item.eq.002064,cod_item.eq.2064")
    .limit(10);
  
  if (items2064Error) {
    console.error(`[DEBUG ENTRADAS] Erro ao buscar items 2064 do banco:`, items2064Error);
  } else {
    console.log(`[DEBUG ENTRADAS] Items 2064 encontrados DIRETAMENTE no banco para SPED ${spedFileId}:`, items2064Banco?.length || 0);
    if (items2064Banco && items2064Banco.length > 0) {
      items2064Banco.forEach((item: any, idx: number) => {
        const doc = item.documents;
        console.log(`[DEBUG ENTRADAS] Item 2064 do banco [${idx + 1}]:`, {
          id: item.id,
          cod_item: item.cod_item,
          document_id: item.document_id,
          qtd: item.qtd,
          documento: {
            sped_file_id: doc?.sped_file_id,
            ind_oper: doc?.ind_oper,
            serie: doc?.serie,
            num_doc: doc?.num_doc,
          },
        });
      });
    }
  }
  
  // VALIDAÇÃO CRÍTICA: Verificar se TODOS os documentos pertencem ao SPED correto
  // (fetchDocuments já filtra, mas vamos validar para garantir)
  let documentsFiltrados = documents;
  const documentosOutrosSpeds = documents.filter(doc => doc.sped_file_id !== spedFileId);
  if (documentosOutrosSpeds.length > 0) {
    console.error("[DEBUG ENTRADAS] ⚠️ ERRO CRÍTICO: Encontrados documentos de outros SPEDs:", documentosOutrosSpeds.length);
    console.error("[DEBUG ENTRADAS] SPEDs incorretos encontrados:", Array.from(new Set(documentosOutrosSpeds.map(d => d.sped_file_id))));
    console.error("[DEBUG ENTRADAS] IDs dos documentos incorretos:", documentosOutrosSpeds.map(d => d.id));
    // Filtrar apenas documentos do SPED correto
    documentsFiltrados = documents.filter(doc => doc.sped_file_id === spedFileId);
    console.error("[DEBUG ENTRADAS] Filtrando documentos incorretos. Mantendo apenas:", documentsFiltrados.length);
  } else {
    console.log("[DEBUG ENTRADAS] ✅ Todos os documentos pertencem ao SPED correto");
  }
  
  // VALIDAÇÃO: Verificar se não há documentos duplicados
  const documentIdsUnicos = new Set(documentsFiltrados.map(d => d.id));
  if (documentIdsUnicos.size !== documentsFiltrados.length) {
    console.error("[DEBUG ENTRADAS] ⚠️ ERRO: Documentos duplicados encontrados!");
    console.error("[DEBUG ENTRADAS] Total documentos:", documentsFiltrados.length, "IDs únicos:", documentIdsUnicos.size);
  }
  
  // Usar apenas os documentos filtrados
  const documentIds = documentsFiltrados.map((doc) => doc.id).filter(Boolean);
  console.log("[DEBUG ENTRADAS] Total de documentIds únicos para buscar itens:", documentIds.length);
  
  // Constantes para debug
  const PROBLEMATIC_DOC_ID = '01839c8c-f655-4481-9863-c2688b4e95ba';
  const PROBLEMATIC_ITEM_ID = '3420da84-15ff-46da-84fb-be88a8c1b675';

  // 3. Buscar itens e ajustes (mesma lógica da página Entradas)
  const {
    items: documentItems,
    adjustments,
  } = await fetchDocumentItems(supabaseAdmin, documentIds);
  
  console.log("[DEBUG ENTRADAS] totalDocumentItemsEntrada:", documentItems.length);
  
  // VALIDAÇÃO CRÍTICA: Verificar se todos os documentItems pertencem a documentos do SPED correto
  // Buscar os document_ids dos itens e verificar se todos pertencem ao SPED base
  if (documentItems.length > 0) {
    const documentIdsDosItens = Array.from(new Set(documentItems.map(item => item.document_id).filter(Boolean)));
    if (documentIdsDosItens.length > 0) {
      const { data: documentosDosItens } = await supabaseAdmin
        .from("documents")
        .select("id, sped_file_id")
        .in("id", documentIdsDosItens);
      
      const documentosOutrosSpeds = documentosDosItens?.filter(doc => doc.sped_file_id !== spedFileId) || [];
      if (documentosOutrosSpeds.length > 0) {
        console.error("[DEBUG ENTRADAS] ⚠️ ERRO CRÍTICO: Encontrados document_items de documentos de outros SPEDs:", documentosOutrosSpeds.length);
        console.error("[DEBUG ENTRADAS] SPEDs incorretos encontrados:", Array.from(new Set(documentosOutrosSpeds.map(d => d.sped_file_id))));
      }
    }
  }
  
  // 4. BLINDAGEM OPCIONAL — garantir ajustes SOMENTE do SPED atual
  // Este bloco garante que todos os ajustes dos document_items do SPED sejam carregados,
  // mesmo que algum tenha sido perdido na busca inicial
  try {
    const { data: itensDoSped, error: itensErr } = await supabaseAdmin
      .from("document_items")
      .select("id")
      .in("document_id", documentIds);

    if (!itensErr && itensDoSped?.length) {
      const idsItensSped = itensDoSped.map(i => i.id).filter(Boolean);

      const { data: ajustesSped, error: ajustesErr } = await supabaseAdmin
        .from("document_item_adjustments")
        .select("document_item_id, adjusted_qty")
        .in("document_item_id", idsItensSped);

      if (!ajustesErr && ajustesSped) {
        for (const adj of ajustesSped) {
          if (adj.document_item_id && adj.adjusted_qty !== null && adj.adjusted_qty !== undefined) {
            adjustments.set(adj.document_item_id, Number(adj.adjusted_qty));
          }
        }
      }
    }
  } catch (err) {
    console.warn("[buildEntradasItems] blindagem opcional falhou:", err);
  }
  
  // 4.5. BUSCA CRÍTICA: Buscar itens com ajustes que podem não estar nos documentos encontrados
  // Isso garante que itens ajustados sejam incluídos mesmo que seus documentos não apareçam na busca inicial
  // (pode acontecer se o documento está em outro SPED do período ou se há algum problema de filtro)
  console.log(`[buildEntradasItems ${origem}] Iniciando busca crítica de ajustes para SPED: ${spedFileId}`);
  try {
    // Buscar TODOS os ajustes que pertencem a document_items cujos documentos estão no SPED
    // IMPORTANTE: Usar uma query mais simples que funcione melhor com o Supabase
    const { data: todosAjustes, error: todosAjustesErr } = await supabaseAdmin
      .from("document_item_adjustments")
      .select("document_item_id, adjusted_qty")
      .limit(10000); // Limite alto para pegar todos
    
    if (todosAjustesErr) {
      console.error(`[buildEntradasItems ${origem}] Erro ao buscar todos os ajustes:`, todosAjustesErr);
    } else {
      console.log(`[buildEntradasItems ${origem}] Total de ajustes encontrados no banco: ${todosAjustes?.length || 0}`);
      
      // Agora buscar os document_items correspondentes e filtrar pelo SPED
      if (todosAjustes && todosAjustes.length > 0) {
        const itemIdsComAjuste = todosAjustes.map(a => a.document_item_id).filter(Boolean);
        console.log(`[buildEntradasItems ${origem}] Buscando document_items para ${itemIdsComAjuste.length} ajustes`);
        
        // Buscar em chunks
        const chunkSize = 500;
        const ajustesComItens: any[] = [];
        
        for (let i = 0; i < itemIdsComAjuste.length; i += chunkSize) {
          const chunk = itemIdsComAjuste.slice(i, i + chunkSize);
          const { data: itens, error: itensErr } = await supabaseAdmin
            .from("document_items")
            .select(`
              id,
              cod_item,
              document_id,
              documents!inner(
                id,
                sped_file_id,
                ind_oper
              )
            `)
            .in("id", chunk)
            .eq("documents.sped_file_id", spedFileId)
            .eq("documents.ind_oper", "0");
          
          if (itensErr) {
            console.error(`[buildEntradasItems ${origem}] Erro ao buscar itens do chunk:`, itensErr);
            continue;
          }
          
          if (itens && itens.length > 0) {
            // Combinar ajustes com itens
            for (const item of itens) {
              const ajuste = todosAjustes.find(a => a.document_item_id === item.id);
              if (ajuste) {
                ajustesComItens.push({
                  document_item_id: item.id,
                  adjusted_qty: ajuste.adjusted_qty,
                  document_items: item,
                });
              }
            }
          }
        }
        
        console.log(`[buildEntradasItems ${origem}] Ajustes encontrados via busca direta (filtrados por SPED): ${ajustesComItens.length}`);
        
        // Adicionar os ajustes encontrados ao Map
        for (const adj of ajustesComItens) {
          if (adj.document_item_id && adj.adjusted_qty !== null && adj.adjusted_qty !== undefined) {
            const itemId = adj.document_item_id;
            const codItem = (adj.document_items as any)?.cod_item;
            
            // DEBUG específico para 002064
            if (codItem === "002064" || codItem === "2064" || String(codItem).includes("2064")) {
              console.log(`[buildEntradasItems ${origem}] ✅ Ajuste 002064 encontrado via busca direta:`, {
                document_item_id: itemId,
                cod_item: codItem,
                adjusted_qty: adj.adjusted_qty,
                document_id: (adj.document_items as any)?.document_id,
                sped_file_id: ((adj.document_items as any)?.documents as any)?.sped_file_id,
              });
            }
            
            adjustments.set(itemId, Number(adj.adjusted_qty));
            
            // Se o item não está em documentItems, adicionar ele
            const itemJaExiste = documentItems.find(i => i.id === itemId);
            if (!itemJaExiste && adj.document_items) {
              const itemData = adj.document_items as any;
              console.log(`[buildEntradasItems ${origem}] ⚠️ Item com ajuste não encontrado em documentItems, adicionando:`, {
                id: itemId,
                cod_item: itemData.cod_item,
                document_id: itemData.document_id,
              });
              documentItems.push({
                id: itemId,
                cod_item: itemData.cod_item,
                document_id: itemData.document_id,
                qtd: 0, // Será substituído pelo adjusted_qty
                vl_item: 0,
                unid: null,
                descr_compl: null,
              });
            }
          }
        }
      } else {
        console.log(`[buildEntradasItems ${origem}] Nenhum ajuste encontrado no banco`);
      }
    }
  } catch (err) {
    console.error("[buildEntradasItems] busca crítica de ajustes falhou:", err);
  }
  
  // DEBUG: Verificar ajustes encontrados
  console.log(`[buildEntradasItems ${origem}] Total de ajustes encontrados: ${adjustments.size}`);
  const itemIds842Debug = documentItems
    .filter((item) => item.cod_item === "000842" || item.cod_item === "842")
    .map((item) => item.id);
  console.log(`[buildEntradasItems ${origem}] IDs de document_items para 842:`, itemIds842Debug);
  for (const itemId of itemIds842Debug) {
    const ajuste = adjustments.get(itemId);
    console.log(`[buildEntradasItems ${origem}] Item ID ${itemId}: ajuste=${ajuste !== undefined ? ajuste : 'NÃO ENCONTRADO'}`);
  }
  
  // DEBUG: Buscar ajustes diretamente do banco para os itens 842
  if (itemIds842Debug.length > 0) {
    const { data: ajustes842Banco, error: ajustesError } = await supabaseAdmin
      .from("document_item_adjustments")
      .select("document_item_id, adjusted_qty")
      .in("document_item_id", itemIds842Debug);
    
    console.log(`[buildEntradasItems ${origem}] Ajustes encontrados DIRETAMENTE no banco para 842:`, ajustes842Banco);
    if (ajustesError) {
      console.error(`[buildEntradasItems ${origem}] Erro ao buscar ajustes do banco:`, ajustesError);
    }
    
    // Verificar se há ajustes para outros IDs que não estão na lista
    const { data: todosAjustes842, error: todosAjustesError } = await supabaseAdmin
      .from("document_item_adjustments")
      .select("document_item_id, adjusted_qty")
      .limit(100); // Limitar para não sobrecarregar
    
    if (!todosAjustesError && todosAjustes842) {
      // Buscar os document_items correspondentes para ver se algum é 842
      const idsComAjuste = todosAjustes842.map(a => a.document_item_id).filter(Boolean);
      if (idsComAjuste.length > 0) {
        const { data: itensComAjuste, error: itensError } = await supabaseAdmin
          .from("document_items")
          .select("id, cod_item")
          .in("id", idsComAjuste.slice(0, 50)); // Limitar para não sobrecarregar
        
        if (!itensError && itensComAjuste) {
          const itens842ComAjuste = itensComAjuste.filter(i => i.cod_item === "000842" || i.cod_item === "842");
          if (itens842ComAjuste.length > 0) {
            console.log(`[buildEntradasItems ${origem}] ⚠️ ENCONTRADOS itens 842 com ajuste que NÃO estão na lista atual:`, itens842ComAjuste);
            for (const item of itens842ComAjuste) {
              const ajuste = todosAjustes842.find(a => a.document_item_id === item.id);
              console.log(`[buildEntradasItems ${origem}] Item ID ${item.id}: ajuste=${ajuste?.adjusted_qty ?? 'N/A'}`);
            }
          }
        }
      }
    }
  }

  // 5. Buscar produtos e conversões
  // IMPORTANTE: Quando há SPED base, usar SOMENTE o SPED base para conversões.
  // Não buscar conversões de outros SPEDs do período para evitar confusão.
  // Se não houver SPED base, usar o SPED selecionado.
  const spedIdsParaConversao = [spedFileId];
  
  if (spedBaseId && spedBaseId !== spedFileId) {
    console.log(`[buildEntradasItems] ⚠️ Aviso: spedBaseId diferente do spedFileId passado. Usando base.`);
  }
  
  console.log(`[buildEntradasItems] Buscando conversões do SPED: ${spedFileId} (base: ${spedBaseId || 'não há'})`);

  // Buscar produtos do SPED selecionado (que deve ser o base se houver período)
  const products = await fetchAllRows(async (from, to) => {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("cod_item, descr_item, unid_inv")
      .eq("sped_file_id", spedFileId)
      .order("cod_item")
      .range(from, to);
    if (error) {
      throw new Error(`Erro ao buscar produtos: ${error.message}`);
    }
    return data ?? [];
  });

  // Buscar conversões SOMENTE do SPED selecionado (que deve ser o base se houver período)
  const conversions: any[] = [];
  for (const spedId of spedIdsParaConversao) {
    const conversoesDoSped = await fetchAllRows(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from("product_conversions")
        .select("cod_item, unid_conv, fat_conv")
        .eq("sped_file_id", spedId)
        .order("cod_item")
        .range(from, to);
      if (error) {
        console.warn(`Erro ao buscar conversões do SPED ${spedId}: ${error.message}`);
        return [];
      }
      return data ?? [];
    });
    conversions.push(...conversoesDoSped);
  }
  
  console.log(`[buildEntradasItems] Total de conversões encontradas: ${conversions.length} (do SPED ${spedFileId})`);

  // Criar mapa de produtos do SPED (PRIORIDADE 1)
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

  // Buscar descrições faltantes no cadastro de produtos (PRIORIDADE 2)
  const allCodItems = Array.from(new Set(documentItems.map(item => item.cod_item)));
  const codItemsSemDescricao = allCodItems.filter(cod => {
    const productInfo = productMap.get(cod);
    return !productInfo?.descr_item || productInfo.descr_item.trim() === "";
  });
  
  let catalogDescriptions = new Map<string, string>();
  if (codItemsSemDescricao.length > 0) {
    catalogDescriptions = await fetchProductDescriptions(supabaseAdmin, codItemsSemDescricao);
  }

  const conversionMapByItem = new Map<string, Array<{ unid_conv: string; fat_conv: number }>>();
  (conversions ?? []).forEach((conv) => {
    if (conv.cod_item && conv.unid_conv) {
      // Normalizar cod_item para garantir match (6 dígitos com zeros à esquerda)
      const codItemNormalizado = normalizeCodItem(conv.cod_item);
      if (!conversionMapByItem.has(codItemNormalizado)) {
        conversionMapByItem.set(codItemNormalizado, []);
      }
      conversionMapByItem.get(codItemNormalizado)!.push({
        unid_conv: conv.unid_conv.trim(),
        fat_conv: conv.fat_conv ?? 1,
      });
    }
  });
  
  console.log(`[buildEntradasItems] Mapa de conversões criado com ${conversionMapByItem.size} cod_items únicos`);
  if (conversionMapByItem.size > 0 && origem === "ENTRADAS") {
    const primeirosCodItems = Array.from(conversionMapByItem.keys()).slice(0, 5);
    console.log(`[buildEntradasItems] Primeiros cod_items com conversão:`, primeirosCodItems);
  }

  // 6. Criar documentMap (mesma lógica da página Entradas)
  const documentMap = new Map<string, any>();
  documentsFiltrados.forEach((doc) => {
    documentMap.set(doc.id, doc);
  });
  
  // ============================================================================
  // LOGS ESPECÍFICOS PARA CÓDIGO 004616
  // ============================================================================
  console.error(`[buildEntradasItems] Total de documentos encontrados: ${documents.length}`);
  const docProblema = documents.find(d => d.id === PROBLEMATIC_DOC_ID);
  if (docProblema) {
    console.error(`⚠️⚠️⚠️ PROBLEMA: Documento problemático ${PROBLEMATIC_DOC_ID} encontrado em documents!`);
    console.error(`  - sped_file_id: ${docProblema.sped_file_id}`);
    console.error(`  - ind_oper: ${docProblema.ind_oper}`);
    console.error(`  - serie: ${docProblema.serie}, num_doc: ${docProblema.num_doc}`);
    console.error(`  - ⚠️ Este documento não deveria estar no SPED selecionado ou não tem ind_oper='0'!`);
  }
  
  // Verificar se o documento problemático está na lista de documentIds
  if (documentIds.includes(PROBLEMATIC_DOC_ID)) {
    console.error(`⚠️⚠️⚠️ PROBLEMA: Documento problemático ${PROBLEMATIC_DOC_ID} está na lista de documentIds!`);
  }
  
  // LOG: Verificar itens do código 004616 ANTES do filtro
  const items4616Before = documentItems.filter(i => i.cod_item === '004616' || i.cod_item === '4616');
  console.error(`[buildEntradasItems] Total de document_items para código 004616 (ANTES do filtro): ${items4616Before.length}`);
  items4616Before.forEach((item, idx) => {
    console.error(`  [${idx + 1}] id=${item.id}, document_id=${item.document_id}, cod_item=${item.cod_item}, qtd=${item.qtd}`);
  });
  
  // Verificar especificamente o item problemático
  const itemProblematico = documentItems.find(i => i.id === PROBLEMATIC_ITEM_ID);
  if (itemProblematico) {
    console.error(`⚠️⚠️⚠️ PROBLEMA: Item problemático ${PROBLEMATIC_ITEM_ID} encontrado em documentItems!`);
    console.error(`  - cod_item: ${itemProblematico.cod_item}`);
    console.error(`  - document_id: ${itemProblematico.document_id}`);
    console.error(`  - qtd: ${itemProblematico.qtd}`);
  }

  // ============================================================================
  // LOGS DE COMPARAÇÃO: Itens problemáticos vs corretos
  // ============================================================================
  const ITENS_PROBLEMATICOS_IDS = new Set([
    '7aa278a5-d8d6-4f35-b63e-6c01d9bc731f', // 000842
    '706dc975-bc59-4ab1-9082-4c0f0a806b9a', // 013968
  ]);
  
  const ITENS_CORRETOS_IDS = new Set([
    'e3900d15-3715-40a1-a4a8-a36dcf8ce080', // 000842
    'f0e49511-87cb-4991-95f1-29ad819b5eac', // 013968
    'faf49e7d-5687-4218-b2fe-92d8d1d3a28c', // 000842 com ajuste
    '681653c7-85df-458c-8710-d3f1e19bddb8', // 013968 com ajuste
  ]);
  
  // Coletar propriedades dos itens problemáticos e corretos
  const itensProblematicos: any[] = [];
  const itensCorretos: any[] = [];
  
  documentItems.forEach((item) => {
    const document = documentMap.get(item.document_id);
    if (!document) return;
    
    const itemData = {
      item_id: item.id,
      cod_item: item.cod_item,
      document_id: item.document_id,
      document: {
        id: document.id,
        serie: document.serie,
        num_doc: document.num_doc,
        cod_mod: document.cod_mod,
        cod_sit: document.cod_sit,
        dt_doc: document.dt_doc,
        vl_doc: document.vl_doc,
      },
      item: {
        cfop: item.cfop,
        qtd: item.qtd,
        vl_item: item.vl_item,
      },
    };
    
    if (ITENS_PROBLEMATICOS_IDS.has(item.id)) {
      itensProblematicos.push(itemData);
    } else if (ITENS_CORRETOS_IDS.has(item.id)) {
      itensCorretos.push(itemData);
    }
  });
  
  // Logar comparação - FORÇAR EXECUÇÃO (sempre logar, mesmo se arrays vazios)
  console.error(`\n\n🔍🔍🔍 COMPARAÇÃO: ITENS PROBLEMÁTICOS vs CORRETOS 🔍🔍🔍`);
  console.error(`Total de itens problemáticos encontrados: ${itensProblematicos.length}`);
  console.error(`Total de itens corretos encontrados: ${itensCorretos.length}`);
  console.error(`Total de documentItems processados: ${documentItems.length}`);
  
  if (itensProblematicos.length > 0) {
    console.error(`\n❌ ITENS PROBLEMÁTICOS (${itensProblematicos.length}):`);
    itensProblematicos.forEach((item, idx) => {
      console.error(`  [${idx + 1}] item_id=${item.item_id}, cod_item=${item.cod_item}`);
      console.error(`      document: id=${item.document.id}, serie=${item.document.serie || 'NULL'}, num_doc=${item.document.num_doc || 'NULL'}, cod_mod=${item.document.cod_mod || 'NULL'}, cod_sit=${item.document.cod_sit || 'NULL'}, dt_doc=${item.document.dt_doc || 'NULL'}`);
      console.error(`      item: cfop=${item.item.cfop || 'NULL'}, qtd=${item.item.qtd}, vl_item=${item.item.vl_item}`);
    });
  } else {
    console.error(`\n⚠️ NENHUM ITEM PROBLEMÁTICO ENCONTRADO (pode não estar no SPED selecionado)`);
  }
  
  if (itensCorretos.length > 0) {
    console.error(`\n✅ ITENS CORRETOS (${itensCorretos.length}):`);
    itensCorretos.forEach((item, idx) => {
      console.error(`  [${idx + 1}] item_id=${item.item_id}, cod_item=${item.cod_item}`);
      console.error(`      document: id=${item.document.id}, serie=${item.document.serie || 'NULL'}, num_doc=${item.document.num_doc || 'NULL'}, cod_mod=${item.document.cod_mod || 'NULL'}, cod_sit=${item.document.cod_sit || 'NULL'}, dt_doc=${item.document.dt_doc || 'NULL'}`);
      console.error(`      item: cfop=${item.item.cfop || 'NULL'}, qtd=${item.item.qtd}, vl_item=${item.item.vl_item}`);
    });
  } else {
    console.error(`\n⚠️ NENHUM ITEM CORRETO ENCONTRADO (pode não estar no SPED selecionado)`);
  }
  
  // Identificar documentos problemáticos
  const docIdsProblematicos = new Set(itensProblematicos.map(i => i.document_id));
  const docIdsCorretos = new Set(itensCorretos.map(i => i.document_id));
  
  console.error(`\n📄 DOCUMENTOS PROBLEMÁTICOS: [${Array.from(docIdsProblematicos).join(', ')}]`);
  console.error(`📄 DOCUMENTOS CORRETOS: [${Array.from(docIdsCorretos).join(', ')}]`);
  
  // Buscar propriedades completas dos documentos problemáticos
  if (docIdsProblematicos.size > 0) {
    console.error(`\n🔍 Buscando propriedades completas dos documentos problemáticos...`);
    const { data: docsProblematicos, error: docsError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .in("id", Array.from(docIdsProblematicos));
    
    if (!docsError && docsProblematicos) {
      console.error(`Documentos problemáticos encontrados: ${docsProblematicos.length}`);
      docsProblematicos.forEach((doc, idx) => {
        console.error(`  [${idx + 1}] id=${doc.id}, cod_mod=${doc.cod_mod || 'NULL'}, cod_sit=${doc.cod_sit || 'NULL'}, serie=${doc.serie || 'NULL'}, num_doc=${doc.num_doc || 'NULL'}`);
        console.error(`      TUDO: ${JSON.stringify(doc)}`);
      });
    }
  }
  
  console.error(`🔍 ========================================\n\n`);
  
  // ============================================================================
  // IDENTIFICAR REGRA DE FILTRO: Comparar documentos problemáticos vs corretos
  // ============================================================================
  // Documentos problemáticos conhecidos (baseado nos logs anteriores)
  const DOC_PROBLEMATICO_ID = '81fee547-9392-4e5a-8e7f-0b8af5ad5f1b';
  const DOC_CORRETO_ID = '307385fa-e64a-4b93-880c-3eac8c418f82';
  
  // Buscar propriedades completas dos documentos para comparação
  const { data: docsComparacao, error: docsCompError } = await supabaseAdmin
    .from("documents")
    .select("*")
    .in("id", [DOC_PROBLEMATICO_ID, DOC_CORRETO_ID]);
  
  if (!docsCompError && docsComparacao && docsComparacao.length > 0) {
    console.error(`\n\n🔍🔍🔍 COMPARAÇÃO DE DOCUMENTOS 🔍🔍🔍`);
    const docProblematico = docsComparacao.find(d => d.id === DOC_PROBLEMATICO_ID);
    const docCorreto = docsComparacao.find(d => d.id === DOC_CORRETO_ID);
    
    if (docProblematico) {
      console.error(`\n❌ DOCUMENTO PROBLEMÁTICO (${DOC_PROBLEMATICO_ID}):`);
      console.error(`  cod_mod: ${docProblematico.cod_mod || 'NULL'}`);
      console.error(`  cod_sit: ${docProblematico.cod_sit || 'NULL'}`);
      console.error(`  serie: ${docProblematico.serie || 'NULL'}`);
      console.error(`  num_doc: ${docProblematico.num_doc || 'NULL'}`);
      console.error(`  ind_oper: ${docProblematico.ind_oper || 'NULL'}`);
      console.error(`  dt_doc: ${docProblematico.dt_doc || 'NULL'}`);
      console.error(`  vl_doc: ${docProblematico.vl_doc || 'NULL'}`);
      console.error(`  TUDO: ${JSON.stringify(docProblematico, null, 2)}`);
    }
    
    if (docCorreto) {
      console.error(`\n✅ DOCUMENTO CORRETO (${DOC_CORRETO_ID}):`);
      console.error(`  cod_mod: ${docCorreto.cod_mod || 'NULL'}`);
      console.error(`  cod_sit: ${docCorreto.cod_sit || 'NULL'}`);
      console.error(`  serie: ${docCorreto.serie || 'NULL'}`);
      console.error(`  num_doc: ${docCorreto.num_doc || 'NULL'}`);
      console.error(`  ind_oper: ${docCorreto.ind_oper || 'NULL'}`);
      console.error(`  dt_doc: ${docCorreto.dt_doc || 'NULL'}`);
      console.error(`  vl_doc: ${docCorreto.vl_doc || 'NULL'}`);
      console.error(`  TUDO: ${JSON.stringify(docCorreto, null, 2)}`);
    }
    
    // Identificar diferenças
    if (docProblematico && docCorreto) {
      console.error(`\n🔍 DIFERENÇAS IDENTIFICADAS:`);
      const campos = ['cod_mod', 'cod_sit', 'serie', 'num_doc', 'ind_oper', 'dt_doc', 'vl_doc'];
      campos.forEach(campo => {
        const valProblema = docProblematico[campo];
        const valCorreto = docCorreto[campo];
        if (valProblema !== valCorreto) {
          console.error(`  ${campo}: PROBLEMÁTICO="${valProblema || 'NULL'}" vs CORRETO="${valCorreto || 'NULL'}"`);
        }
      });
    }
    console.error(`🔍 ========================================\n\n`);
  }
  
  // 7. Construir entries (MESMA LÓGICA da página Entradas)
  // LOG ESPECÍFICO: Verificar item 3420da84-15ff-46da-84fb-be88a8c1b675
  const ITEM_DEBUG_ID = '3420da84-15ff-46da-84fb-be88a8c1b675';
  const itemDebug = documentItems.find(i => i.id === ITEM_DEBUG_ID);
  if (itemDebug) {
    console.error(`[buildEntradasItems] Item ${ITEM_DEBUG_ID} encontrado:`);
    console.error(`  - cod_item: ${itemDebug.cod_item}`);
    console.error(`  - document_id: ${itemDebug.document_id}`);
    const docDebug = documentMap.get(itemDebug.document_id);
    if (docDebug) {
      console.error(`  - Documento encontrado no documentMap: ${docDebug.id}`);
      console.error(`  - sped_file_id: ${docDebug.sped_file_id}`);
      console.error(`  - ind_oper: ${docDebug.ind_oper}`);
      console.error(`  - serie: ${docDebug.serie}, num_doc: ${docDebug.num_doc}`);
    } else {
      console.error(`  - ⚠️ Documento NÃO encontrado no documentMap!`);
      console.error(`  - Isso significa que o documento não está no SPED selecionado ou não tem ind_oper='0'`);
    }
  } else {
    console.error(`[buildEntradasItems] Item ${ITEM_DEBUG_ID} NÃO encontrado em documentItems`);
  }
  
  // LOG: Verificar itens do código 004616 DEPOIS de criar documentMap
  const items4616After = documentItems.filter(i => (i.cod_item === '004616' || i.cod_item === '4616'));
  console.error(`[buildEntradasItems] Total de document_items para código 004616 (DEPOIS do documentMap): ${items4616After.length}`);
  items4616After.forEach((item, idx) => {
    const doc = documentMap.get(item.document_id);
    console.error(`  [${idx + 1}] id=${item.id}, document_id=${item.document_id}, cod_item=${item.cod_item}, qtd=${item.qtd}`);
    if (doc) {
      console.error(`      → Documento encontrado: sped_file_id=${doc.sped_file_id}, ind_oper=${doc.ind_oper}, serie=${doc.serie}, num_doc=${doc.num_doc}`);
    } else {
      console.error(`      → ⚠️ Documento NÃO encontrado no documentMap (será FILTRADO)`);
    }
  });
  
  const entries = documentItems
    .map((item) => {
      const document = documentMap.get(item.document_id);
      if (!document) {
        // Log específico para item 3420da84
        if (item.id === ITEM_DEBUG_ID) {
          console.error(`[buildEntradasItems] Item ${ITEM_DEBUG_ID} FILTRADO: documento não encontrado no documentMap`);
        }
        // Log específico para código 004616
        if (item.cod_item === '004616' || item.cod_item === '4616') {
          console.error(`[buildEntradasItems] Item 004616 FILTRADO: id=${item.id}, document_id=${item.document_id} não encontrado no documentMap`);
        }
        // Log específico para código 002064
        if (item.cod_item === '002064' || item.cod_item === '2064' || String(item.cod_item).includes('2064')) {
          console.error(`[buildEntradasItems] Item 002064 FILTRADO: id=${item.id}, cod_item=${item.cod_item}, document_id=${item.document_id} não encontrado no documentMap`);
        }
        return null; // ÚNICO filtro aplicado na página Entradas
      }

      const fornecedor =
        document.partner?.name ||
        document.cod_part ||
        "Fornecedor não identificado";
      const fornecedorDoc =
        document.partner?.cnpj ||
        document.partner?.cpf ||
        document.cod_part ||
        null;

      // Buscar conversão: verificar se a unidade da NF corresponde a alguma conversão do cod_item
      const unidNF = (item.unid || "").trim();
      // Normalizar cod_item para garantir match
      const codItemNormalizado = normalizeCodItem(item.cod_item);
      const conversoesDoItem = conversionMapByItem.get(codItemNormalizado) || [];
      
      let unidadeProduto: { unid_conv: string; fat_conv: number } | undefined;
      if (unidNF && conversoesDoItem.length > 0) {
        // Tentar match exato (case-insensitive)
        unidadeProduto = conversoesDoItem.find(
          (conv) => conv.unid_conv.trim().toUpperCase() === unidNF.toUpperCase()
        );
        
        // Se não encontrou, tentar match sem espaços
        if (!unidadeProduto) {
          unidadeProduto = conversoesDoItem.find(
            (conv) => conv.unid_conv.trim().replace(/\s+/g, "").toUpperCase() === unidNF.replace(/\s+/g, "").toUpperCase()
          );
        }
        
        // Se ainda não encontrou e há apenas uma conversão, usar ela (fallback)
        if (!unidadeProduto && conversoesDoItem.length === 1) {
          unidadeProduto = conversoesDoItem[0];
          console.log(`[buildEntradasItems] Usando conversão única como fallback para ${item.cod_item}: ${unidadeProduto.unid_conv} (unidNF: ${unidNF})`);
        }
        
        // DEBUG: Log quando não encontra conversão mas há conversões disponíveis
        if (!unidadeProduto && conversoesDoItem.length > 0 && origem === "ENTRADAS") {
          console.log(`[buildEntradasItems] ⚠️ Conversão não encontrada para ${item.cod_item}:`, {
            unidNF,
            conversoesDisponiveis: conversoesDoItem.map(c => c.unid_conv),
          });
        }
      }
      
      const quantidadeNF = item.qtd ?? 0;
      const custoTotal = item.vl_item ?? 0;
      const custoUnitario =
        quantidadeNF !== 0 ? custoTotal / quantidadeNF : custoTotal;
      const adjustedQty = adjustments.get(item.id) ?? null;
      
      // Quantidade a ser usada para cálculos (ajustada se existir, senão original)
      const qtyUsada = adjustedQty !== null && adjustedQty !== undefined 
        ? adjustedQty 
        : quantidadeNF;
      
      // DEBUG específico para código 002064
      if ((item.cod_item === "002064" || item.cod_item === "2064" || String(item.cod_item).includes("2064"))) {
        console.log(`[buildEntradasItems ${origem}] Item 002064 encontrado:`, {
          itemId: item.id,
          cod_item: item.cod_item,
          cod_item_normalizado: codItemNormalizado,
          document_id: item.document_id,
          qtd_nf: quantidadeNF,
          adjustedQty,
          qtyUsada,
          qtd_produto: unidadeProduto && unidadeProduto.fat_conv ? qtyUsada * unidadeProduto.fat_conv : qtyUsada,
          ajusteNoMap: adjustments.get(item.id),
          totalAjustesNoMap: adjustments.size,
          custo_total: custoTotal,
        });
      }
      
      // DEBUG específico para código 842
      if ((item.cod_item === "000842" || item.cod_item === "842") && origem === "ENTRADAS") {
        console.log(`[buildEntradasItems ${origem}] Item 842 encontrado:`, {
          itemId: item.id,
          cod_item: item.cod_item,
          qtd_nf: quantidadeNF,
          adjustedQty,
          qtyUsada,
          ajusteNoMap: adjustments.get(item.id),
          totalAjustesNoMap: adjustments.size,
        });
      }

      // CRÍTICO: Normalizar o código do item para garantir consistência em todo o sistema
      // O código normalizado será usado na agregação e consolidação
      const codItemFinal = codItemNormalizado;
      
      const productInfo = productMap.get(codItemFinal) || productMap.get(item.cod_item);
      return {
        documentItemId: item.id, // SEMPRE o ID do document_item da NF original
        documentId: item.document_id,
        nota: `${document.serie || ""} ${document.num_doc || ""}`.trim(),
        fornecedor,
        fornecedorDoc,
        dataDocumento: document.dt_doc,
        cod_item: codItemFinal, // SEMPRE usar código normalizado
        descr_item:
          productInfo?.descr_item ||
          catalogDescriptions.get(codItemFinal) ||
          catalogDescriptions.get(item.cod_item) ||
          item.descr_compl ||
          "[Sem descrição]",
        unidade_nf: item.unid || null,
        quantidade_nf: quantidadeNF,
        unidade_produto: unidadeProduto?.unid_conv || null,
        fat_conv: unidadeProduto?.fat_conv || null,
        qtd_produto:
          unidadeProduto && unidadeProduto.fat_conv
            ? qtyUsada * unidadeProduto.fat_conv
            : qtyUsada,
        custo_unitario: custoUnitario,
        custo_total: custoTotal,
        adjusted_qty: adjustedQty,
        sped_file_id: document.sped_file_id, // ID do SPED ao qual o documento pertence
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  // DEBUG: Verificar se há itens 002064 nos documentItems
  const items2064 = documentItems.filter((item) => 
    item.cod_item === "002064" || item.cod_item === "2064" || String(item.cod_item).includes("2064")
  );
  console.log(`[buildEntradasItems ${origem}] Total de document_items com código 002064: ${items2064.length}`);
  if (items2064.length > 0) {
    items2064.forEach((item, idx) => {
      const doc = documentMap.get(item.document_id);
      console.log(`[buildEntradasItems ${origem}] Item 002064 [${idx + 1}]:`, {
        id: item.id,
        cod_item: item.cod_item,
        document_id: item.document_id,
        documento_encontrado: doc ? "SIM" : "NÃO",
        qtd: item.qtd,
      });
    });
  }
  
  // Verificar se há entries 002064 após o filtro
  const entries2064 = entries.filter((e) => 
    e.cod_item === "002064" || e.cod_item === "2064" || String(e.cod_item).includes("2064")
  );
  console.log(`[buildEntradasItems ${origem}] Total de entries com código 002064 após filtro: ${entries2064.length}`);
  if (entries2064.length > 0) {
    entries2064.forEach((e, idx) => {
      console.log(`[buildEntradasItems ${origem}] Entry 002064 [${idx + 1}]:`, {
        documentItemId: e.documentItemId,
        cod_item: e.cod_item,
        quantidade_nf: e.quantidade_nf,
        adjusted_qty: e.adjusted_qty,
        qtd_produto: e.qtd_produto,
        custo_total: e.custo_total,
      });
    });
  } else if (items2064.length > 0) {
    console.error(`[buildEntradasItems ${origem}] ⚠️ ERRO: ${items2064.length} document_items 002064 encontrados, mas 0 entries após filtro!`);
  }
  
  // Log detalhado dos ajustes encontrados para o código 842
  const itemIds842 = documentItems
    .filter((item) => item.cod_item === "000842" || item.cod_item === "842")
    .map((item) => item.id);
  
  console.log("===== DEBUG buildEntradasItems 842 - AJUSTES =====");
  console.log("Origem:", origem);
  console.log("IDs de document_items para 842:", itemIds842);
  for (const itemId of itemIds842) {
    const ajuste = adjustments.get(itemId);
    console.log(`  Item ID ${itemId}: ajuste=${ajuste !== undefined ? ajuste : 'NÃO ENCONTRADO'}`);
  }
  console.log("Total de ajustes no Map:", adjustments.size);
  console.log("===== FIM DEBUG AJUSTES 842 =====");

  const entries842 = entries.filter(
    (e) => e.cod_item === "000842" || e.cod_item === "842"
  );
  console.log("===== DEBUG buildEntradasItems 842 =====");
  console.log("Origem:", origem);
  console.log("Total de entries 842:", entries842.length);
  for (const e of entries842) {
    console.log({
      origem,
      documentItemId: e.documentItemId ?? (e as any).document_item_id ?? null,
      cod_item: e.cod_item,
      qtd_nf: e.quantidade_nf ?? null,
      adjusted_qty: e.adjusted_qty ?? null,
      qtd_produto: e.qtd_produto ?? null,
      custo_unitario: e.custo_unitario ?? null,
      custo_total: e.custo_total ?? null,
    });
  }
  console.log("===== FIM DEBUG buildEntradasItems 842 =====");

  // ============================================================================
  // LOGS ESPECÍFICOS PARA CÓDIGO 004616 (conforme solicitado)
  // ============================================================================
  console.error("===== DEBUG ENTRIES 004616 =====");
  const entries4616 = entries.filter(e => e.cod_item === "004616" || e.cod_item === "4616");
  console.error(`Total de entries para código 004616: ${entries4616.length}`);
  
  for (const entry of entries4616) {
    console.error({
      documentItemId: entry.documentItemId,
      cod_item: entry.cod_item,
      document_id: entry.documentId,
      qtd_nf: entry.quantidade_nf,
      qtd_ajustada: entry.adjusted_qty,
      nota: entry.nota,
      fornecedor: entry.fornecedor,
    });
  }
  console.error("===== FIM DEBUG ENTRIES 004616 =====");
  
  // Verificar se o ID problemático está na lista
  const PROBLEMATIC_ID = '3420da84-15ff-46da-84fb-be88a8c1b675';
  const entryProblematico = entries.find(e => e.documentItemId === PROBLEMATIC_ID);
  if (entryProblematico) {
    console.error(`⚠️⚠️⚠️ PROBLEMA ENCONTRADO: Entry com ID problemático ${PROBLEMATIC_ID}:`);
    console.error({
      documentItemId: entryProblematico.documentItemId,
      cod_item: entryProblematico.cod_item,
      document_id: entryProblematico.documentId,
      qtd_nf: entryProblematico.quantidade_nf,
      nota: entryProblematico.nota,
      fornecedor: entryProblematico.fornecedor,
    });
    console.error(`⚠️ Este item NÃO deveria estar na lista de entries!`);
    console.error(`⚠️ O documento ${entryProblematico.documentId} não está no SPED selecionado ou não tem ind_oper='0'`);
  }

  // ============================================================================
  // DEDUPLICAÇÃO CRÍTICA: Garantir que cada document_item_id aparece UMA vez
  // ============================================================================
  // Esta é a correção principal para evitar entradas duplicadas na Consolidação
  const uniqueEntriesByDocumentItemId = new Map<string, EntradaItem>();
  
  for (const entry of entries) {
    if (!entry.documentItemId) {
      console.warn(`[buildEntradasItems] Entry sem documentItemId encontrado, pulando:`, entry);
      continue;
    }
    
    if (!uniqueEntriesByDocumentItemId.has(entry.documentItemId)) {
      uniqueEntriesByDocumentItemId.set(entry.documentItemId, entry);
    } else {
      // Log quando encontra duplicata (isso não deveria acontecer, mas vamos registrar)
      const existing = uniqueEntriesByDocumentItemId.get(entry.documentItemId)!;
      console.warn(`[buildEntradasItems] ⚠️ DUPLICATA DETECTADA para documentItemId ${entry.documentItemId}:`, {
        existing: {
          documentId: existing.documentId,
          cod_item: existing.cod_item,
          nota: existing.nota,
        },
        duplicate: {
          documentId: entry.documentId,
          cod_item: entry.cod_item,
          nota: entry.nota,
        },
      });
    }
  }
  
  const entriesDeduplicadas = Array.from(uniqueEntriesByDocumentItemId.values());
  
  console.log("[DEBUG ENTRADAS] totalEntriesAposDeduplicacao:", entriesDeduplicadas.length);
  console.log("[DEBUG ENTRADAS] totalEntries ANTES da deduplicação:", entries.length);
  if (entries.length !== entriesDeduplicadas.length) {
    console.warn(`[DEBUG ENTRADAS] ⚠️ DEDUPLICAÇÃO: ${entries.length} entries antes, ${entriesDeduplicadas.length} depois (${entries.length - entriesDeduplicadas.length} duplicatas removidas)`);
  }
  if (entries.length !== entriesDeduplicadas.length) {
    console.warn(`[buildEntradasItems] ⚠️ DEDUPLICAÇÃO: ${entries.length} entries antes, ${entriesDeduplicadas.length} depois (${entries.length - entriesDeduplicadas.length} duplicatas removidas)`);
  }

  return entriesDeduplicadas;
}

