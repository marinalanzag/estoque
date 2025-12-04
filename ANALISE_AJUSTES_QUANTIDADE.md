# Análise: Como o Sistema Interpreta Ajustes de Quantidade (document_item_adjustments)

## 📋 Resumo Executivo

Este documento mapeia **exatamente** como o sistema lê e aplica os ajustes de quantidade (`document_item_adjustments`) hoje, para evoluir o fluxo por período sem reabrir bugs antigos.

---

## 1. Onde os Ajustes São Lidos e Aplicados

### 1.1 Arquivos/Funções que Fazem Leitura dos Ajustes

#### **A) `lib/entradas.ts` - Função `fetchDocumentItems`**

```75:158:lib/entradas.ts
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
```

**Características:**
- Recebe uma lista de `documentIds` (IDs dos documentos do SPED)
- Busca os `document_items` desses documentos
- Depois busca ajustes **apenas** para os IDs de `document_items` encontrados
- **NÃO filtra por período ou SPED diretamente** - depende dos `documentIds` passados

#### **B) `lib/entradas.ts` - Função `buildEntradasItems`**

Esta função tem uma lógica adicional que **expande** a busca de ajustes:

```214:320:lib/entradas.ts
  // 4. INCLUIR ITENS COM AJUSTES DE OUTROS SPEDs DO PERÍODO ATIVO
  // Buscar todos os ajustes no banco
  const { data: todosAjustes, error: ajustesError } = await supabaseAdmin
    .from("document_item_adjustments")
    .select("document_item_id, adjusted_qty")
    .limit(500);
  
  if (!ajustesError && todosAjustes && todosAjustes.length > 0 && activePeriod) {
    const idsComAjuste = todosAjustes.map(a => a.document_item_id).filter(Boolean);
    
    // Buscar os document_items correspondentes
    const chunkSize = 100;
    const itensComAjuste: any[] = [];
    for (let i = 0; i < idsComAjuste.length; i += chunkSize) {
      const chunk = idsComAjuste.slice(i, i + chunkSize);
      const { data: itens, error: itensError } = await supabaseAdmin
        .from("document_items")
        .select("id, document_id, cod_item")
        .in("id", chunk);
      
      if (!itensError && itens) {
        itensComAjuste.push(...itens);
      }
    }
    
    // Buscar os documentos desses itens
    const docIdsComAjuste = Array.from(new Set(itensComAjuste.map(i => i.document_id).filter(Boolean)));
    if (docIdsComAjuste.length > 0) {
      const { data: docsComAjuste, error: docsError } = await supabaseAdmin
        .from("documents")
        .select("id, sped_file_id, ind_oper")
        .in("id", docIdsComAjuste)
        .eq("ind_oper", "0");
      
      if (!docsError && docsComAjuste) {
        // Buscar SPEDs do período ativo
        const { data: spedFilesPeriodo, error: spedError } = await supabaseAdmin
          .from("sped_files")
          .select("id")
          .eq("period_id", activePeriod.id);
        
        if (!spedError && spedFilesPeriodo) {
          const spedIdsPeriodo = new Set(spedFilesPeriodo.map(sf => sf.id));
          
          // Filtrar documentos que pertencem a SPEDs do período ativo
          const docsPeriodoAtivo = docsComAjuste.filter(doc => 
            doc.sped_file_id && spedIdsPeriodo.has(doc.sped_file_id)
          );
          
          // Adicionar documentos que não estão na lista inicial
          const novosDocIds = docsPeriodoAtivo
            .map(doc => doc.id)
            .filter(id => !documentIds.includes(id));
          
          if (novosDocIds.length > 0) {
            // Buscar informações completas dos novos documentos
            const { data: novosDocs, error: novosDocsError } = await supabaseAdmin
              .from("documents")
              .select(`
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
              `)
              .in("id", novosDocIds);
            
            if (!novosDocsError && novosDocs) {
              documents.push(...novosDocs);
              documentIds.push(...novosDocIds);
              
              // Buscar itens dos novos documentos
              const { data: novosItens, error: novosItensError } = await supabaseAdmin
                .from("document_items")
                .select("id, document_id, cod_item, num_item, descr_compl, qtd, unid, vl_item, cfop")
                .in("document_id", novosDocIds);
              
              if (!novosItensError && novosItens) {
                documentItems.push(...novosItens);
                
                // Adicionar ajustes para os novos itens
                const novosItemIds = novosItens.map(i => i.id).filter(Boolean);
                for (const ajuste of todosAjustes) {
                  if (ajuste.document_item_id && novosItemIds.includes(ajuste.document_item_id)) {
                    if (ajuste.adjusted_qty !== null && ajuste.adjusted_qty !== undefined) {
                      adjustments.set(ajuste.document_item_id, Number(ajuste.adjusted_qty));
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
```

