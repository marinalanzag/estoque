import { NextRequest, NextResponse } from "next/server";
import { normalizeCodItem } from "@/lib/utils";

function parseNumberBR(value?: string | null): number | null {
  if (!value) return null;
  return Number(value.replace(".", "").replace(",", "."));
}

function parseDateSPED(value?: string | null): string | null {
  if (!value || value.length !== 8) return null;
  const dd = value.slice(0, 2);
  const mm = value.slice(2, 4);
  const yyyy = value.slice(4, 8);
  
  // Validar se é uma data válida
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) return null;
  
  return `${yyyy}-${mm}-${dd}`;
}

interface Product {
  sped_file_id: string;
  cod_item: string;
  descr_item: string;
  unid_inv?: string;
  tp_item?: string;
  cod_ncm?: string;
  cod_gen?: string;
  cod_lst?: string;
  aliq_icms?: number | null;
}

interface Conversion {
  sped_file_id: string;
  cod_item: string;
  unid_conv: string;
  fat_conv: number;
}

interface Partner {
  sped_file_id: string;
  cod_part: string;
  name?: string;
  cnpj?: string;
  cpf?: string;
  ie?: string;
  uf?: string;
  cod_mun?: string;
  suframa?: string;
  endereco?: string;
  numero?: string;
  compl?: string;
  bairro?: string;
  cep?: string;
  telefone?: string;
  email?: string;
}

interface Document {
  sped_file_id: string;
  ind_oper?: string;
  cod_part?: string;
  partner_id?: string;
  cod_mod?: string;
  cod_sit?: string;
  serie?: string;
  num_doc?: string;
  chv_nfe?: string;
  dt_doc?: string | null;
  dt_e_s?: string | null;
  vl_doc?: number | null;
  _tempKey?: string; // Chave temporária para mapeamento
}

interface DocumentItemTemp {
  _docIndex: number;
  num_item: number;
  cod_item: string;
  descr_compl?: string;
  qtd: number;
  unid?: string;
  vl_item: number;
  cfop?: string;
}

interface Inventory {
  sped_file_id: string;
  dt_inv: string;
  motive?: string | null;
  vl_inv?: number | null;
}

interface InventoryItemTemp {
  _invIndex: number;
  cod_item: string;
  unid?: string;
  qtd: number;
  vl_unit?: number | null;
  vl_item?: number | null;
}