**⚠️ PROBLEMA CRÍTICO IDENTIFICADO:**
- Esta lógica busca **TODOS os ajustes do banco** (limit 500) sem filtro inicial
- Depois tenta filtrar por período ativo, mas **se o período ativo não existir ou não estiver configurado, pode trazer ajustes de qualquer período**
- A lógica depende de `activePeriod` estar definido

#### **C) `lib/consolidado.ts` - Função `fetchEntryAggregates`**

```65:186:lib/consolidado.ts
async function fetchEntryAggregates(
  supabaseAdmin: SupabaseAdmin,
  spedFileId: string,
  activePeriodId?: string | null
): Promise<{
  aggregate: Map<
    string,
    { cod_item: string; qty: number; valor: number; descr?: string | null; unid?: string | null }
  >;
}> {
  console.log('[DEBUG CONSOLIDACAO] activePeriodId:', activePeriodId);
  console.log('[DEBUG CONSOLIDACAO] spedFileId:', spedFileId);
  console.log('🚀 [fetchEntryAggregates] Iniciando com buildEntradasItems');

  const entries = await buildEntradasItems(
    supabaseAdmin,
    spedFileId,
    "CONSOLIDACAO"
  );

  const aggregate = new Map<
    string,
    { cod_item: string; qty: number; valor: number; descr?: string | null; unid?: string | null }
  >();

  entries.forEach((entry) => {
    const rawCode = entry.cod_item ?? (entry as any).codItem;
    if (!rawCode) {
      return;
    }

    const codItem = normalizeCodItem(rawCode);
    
    // DEBUG específico para código 842
    if (codItem === "000842" || codItem === "842") {
      console.log(`[fetchEntryAggregates] Entry 842:`, {
        documentItemId: entry.documentItemId,
        cod_item: codItem,
        quantidade_nf: entry.quantidade_nf,
        adjusted_qty: entry.adjusted_qty,
        qtd_produto: entry.qtd_produto,
        custo_total: entry.custo_total,
      });
    }
    
    const qtyUsada =
      entry.adjusted_qty ??
      (entry as any).adjustedQty ??
      entry.qtd_produto ??
      entry.quantidade_nf ??
      0;
    
    // DEBUG específico para código 842 - qtyUsada
    if (codItem === "000842" || codItem === "842") {
      console.log(`[fetchEntryAggregates] Entry 842 - qtyUsada calculada:`, qtyUsada);
    }

    const unitCost =
      entry.custo_unitario ??
      (entry as any).unit_cost ??
      (entry.custo_total !== undefined && qtyUsada
        ? Number(entry.custo_total) / qtyUsada
        : null);

    const valorUsado =
      unitCost !== null ? qtyUsada * unitCost : Number(entry.custo_total ?? 0);

    const atual =
      aggregate.get(codItem) ||
      {
        cod_item: codItem,
        qty: 0,
        valor: 0,
        descr: entry.descr_item ?? null,
        unid: entry.unidade_produto ?? entry.unidade_nf ?? null,
      };

    atual.qty += qtyUsada;
    atual.valor += valorUsado;

    if (!atual.descr && entry.descr_item) {
      atual.descr = entry.descr_item;
    }
    if (!atual.unid && (entry.unidade_produto || entry.unidade_nf)) {
      atual.unid = entry.unidade_produto ?? entry.unidade_nf ?? null;
    }

    aggregate.set(codItem, atual);

    if (codItem === '000842' || codItem === '842') {
      console.log('[DEBUG CONSOLIDACAO ENTRADA 842]', {
        documentItemId: entry.documentItemId ?? (entry as any).document_item_id,
        cod_item: codItem,
        quantidade_nf: entry.quantidade_nf ?? null,
        qtd_produto: entry.qtd_produto ?? null,
        adjusted_qty: entry.adjusted_qty ?? (entry as any).adjustedQty ?? null,
        qtyUsada,
        unitCost,
        valorUsado,
      });
    }
  });

  console.log('✅ [fetchEntryAggregates] Total de códigos agregados:', aggregate.size);
  const debug842 = aggregate.get('000842') ?? aggregate.get('842') ?? null;
  console.log('🔍 [DEBUG FINAL 842]', debug842);
  
  // DEBUG: Mostrar todos os entries do código 842 que foram processados
  const entries842 = entries.filter(e => e.cod_item === '000842' || e.cod_item === '842');
  console.log(`[fetchEntryAggregates] Total de entries 842 processados: ${entries842.length}`);
  entries842.forEach((e, idx) => {
    console.log(`[fetchEntryAggregates] Entry 842 [${idx + 1}]:`, {
      documentItemId: e.documentItemId,
      quantidade_nf: e.quantidade_nf,
      adjusted_qty: e.adjusted_qty,
      qtd_produto: e.qtd_produto,
      qty_usada_esperada: e.adjusted_qty ?? e.quantidade_nf,
    });
  });

  return { aggregate };
}
```

**Características:**
- Chama `buildEntradasItems` que já traz os ajustes aplicados
- Usa `entry.adjusted_qty` quando disponível, senão usa `qtd_produto` ou `quantidade_nf`

#### **D) `app/movimentacoes/entradas/page.tsx` - Função `fetchDocumentItems`**

Similar à função em `lib/entradas.ts`, mas com logs adicionais.

#### **E) `app/api/adjustments/inventory-data/route.ts`**

```56:76:app/api/adjustments/inventory-data/route.ts
    // Buscar entradas (ajustadas)
    const entries = await fetchAllRows(async (from, to) => {
      const { data, error } = await supabaseAdmin
        .from("document_items")
        .select(
          `
          cod_item,
          qtd,
          vl_item,
          movement_qty,
          document_item_adjustments(adjusted_qty),
          documents!inner(sped_file_id, ind_oper)
          `
        )
        .eq("documents.sped_file_id", spedFileId)
        .eq("movement_type", "entrada")
        .range(from, to);

      if (error) throw new Error(`Erro ao buscar entradas: ${error.message}`);
      return data ?? [];
    });
```

**Características:**
- Usa **join** com `document_item_adjustments` via Supabase
- **Filtra por `sped_file_id`** através do join com `documents`
- Esta é a query mais segura, pois filtra diretamente pelo SPED

---

## 2. Query Exata dos Ajustes

### 2.1 Schema da Tabela

```83:90:supabase/schema.sql
create table if not exists document_item_adjustments (
  id uuid primary key default gen_random_uuid(),
  document_item_id uuid references document_items(id) on delete cascade,
  adjusted_qty numeric not null,
  reason text,
  updated_at timestamptz not null default now(),
  unique (document_item_id)
);
```

**⚠️ IMPORTANTE:**
- A tabela **NÃO tem** campo `period_id`
- A tabela **NÃO tem** campo `sped_file_id`
- A tabela **só tem** `document_item_id` como referência

### 2.2 Queries Atuais

#### **Query 1: Busca por IDs de document_items (usada em `fetchDocumentItems`)**

```typescript
const { data, error } = await supabaseAdmin
  .from("document_item_adjustments")
  .select("document_item_id, adjusted_qty")
  .in("document_item_id", validChunk); // validChunk = array de IDs de document_items
```

**Filtros:**
- ✅ `.in("document_item_id", [...])` - filtra pelos IDs dos document_items
- ❌ **NÃO filtra por period_id** (não existe na tabela)
- ❌ **NÃO filtra por sped_file_id** (não existe na tabela)
- ⚠️ **Depende indiretamente** dos `documentIds` passados para `fetchDocumentItems`

#### **Query 2: Busca TODOS os ajustes (usada em `buildEntradasItems` - PROBLEMÁTICA)**

```typescript
const { data: todosAjustes, error: ajustesError } = await supabaseAdmin
  .from("document_item_adjustments")
  .select("document_item_id, adjusted_qty")
  .limit(500); // ⚠️ LIMIT 500 - pode não pegar todos!
```