export async function POST(req: NextRequest) {
  try {
    // Importar dinamicamente para capturar erros de inicialização
    const { getSupabaseAdmin } = await import("@/lib/supabaseServer");
    const supabaseAdmin = getSupabaseAdmin();
    
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  // Buscar período ativo
  const { data: activePeriod } = await supabaseAdmin
    .from("periods")
    .select("id")
    .eq("is_active", true)
    .single();

  const { data: spedFile, error: spedError } = await supabaseAdmin
    .from("sped_files")
    .insert({ 
      name: file.name,
      period_id: activePeriod?.id || null
    })
    .select()
    .single();

  if (spedError || !spedFile) {
    console.error("Erro ao criar registro do arquivo:", spedError);
    const errorMsg = spedError?.message || "Erro desconhecido ao criar registro";
    return NextResponse.json(
      { error: `Erro ao criar registro do arquivo: ${errorMsg}` },
      { status: 500 }
    );
  }

  const products: Product[] = [];
  const conversions: Conversion[] = [];
  const partners: Partner[] = [];
  const documents: Document[] = [];
  const inventories: Inventory[] = [];
  const documentItems: DocumentItemTemp[] = [];
  const inventoryItems: InventoryItemTemp[] = [];

  let currentDocIndex: number | null = null;
  let currentInvIndex: number | null = null;

  for (const line of lines) {
    // Remover espaços em branco no início/fim e dividir por |
    const trimmedLine = line.trim();
    const parts = trimmedLine.split("|");
    
    // IMPORTANTE: No SPED, a linha pode começar com | ou não
    // Se começar com |, parts[0] = "" e parts[1] = tipo do registro
    // Se não começar com |, parts[0] = tipo do registro
    // Vamos normalizar: se parts[0] está vazio, usar parts[1]
    const reg = parts[0] || parts[1];

    switch (reg) {
      case "0150": {
        const cleaned = parts[0] === "" ? parts.slice(1) : parts;
        const cod_part = (cleaned[1] || "").trim();
        if (!cod_part) break;
        partners.push({
          sped_file_id: spedFile.id,
          cod_part,
          name: (cleaned[2] || "").trim() || undefined,
          cnpj: (cleaned[4] || "").trim() || undefined,
          cpf: (cleaned[5] || "").trim() || undefined,
          ie: (cleaned[6] || "").trim() || undefined,
          cod_mun: (cleaned[7] || "").trim() || undefined,
          suframa: (cleaned[8] || "").trim() || undefined,
          endereco: (cleaned[9] || "").trim() || undefined,
          numero: (cleaned[10] || "").trim() || undefined,
          compl: (cleaned[11] || "").trim() || undefined,
          bairro: (cleaned[12] || "").trim() || undefined,
          uf: (cleaned[13] || "").trim() || undefined,
          cep: (cleaned[14] || "").trim() || undefined,
          telefone: (cleaned[15] || "").trim() || undefined,
          email: (cleaned[17] || "").trim() || undefined,
        });
        break;
      }
      case "0200": {
        const shift = parts[0] === "" ? 1 : 0;
        const cod_item_idx = 1 + shift;
        const descr_idx = 2 + shift;
        const unid_idx = 4 + shift;
        const tp_item_idx = 5 + shift;
        const cod_ncm_idx = 6 + shift;
        const cod_gen_idx = 8 + shift;
        const cod_lst_idx = 9 + shift;
        const aliq_idx = 10 + shift;

        products.push({
          sped_file_id: spedFile.id,
          cod_item: normalizeCodItem(parts[cod_item_idx] || ""),
          descr_item: parts[descr_idx] || "",
          unid_inv: parts[unid_idx] || undefined,
          tp_item: parts[tp_item_idx] || undefined,
          cod_ncm: parts[cod_ncm_idx] || undefined,
          cod_gen: parts[cod_gen_idx] || undefined,
          cod_lst: parts[cod_lst_idx] || undefined,
          aliq_icms: parseNumberBR(parts[aliq_idx])
        });
        break;
      }
      case "0220": {
        const hasLeadingPipe = parts[0] === "";
        const baseIdx = hasLeadingPipe ? 2 : 1;
        const cod_item_idx = baseIdx;
        const unid_conv_idx = baseIdx + 1;
        const fat_conv_idx = baseIdx + 2;

        conversions.push({
          sped_file_id: spedFile.id,
          cod_item: normalizeCodItem(parts[cod_item_idx] || ""),
          unid_conv: parts[unid_conv_idx] || "",
          fat_conv: parseNumberBR(parts[fat_conv_idx]) ?? 1
        });
        break;
      }
      case "C100": {
        currentDocIndex = documents.length;
        
        // Estrutura do C100 no SPED:
        // |C100|IND_OPER|IND_EMIT|COD_PART|COD_MOD|COD_SIT|SER|NUM_DOC|CHV_NFE|DT_DOC|DT_E_S|VL_DOC|...
        // Se a linha começa com |: parts[0] = "", parts[1] = "C100", parts[2] = IND_OPER
        // Se a linha não começa com |: parts[0] = "C100", parts[1] = IND_OPER
        
        // Normalizar: se parts[0] está vazio, significa que a linha começa com |
        const ind_oper_idx = parts[0] === "" ? 2 : 1;
        const cod_part_idx = parts[0] === "" ? 4 : 3;
        const cod_mod_idx = parts[0] === "" ? 5 : 4;
        const cod_sit_idx = parts[0] === "" ? 6 : 5;
        const serie_idx = parts[0] === "" ? 7 : 6;
        const num_doc_idx = parts[0] === "" ? 8 : 7;
        const chv_nfe_idx = parts[0] === "" ? 9 : 8;
        const dt_doc_idx = parts[0] === "" ? 10 : 9;
        const dt_e_s_idx = parts[0] === "" ? 11 : 10;
        const vl_doc_idx = parts[0] === "" ? 12 : 11;
        
        const ind_oper_raw = parts[ind_oper_idx] || "";
        const ind_oper = ind_oper_raw.trim();
        const docKey = `${(parts[serie_idx] || "").trim()}-${(parts[num_doc_idx] || "").trim()}-${(parts[chv_nfe_idx] || "").trim()}`;
        
        // Log para debug (apenas os primeiros 10 para não poluir)
        if (documents.length < 10) {
        }
        
        // Validar ind_oper
        if (ind_oper && ind_oper !== "0" && ind_oper !== "1") {
          console.warn(`⚠ C100 com ind_oper inválido: "${ind_oper}" (linha: ${trimmedLine.substring(0, 80)})`);
        }
        
        documents.push({
          sped_file_id: spedFile.id,
          ind_oper: ind_oper || undefined,
          cod_part: (parts[cod_part_idx] || "").trim() || undefined,
          cod_mod: (parts[cod_mod_idx] || "").trim() || undefined,
          cod_sit: (parts[cod_sit_idx] || "").trim() || undefined,
          serie: (parts[serie_idx] || "").trim() || undefined,
          num_doc: (parts[num_doc_idx] || "").trim() || undefined,
          chv_nfe: (parts[chv_nfe_idx] || "").trim() || undefined,
          dt_doc: parseDateSPED(parts[dt_doc_idx]),
          dt_e_s: parseDateSPED(parts[dt_e_s_idx]),
          vl_doc: parseNumberBR(parts[vl_doc_idx]),
          _tempKey: docKey // Chave temporária para mapeamento
        } as any);
        break;
      }
      case "C170": {
        if (currentDocIndex === null) {
          console.warn("⚠ C170 encontrado mas não há documento corrente (C100)");
          break;
        }
        
        // Normalizar índices: se parts[0] está vazio, linha começa com |
        const num_item_idx = parts[0] === "" ? 2 : 1;
        const cod_item_idx = parts[0] === "" ? 3 : 2;
        const descr_compl_idx = parts[0] === "" ? 4 : 3;
        const qtd_idx = parts[0] === "" ? 5 : 4;
        const unid_idx = parts[0] === "" ? 6 : 5;
        const vl_item_idx = parts[0] === "" ? 7 : 6;
        const cfop_idx = parts[0] === "" ? 11 : 10;
        
        const qtd = parseNumberBR(parts[qtd_idx]) ?? 0;
        const vl_item = parseNumberBR(parts[vl_item_idx]) ?? 0;

        // Verificar qual documento está sendo usado (para debug)
        const docAtual = documents[currentDocIndex];

        documentItems.push({
          _docIndex: currentDocIndex,
          num_item: Number((parts[num_item_idx] || "").trim()) || 0,
          cod_item: normalizeCodItem(parts[cod_item_idx] || ""), // Normalizar para 6 dígitos
          descr_compl: (parts[descr_compl_idx] || "").trim() || undefined,
          qtd,
          unid: (parts[unid_idx] || "").trim() || undefined,
          vl_item,
          cfop: (parts[cfop_idx] || "").trim() || undefined
        });
        break;
      }
      case "H005": {
        currentInvIndex = inventories.length;
        // Normalizar índices: se parts[0] está vazio, linha começa com |
        const dt_inv_idx = parts[0] === "" ? 2 : 1;
        const vl_inv_idx = parts[0] === "" ? 3 : 2;
        const motive_idx = parts[0] === "" ? 4 : 3;
        const dt_inv = parseDateSPED(parts[dt_inv_idx]);
        if (!dt_inv) break; // dt_inv é obrigatório
        
        inventories.push({
          sped_file_id: spedFile.id,
          dt_inv,
          motive: (parts[motive_idx] || "").trim() || null,
          vl_inv: parseNumberBR(parts[vl_inv_idx])
        });
        break;
      }
      case "H010": {
        if (currentInvIndex === null) break;
        // Normalizar índices: se parts[0] está vazio, linha começa com |
        const cod_item_idx = parts[0] === "" ? 2 : 1;
        const unid_idx = parts[0] === "" ? 3 : 2;
        const qtd_idx = parts[0] === "" ? 4 : 3;
        const vl_unit_idx = parts[0] === "" ? 5 : 4;
        const vl_item_idx = parts[0] === "" ? 6 : 5;
        inventoryItems.push({
          _invIndex: currentInvIndex,
          cod_item: normalizeCodItem(parts[cod_item_idx] || ""), // Normalizar para 6 dígitos
          unid: (parts[unid_idx] || "").trim() || undefined,
          qtd: parseNumberBR(parts[qtd_idx]) ?? 0,
          vl_unit: parseNumberBR(parts[vl_unit_idx]),
          vl_item: parseNumberBR(parts[vl_item_idx])
        });
        break;
      }
      default:
        break;
    }
  }

  // Logs de resumo do processamento

  // Inserir parceiros (0150)
  const uniquePartners = Array.from(
    new Map(
      partners
        .filter((p) => p.cod_part)
        .map((p) => [p.cod_part, p])
    ).values()
  );

  if (uniquePartners.length) {
    const { error: partnersError } = await supabaseAdmin
      .from("partners")
      .upsert(uniquePartners, { onConflict: "sped_file_id,cod_part" });
    if (partnersError) {
      console.error("Erro ao inserir parceiros:", partnersError);
      return NextResponse.json(
        { error: `Erro ao inserir parceiros: ${partnersError.message}` },
        { status: 500 }
      );
    }
  }

  const { data: partnerRows, error: partnersFetchError } = await supabaseAdmin
    .from("partners")
    .select("id, cod_part")
    .eq("sped_file_id", spedFile.id);

  if (partnersFetchError) {
    console.error("Erro ao buscar parceiros:", partnersFetchError);
    return NextResponse.json(
      { error: `Erro ao buscar parceiros: ${partnersFetchError.message}` },
      { status: 500 }
    );
  }

  const partnerIdMap = new Map<string, string>();
  partnerRows?.forEach((partner) => {
    if (partner.cod_part && partner.id) {
      partnerIdMap.set(partner.cod_part, partner.id);
    }
  });

  documents.forEach((document) => {
    if (document.cod_part) {
      const partnerId = partnerIdMap.get(document.cod_part);
      if (partnerId) {
        document.partner_id = partnerId;
      }
    }
  });

  // Remover duplicatas antes de inserir
  const uniqueProducts = Array.from(
    new Map(products.map(p => [`${p.sped_file_id}-${p.cod_item}`, p])).values()
  );
  
  const uniqueConversions = Array.from(
    new Map(conversions.map(c => [`${c.sped_file_id}-${c.cod_item}-${c.unid_conv}`, c])).values()
  );

  // inserts principais
  if (uniqueProducts.length) {
    const { error: productsError } = await supabaseAdmin
      .from("products")
      .upsert(uniqueProducts, { onConflict: "sped_file_id,cod_item" });
    if (productsError) {
      console.error("Erro ao inserir produtos:", productsError);
      return NextResponse.json(
        { error: `Erro ao inserir produtos: ${productsError.message}` },
        { status: 500 }
      );
    }
  }
  if (uniqueConversions.length) {
    const { error: conversionsError } = await supabaseAdmin
      .from("product_conversions")
      .upsert(uniqueConversions, {
        onConflict: "sped_file_id,cod_item,unid_conv",
      });
    if (conversionsError) {
      console.error("Erro ao inserir conversões:", conversionsError);
      return NextResponse.json(
        { error: `Erro ao inserir conversões: ${conversionsError.message}` },
        { status: 500 }
      );
    }
  }

  // Inserir documentos
  // Inserir documentos
  // Criar uma cópia sem _tempKey para inserção
  const documentsToInsert = documents.map(({ _tempKey, ...doc }) => doc);
  
  const { data: docRows, error: docsError } = await supabaseAdmin
    .from("documents")
    .insert(documentsToInsert)
    .select("id, ind_oper, sped_file_id, serie, num_doc, chv_nfe");

  if (docsError) {
    console.error("Erro ao inserir documentos:", docsError);
    return NextResponse.json(
      { error: `Erro ao inserir documentos: ${docsError.message}` },
      { status: 500 }
    );
  }

  console.log(`✓ Documentos inseridos: ${docRows?.length || 0}`);
  if (docRows && docRows.length > 0) {
    console.log(`  Primeiro documento: id=${docRows[0].id}, ind_oper=${docRows[0].ind_oper}, sped_file_id=${docRows[0].sped_file_id}`);
  }

  // IMPORTANTE: Filtrar apenas os documentos que acabaram de ser inseridos (mesmo sped_file_id)
  // O Supabase pode retornar documentos de importações anteriores se houver chaves duplicadas
  const filteredDocRows = docRows?.filter(doc => doc.sped_file_id === spedFile.id) || [];
  console.log(`  Documentos filtrados (mesmo sped_file_id): ${filteredDocRows.length} de ${docRows?.length || 0}`);
  
  // Verificar se a ordem está correta - se não, precisamos reordenar
  // O Supabase pode retornar em ordem diferente, então vamos criar um mapa baseado na ordem de inserção
  // Criar um mapa de documentos inseridos por índice original
  const documentsByOriginalIndex = new Map<number, Document>();
  documents.forEach((doc, idx) => {
    documentsByOriginalIndex.set(idx, doc);
  });
  
  // Criar mapa dos documentos retornados por suas características únicas
  // IMPORTANTE: Usar APENAS documentos do arquivo atual
  const docMapByKey = new Map<string, typeof docRows[0]>();
  filteredDocRows.forEach((doc) => {
    // Garantir que pertence ao arquivo atual
    if (doc.sped_file_id === spedFile.id) {
      const key = `${doc.serie || ""}-${doc.num_doc || ""}-${doc.chv_nfe || ""}`;
      if (key && key !== "--") {
        // Sempre substituir para garantir que usamos os documentos do arquivo atual
        docMapByKey.set(key, doc);
      }
    }
  });
  
  // Criar mapa por índice - usar a ordem retornada pelo Supabase
  // Assumimos que o Supabase retorna na mesma ordem que foram inseridos
  const docMapByIndex = new Map<number, typeof docRows[0]>();
  filteredDocRows.forEach((doc, idx) => {
    // Garantir que pertence ao arquivo atual
    if (doc.sped_file_id === spedFile.id && idx < documents.length) {
      docMapByIndex.set(idx, doc);
    }
  });
  
  console.log(`  Mapas criados: ${docMapByKey.size} por chave, ${docMapByIndex.size} por índice`);
  console.log(`  Documentos originais: ${documents.length}, Documentos retornados filtrados: ${filteredDocRows.length}`);
  
  // Verificar se os primeiros documentos coincidem
  if (filteredDocRows.length > 0 && documents.length > 0) {
    const firstReturned = filteredDocRows[0];
    const firstOriginal = documents[0];
    console.log(`  Verificação de ordem:`);
    console.log(`    Primeiro documento original: ind_oper=${firstOriginal.ind_oper}, serie=${firstOriginal.serie}, num_doc=${firstOriginal.num_doc}`);
    console.log(`    Primeiro documento retornado: id=${firstReturned.id}, ind_oper=${firstReturned.ind_oper}, serie=${firstReturned.serie}, num_doc=${firstReturned.num_doc}`);
    console.log(`    Coincidem? ${firstOriginal.ind_oper === firstReturned.ind_oper && firstOriginal.serie === firstReturned.serie && firstOriginal.num_doc === firstReturned.num_doc}`);
  }

  const { data: invRows, error: invsError } = await supabaseAdmin
    .from("inventories")
    .insert(inventories)
    .select();

  if (invsError) {
    console.error("Erro ao inserir inventários:", invsError);
    return NextResponse.json(
      { error: `Erro ao inserir inventários: ${invsError.message}` },
      { status: 500 }
    );
  }

  // Mapear document_items para inserção
  console.log(`\n🔗 Mapeando ${documentItems.length} itens de documento para inserção...`);
  console.log(`  Documentos retornados do banco: ${docRows?.length || 0}`);
  
  if (docRows && docRows.length > 0) {
    console.log(`  Primeiro documento: id=${docRows[0].id}, ind_oper=${docRows[0].ind_oper}`);
    console.log(`  Último documento: id=${docRows[docRows.length - 1].id}, ind_oper=${docRows[docRows.length - 1].ind_oper}`);
  }
  
  // Verificar se há algum problema de ordem
  if (docRows && documents.length > 0 && docRows.length === documents.length) {
    // Verificar se o primeiro documento corresponde
    const firstDocInserted = documents[0];
    const firstDocReturned = docRows[0];
    if (firstDocInserted.ind_oper !== firstDocReturned.ind_oper) {
      console.warn(`⚠ Possível problema de ordem: primeiro documento inserido tem ind_oper=${firstDocInserted.ind_oper}, mas retornado tem ${firstDocReturned.ind_oper}`);
    }
  }

  const docItemsToInsert = documentItems
    .map((di, index) => {
      // IMPORTANTE: O Supabase pode retornar documentos em ordem diferente
      // Vamos usar o índice como método principal, mas verificar se o documento pertence ao arquivo correto
      
      let doc: typeof docRows[0] | undefined = undefined;
      
      // Primeiro, tentar por índice direto nos documentos filtrados (que já estão filtrados por sped_file_id)
      if (di._docIndex < filteredDocRows.length) {
        doc = filteredDocRows[di._docIndex];
        // Verificar se realmente pertence ao arquivo correto (dupla verificação)
        if (doc && doc.sped_file_id !== spedFile.id) {
          console.warn(`⚠ Documento no índice ${di._docIndex} pertence a outro arquivo!`);
          doc = undefined;
        }
      }
      
      // Se não encontrou por índice, tentar por chave única (mas apenas nos documentos filtrados)
      if (!doc && documents[di._docIndex]) {
        const docKey = `${documents[di._docIndex].serie || ""}-${documents[di._docIndex].num_doc || ""}-${documents[di._docIndex].chv_nfe || ""}`;
        if (docKey && docKey !== "--") {
          const docByKey = docMapByKey.get(docKey);
          // Verificar se pertence ao arquivo correto
          if (docByKey && docByKey.sped_file_id === spedFile.id) {
            doc = docByKey;
          }
        }
      }
      
      if (!doc?.id) {
        console.warn(`⚠ Documento não encontrado para índice ${di._docIndex} (item ${index})`);
        console.warn(`   Índice máximo disponível: ${filteredDocRows.length - 1}`);
        if (documents[di._docIndex]) {
          const docKey = `${documents[di._docIndex].serie || ""}-${documents[di._docIndex].num_doc || ""}-${documents[di._docIndex].chv_nfe || ""}`;
          console.warn(`   Chave do documento: ${docKey}`);
          console.warn(`   Chave encontrada no mapa? ${docMapByKey.has(docKey)}`);
        }
        return null;
      }
      
      // Log de verificação para os primeiros itens
      if (index < 3) {
        console.log(`  Item ${index + 1}: mapeado para document_id=${doc.id}, sped_file_id=${doc.sped_file_id}, arquivo_atual=${spedFile.id}`);
      }

      const ind_oper = (doc?.ind_oper || "").trim();
      let movement_type: "entrada" | "saida" | null = null;
      let movement_qty = di.qtd;

      if (ind_oper === "0") {
        movement_type = "entrada";
        movement_qty = Math.abs(di.qtd); // Entrada: quantidade positiva
      } else if (ind_oper === "1") {
        movement_type = "saida";
        movement_qty = -Math.abs(di.qtd); // Saída: quantidade negativa
      } else {
        console.warn(`⚠ ind_oper inválido ou nulo para documento ${doc.id}: "${ind_oper}"`);
      }
      
      // Log de validação para os primeiros itens
      if (index < 5 && movement_type) {
        console.log(`  Item ${index + 1}: cod_item=${di.cod_item}, ind_oper="${ind_oper}", movement_type="${movement_type}", movement_qty=${movement_qty}`);
      }

      return {
        document_id: doc.id,
        num_item: di.num_item,
        cod_item: di.cod_item,
        descr_compl: di.descr_compl,
        qtd: di.qtd,
        unid: di.unid,
        vl_item: di.vl_item,
        cfop: di.cfop,
        movement_type,
        movement_qty
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  console.log(`✓ ${docItemsToInsert.length} itens mapeados com sucesso (de ${documentItems.length} processados)`);
  
  // Verificar se há algum problema com os document_ids
  if (docItemsToInsert.length > 0) {
    const sampleDocIds = new Set(docItemsToInsert.slice(0, 10).map(d => d.document_id));
    const docIdsInDb = new Set(docRows?.map(d => d.id) || []);
    const matchingIds = Array.from(sampleDocIds).filter(id => docIdsInDb.has(id));
    console.log(`  Verificação: ${matchingIds.length} de ${sampleDocIds.size} document_ids de exemplo estão nos documentos inseridos`);
    if (matchingIds.length === 0) {
      console.error(`  ❌ PROBLEMA: Nenhum document_id dos itens corresponde aos documentos inseridos!`);
      console.error(`  Exemplo document_id de item: ${docItemsToInsert[0].document_id}`);
      console.error(`  Exemplo document_id de documento: ${docRows?.[0]?.id}`);
      console.error(`  Primeiro documento inserido tinha: serie=${documents[0]?.serie}, num_doc=${documents[0]?.num_doc}, chv_nfe=${documents[0]?.chv_nfe}`);
      const firstDocKey = `${documents[0]?.serie || ""}-${documents[0]?.num_doc || ""}-${documents[0]?.chv_nfe || ""}`;
      const firstDocFromMap = docMapByKey.get(firstDocKey);
      console.error(`  Documento encontrado no mapa por chave? ${firstDocFromMap ? "SIM" : "NÃO"}`);
      if (firstDocFromMap) {
        console.error(`  ID do documento no mapa: ${firstDocFromMap.id}`);
      }
    } else {
      console.log(`  ✓ Mapeamento correto! Os document_ids estão alinhados.`);
    }
  }

  if (docItemsToInsert.length) {
    console.log(`✓ Preparando ${docItemsToInsert.length} itens de documento para inserção`);
    const sample = docItemsToInsert.slice(0, 3);
    sample.forEach((item, idx) => {
      console.log(`  Item ${idx + 1}: cod_item=${item.cod_item}, movement_type=${item.movement_type}, movement_qty=${item.movement_qty}, document_id=${item.document_id}`);
    });

    // Inserir em lotes para evitar problemas com muitos registros
    const INSERT_CHUNK_SIZE = 500;
    let totalInserted = 0;
    
    for (let i = 0; i < docItemsToInsert.length; i += INSERT_CHUNK_SIZE) {
      const chunk = docItemsToInsert.slice(i, i + INSERT_CHUNK_SIZE);
      const { error: docItemsError, data: insertedData } = await supabaseAdmin
        .from("document_items")
        .insert(chunk)
        .select("id, document_id, cod_item");

      if (docItemsError) {
        console.error(`Erro ao inserir itens de documento (lote ${Math.floor(i / INSERT_CHUNK_SIZE) + 1}):`, docItemsError);
        return NextResponse.json(
          { error: `Erro ao inserir itens de documento: ${docItemsError.message}` },
          { status: 500 }
        );
      }
      
      totalInserted += chunk.length;
      console.log(`✓ Lote ${Math.floor(i / INSERT_CHUNK_SIZE) + 1}: ${chunk.length} itens inseridos`);
      
      if (insertedData && insertedData.length > 0) {
        console.log(`  Verificação: Primeiro item inserido tem document_id=${insertedData[0].document_id}`);
      }
    }
    
    console.log(`✓ Total de ${totalInserted} itens de documento inseridos com sucesso`);
    
    // Verificar se os itens foram realmente inseridos
    // Usar TODOS os document_ids que foram inseridos (não apenas um sample)
    const docIds = docRows?.map(d => d.id) || [];
    console.log(`\n🔍 Verificando inserção: buscando itens para ${docIds.length} documentos...`);
    console.log(`  Primeiro document_id: ${docIds[0]}`);
    console.log(`  Último document_id: ${docIds[docIds.length - 1]}`);
    
    if (docIds.length > 0) {
      // Dividir em lotes para evitar timeout
      const VERIFY_CHUNK_SIZE = 100;
      let totalFound = 0;
      
      for (let i = 0; i < docIds.length; i += VERIFY_CHUNK_SIZE) {
        const chunk = docIds.slice(i, i + VERIFY_CHUNK_SIZE);
        const { data, error } = await supabaseAdmin
          .from("document_items")
          .select("id, document_id, cod_item, movement_qty")
          .in("document_id", chunk);
        
        if (error) {
          console.error(`Erro ao verificar itens inseridos (lote ${Math.floor(i / VERIFY_CHUNK_SIZE) + 1}):`, error);
        } else {
          totalFound += data?.length || 0;
          console.log(`✓ Lote ${Math.floor(i / VERIFY_CHUNK_SIZE) + 1}: ${data?.length || 0} itens encontrados`);
        }
      }
      
      console.log(`✓ Verificação completa: ${totalFound} itens encontrados no banco para ${docIds.length} documentos`);
      
      // Se não encontrou nada, fazer uma busca geral para debug
      if (totalFound === 0) {
        console.warn(`⚠ Nenhum item encontrado! Fazendo busca geral para debug...`);
        const { data: allItems, error: allError } = await supabaseAdmin
          .from("document_items")
          .select("id, document_id, cod_item, movement_qty")
          .limit(5);
        
        if (allError) {
          console.error("Erro ao buscar itens gerais:", allError);
        } else {
          console.log(`  Total de document_items na tabela (sample): ${allItems?.length || 0}`);
          if (allItems && allItems.length > 0) {
            console.log(`  Exemplo document_id na tabela: ${allItems[0].document_id}`);
            console.log(`  Primeiro document_id buscado: ${docIds[0]}`);
            console.log(`  IDs coincidem? ${allItems[0].document_id === docIds[0]}`);
          }
        }
      }
    }
  } else {
    console.warn("⚠ Nenhum item de documento para inserir");
    console.warn(`  documentItems processados: ${documentItems.length}`);
    console.warn(`  docRows retornados: ${docRows?.length || 0}`);
  }

  const invItemsToInsert = inventoryItems
    .map(ii => {
      const inv = invRows?.[ii._invIndex];
      if (!inv?.id) return null;

      return {
        inventory_id: inv.id,
        cod_item: ii.cod_item,
        unid: ii.unid,
        qtd: ii.qtd,
        vl_unit: ii.vl_unit,
        vl_item: ii.vl_item
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  if (invItemsToInsert.length) {
    const { error: invItemsError } = await supabaseAdmin.from("inventory_items").insert(invItemsToInsert);
    if (invItemsError) {
      console.error("Erro ao inserir itens de inventário:", invItemsError);
      return NextResponse.json(
        { error: `Erro ao inserir itens de inventário: ${invItemsError.message}` },
        { status: 500 }
      );
    }
  }

  // Resumo para retornar na resposta
  const resumo = {
    produtos: products.length,
    conversoes: conversions.length,
    documentos: documents.length,
    documentItems: documentItems.length,
    inventarios: inventories.length,
    inventoryItems: inventoryItems.length,
  };

  console.log(`[api/sped/import] Arquivo processado: ${file.name}, produtos=${resumo.produtos}, documentos=${resumo.documentos}, itens=${resumo.documentItems}`);

  return NextResponse.json({ 
    ok: true, 
    spedFileId: spedFile.id,
    resumo 
  });
  } catch (error) {
    console.error("Erro ao importar SPED:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao processar arquivo";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