**Filtros:**
- ❌ **NENHUM filtro** - busca todos os ajustes do banco
- ⚠️ **Limit 500** - se houver mais de 500 ajustes, alguns não serão considerados
- ⚠️ Depois tenta filtrar por período, mas **só funciona se `activePeriod` estiver definido**

#### **Query 3: Join com documents (usada em `inventory-data/route.ts` - MAIS SEGURA)**

```typescript
const { data, error } = await supabaseAdmin
  .from("document_items")
  .select(`
    cod_item,
    qtd,
    vl_item,
    movement_qty,
    document_item_adjustments(adjusted_qty),
    documents!inner(sped_file_id, ind_oper)
  `)
  .eq("documents.sped_file_id", spedFileId)
  .eq("movement_type", "entrada")
  .range(from, to);
```

**Filtros:**
- ✅ `.eq("documents.sped_file_id", spedFileId)` - **filtra diretamente por SPED**
- ✅ `.eq("movement_type", "entrada")` - filtra apenas entradas
- ✅ Usa join, então os ajustes vêm automaticamente filtrados pelo SPED

---

## 3. Como o Ajuste Entra no Cálculo

### 3.1 Em `lib/entradas.ts` - `buildEntradasItems`

```729:820:lib/entradas.ts
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
      const conversoesDoItem = conversionMapByItem.get(item.cod_item) || [];
      
      let unidadeProduto: { unid_conv: string; fat_conv: number } | undefined;
      if (unidNF && conversoesDoItem.length > 0) {
        unidadeProduto = conversoesDoItem.find(
          (conv) => conv.unid_conv.trim().toUpperCase() === unidNF.toUpperCase()
        );
        
        if (!unidadeProduto) {
          unidadeProduto = conversoesDoItem.find(
            (conv) => conv.unid_conv.trim().replace(/\s+/g, "").toUpperCase() === unidNF.replace(/\s+/g, "").toUpperCase()
          );
        }
        
        if (!unidadeProduto && conversoesDoItem.length === 1) {
          unidadeProduto = conversoesDoItem[0];
        }
      }
      
      const quantidadeNF = item.qtd ?? 0;
      const custoTotal = item.vl_item ?? 0;
      const custoUnitario =
        quantidadeNF !== 0 ? custoTotal / quantidadeNF : custoTotal;
      const adjustedQty = adjustments.get(item.id) ?? null;
      
      // DEBUG específico para código 842
      if ((item.cod_item === "000842" || item.cod_item === "842") && origem === "ENTRADAS") {
        console.log(`[buildEntradasItems ${origem}] Item 842 encontrado:`, {
          itemId: item.id,
          cod_item: item.cod_item,
          qtd_nf: quantidadeNF,
          adjustedQty,
          ajusteNoMap: adjustments.get(item.id),
          totalAjustesNoMap: adjustments.size,
        });
      }

      const productInfo = productMap.get(item.cod_item);
      return {
        documentItemId: item.id, // SEMPRE o ID do document_item da NF original
        documentId: item.document_id,
        nota: `${document.serie || ""} ${document.num_doc || ""}`.trim(),
        fornecedor,
        fornecedorDoc,
        dataDocumento: document.dt_doc,
        cod_item: item.cod_item,
        descr_item:
          productInfo?.descr_item ||
          catalogDescriptions.get(item.cod_item) ||
          item.descr_compl ||
          "[Sem descrição]",
        unidade_nf: item.unid || null,
        quantidade_nf: quantidadeNF,
        unidade_produto: unidadeProduto?.unid_conv || null,
        fat_conv: unidadeProduto?.fat_conv || null,
        qtd_produto:
          unidadeProduto && unidadeProduto.fat_conv
            ? quantidadeNF * unidadeProduto.fat_conv
            : quantidadeNF,
        custo_unitario: custoUnitario,
        custo_total: custoTotal,
        adjusted_qty: adjustedQty,
        sped_file_id: document.sped_file_id, // ID do SPED ao qual o documento pertence
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
```

**Lógica:**
- Linha 779: `const adjustedQty = adjustments.get(item.id) ?? null;`
- O ajuste é buscado do `Map<string, number>` usando o `item.id` (document_item_id)
- O ajuste é armazenado no campo `adjusted_qty` do entry
- **O ajuste NÃO substitui `quantidade_nf` ou `qtd_produto` aqui** - apenas é armazenado

### 3.2 Em `lib/consolidado.ts` - `fetchEntryAggregates`

```110:115:lib/consolidado.ts
    const qtyUsada =
      entry.adjusted_qty ??
      (entry as any).adjustedQty ??
      entry.qtd_produto ??
      entry.quantidade_nf ??
      0;
```

**Lógica:**
- **Aqui sim o ajuste é aplicado!**
- Se `entry.adjusted_qty` existe, usa ele
- Senão, usa `qtd_produto` (quantidade convertida)
- Senão, usa `quantidade_nf` (quantidade original da NF)
- Esta é a **fonte da verdade** para o cálculo de entradas na consolidação

### 3.3 Em `app/api/adjustments/inventory-data/route.ts`

```151:183:app/api/adjustments/inventory-data/route.ts
    // Processar entradas
    entries.forEach((item: any) => {
      const codItem = normalizeCodItem(item.cod_item);
      const adjustedQty = item.document_item_adjustments?.[0]?.adjusted_qty;
      const qtd = adjustedQty !== null && adjustedQty !== undefined
        ? Number(adjustedQty)
        : Math.abs(Number(item.movement_qty ?? item.qtd ?? 0));
      const vlItem = Number(item.vl_item ?? 0);
      const unitCost = qtd > 0 ? vlItem / qtd : 0;

      const current = inventory.get(codItem);
      if (current) {
        current.entradas += qtd;
        current.estoque_teorico += qtd;
        // Atualizar custo médio ponderado
        const totalQtd = current.estoque_inicial + current.entradas;
        const totalValor = current.valor_estoque + vlItem;
        current.unit_cost = totalQtd > 0 ? totalValor / totalQtd : current.unit_cost;
        current.valor_estoque = totalQtd * current.unit_cost;
      } else {
        inventory.set(codItem, {
          cod_item: codItem,
          estoque_inicial: 0,
          entradas: qtd,
          saidas: 0,
          estoque_teorico: qtd,
          unit_cost: unitCost,
          valor_estoque: vlItem,
          ajustes_recebidos: 0,
          ajustes_fornecidos: 0,
          estoque_final: qtd,
        });
      }
    });
```

**Lógica:**
- Linha 153: `const adjustedQty = item.document_item_adjustments?.[0]?.adjusted_qty;`
- Linha 154-156: Se `adjustedQty` existe, usa ele, senão usa `movement_qty` ou `qtd`

---

## 4. Escopo por Período/SPED

### 4.1 Filtros Atuais

#### **Cenário 1: Busca Normal (via `fetchDocumentItems`)**

1. Recebe `documentIds` do SPED selecionado
2. Busca `document_items` desses documentos
3. Busca ajustes **apenas** para esses `document_items`
4. **Garantia:** Se os `documentIds` estão corretos (filtrados por SPED), os ajustes também estarão

**✅ SEGURO** - desde que os `documentIds` sejam filtrados corretamente

#### **Cenário 2: Busca Expandida (via `buildEntradasItems` - linhas 214-320)**

1. Busca **TODOS os ajustes** do banco (limit 500)
2. Para cada ajuste, busca o `document_item` correspondente
3. Busca o `document` do `document_item`
4. Busca os SPEDs do período ativo
5. Filtra documentos que pertencem a SPEDs do período ativo
6. Adiciona esses documentos/itens/ajustes à lista

**⚠️ PROBLEMAS:**
- Se `activePeriod` não existir, **não filtra nada** e pode trazer ajustes de qualquer período
- Se houver mais de 500 ajustes, alguns não serão considerados (limit 500)
- A lógica é complexa e pode ter bugs

#### **Cenário 3: Join com documents (via `inventory-data/route.ts`)**

1. Faz join `document_items` → `documents` → `document_item_adjustments`
2. Filtra por `documents.sped_file_id = spedFileId`
3. **Garantia:** Apenas ajustes de itens do SPED selecionado

**✅ MUITO SEGURO** - filtro direto no banco

### 4.2 Resposta ao Caso de Teste Mental

**Cenário:**
- SPED A = Jan/2022, com cod_item = 842
- SPED B = Fev/2022, também com cod_item = 842
- Ajuste lançado apenas no item do SPED B

**Pergunta:** A consolidação de Jan/2022 enxerga esse ajuste?

**Resposta: Depende do caminho de código:**

#### **Se usar `fetchDocumentItems` normalmente:**
- ✅ **NÃO** - porque os `documentIds` vêm apenas do SPED A (Jan/2022)
- Os ajustes são buscados apenas para os `document_items` do SPED A
- O ajuste do SPED B não será encontrado

#### **Se usar `buildEntradasItems` com período ativo:**
- ⚠️ **PODE SIM** - se:
  1. O período ativo incluir tanto Jan/2022 quanto Fev/2022
  2. A lógica de expansão (linhas 214-320) encontrar o ajuste
  3. O ajuste estiver entre os primeiros 500 ajustes do banco
- ⚠️ **NÃO** - se:
  1. O período ativo for apenas Jan/2022
  2. O ajuste estiver além do limit 500
  3. `activePeriod` não estiver definido

#### **Se usar join com documents:**
- ✅ **NÃO** - porque filtra diretamente por `sped_file_id`

---

## 5. Problemas Identificados

### 5.1 Problema Crítico: Busca Expandida sem Filtro Inicial

A lógica em `buildEntradasItems` (linhas 214-320) busca **TODOS os ajustes** sem filtro inicial:

```typescript
const { data: todosAjustes, error: ajustesError } = await supabaseAdmin
  .from("document_item_adjustments")
  .select("document_item_id, adjusted_qty")
  .limit(500); // ⚠️ Sem filtro!
```

**Riscos:**
1. Pode trazer ajustes de períodos diferentes se `activePeriod` não estiver definido
2. Limit 500 pode não pegar todos os ajustes
3. Performance ruim (busca tudo e depois filtra)

### 5.2 Problema: Tabela sem Campos de Filtro

A tabela `document_item_adjustments` não tem:
- `period_id`
- `sped_file_id`

Isso força filtros indiretos através de joins, o que é mais propenso a erros.

### 5.3 Problema: Lógica Complexa e Duplicada

Há múltiplas formas de buscar ajustes:
1. `fetchDocumentItems` - busca por IDs de document_items
2. `buildEntradasItems` - busca expandida por período
3. Join direto - usado em `inventory-data/route.ts`

Cada uma tem comportamento diferente, aumentando risco de bugs.

---

## 6. Recomendações para Evolução

### 6.1 Adicionar Campos de Filtro na Tabela

Considerar adicionar:
- `period_id` (opcional, pode ser NULL para ajustes antigos)
- `sped_file_id` (opcional, pode ser derivado do document_item)

### 6.2 Padronizar Busca de Ajustes

Criar uma função única para buscar ajustes que:
1. Receba `spedFileId` e `periodId` como parâmetros
2. Faça join com `documents` para filtrar por SPED
3. Filtre por período através do `sped_files.period_id`

### 6.3 Remover Lógica de Expansão Problemática

A lógica de expansão em `buildEntradasItems` (linhas 214-320) deveria ser:
- Removida, OU
- Refatorada para usar filtros diretos no banco

### 6.4 Usar Join como Padrão

A query em `inventory-data/route.ts` é a mais segura. Considerar usar esse padrão em todos os lugares.

---

## 7. Conclusão

**Estado Atual:**
- Os ajustes são buscados principalmente por `document_item_id`
- Não há filtro direto por período ou SPED na tabela
- A lógica de expansão em `buildEntradasItems` pode trazer ajustes de outros períodos se não houver período ativo definido
- O cálculo usa `adjusted_qty ?? qtd_produto ?? quantidade_nf` na consolidação

**Risco de Bug no Caso de Teste:**
- **ALTO** - se usar `buildEntradasItems` sem período ativo definido
- **BAIXO** - se usar `fetchDocumentItems` normalmente
- **ZERO** - se usar join com documents

**Próximos Passos:**
1. Decidir se queremos manter a lógica de expansão por período
2. Se sim, adicionar filtros mais seguros
3. Se não, remover a lógica de expansão
4. Padronizar a busca de ajustes em uma função única






