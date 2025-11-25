import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import * as JSZipLib from "jszip";
import { normalizeCodItem } from "@/lib/utils";
const JSZip = JSZipLib.default || JSZipLib;

// CRÍTICO: Garantir runtime Node.js (não Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos

interface NFItem {
  document_id: string;
  cod_item: string;
  descr_compl?: string;
  qtd: number;
  unid?: string;
  vl_item: number;
  cfop?: string;
  movement_type: "saida";
  movement_qty: number;
  xml_import_id?: string;
}

interface Pendencia {
  chNFe?: string | null;
  serie?: string | null;
  numero?: string | null;
  motivo: string;
}

interface DocumentRecord {
  id: string;
  ind_oper?: string | null;
  chv_nfe?: string | null;
  serie?: string | null;
  num_doc?: string | null;
}

function normalizeDocValue(value?: string | number | null): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const stripped = str.replace(/^0+/, "");
  if (stripped.length === 0) {
    return "0";
  }
  return stripped;
}

function makeDocKey(
  serie?: string | number | null,
  numero?: string | number | null
): string | null {
  const numeroNorm = normalizeDocValue(numero);
  if (!numeroNorm) return null;
  const serieNorm = normalizeDocValue(serie) ?? "0";
  return `${serieNorm}|${numeroNorm}`;
}

function parseNumberBR(value?: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  
  // Se já é um número, retornar direto
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  // Se é string, fazer o parse
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(cleanedValue);
    return isNaN(num) ? null : num;
  }
  
  // Para outros tipos, tentar converter para string primeiro
  try {
    const strValue = String(value);
    const cleanedValue = strValue.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(cleanedValue);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

/**
 * Extrai itens de um XML de NF-e
 */
function extractItemsFromXML(xmlContent: string): {
  chNFe: string | null;
  serie?: string | null;
  numero?: string | null;
  items: Array<{
    cod_item: string;
    descr_compl?: string;
    qtd: number;
    unid?: string;
    vl_item: number;
    cfop?: string;
  }>;
} | null {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      parseAttributeValue: true,
      trimValues: true,
    });

    const json = parser.parse(xmlContent);

    let infNFe: any = null;
    
    if (json.nfeProc?.NFe?.infNFe) {
      infNFe = json.nfeProc.NFe.infNFe;
    } else if (json.NFe?.infNFe) {
      infNFe = json.NFe.infNFe;
    } else if (json.infNFe) {
      infNFe = json.infNFe;
    } else if (json.NFe) {
      infNFe = json.NFe;
    }

    if (!infNFe) {
      return null;
    }
    
    const ideNode =
      infNFe?.ide ||
      json.nfeProc?.NFe?.infNFe?.ide ||
      json.NFe?.infNFe?.ide ||
      null;
    const xmlSerie = ideNode?.serie ?? ideNode?.SERIE ?? null;
    const xmlNumero = ideNode?.nNF ?? ideNode?.NNF ?? ideNode?.nDoc ?? null;

    // Extrair chave de acesso com múltiplos fallbacks
    let chNFe: string | null = null;
    
    // Tentativa 1: protNFe.infProt.chNFe (mais comum em NF-e autorizada)
    if (json.nfeProc?.protNFe?.infProt?.chNFe) {
      chNFe = String(json.nfeProc.protNFe.infProt.chNFe).trim();
    }
    
    // Tentativa 2: Atributo Id em infNFe (ex: Id="NFe351909000000...")
    if (!chNFe) {
      const idAttr = infNFe["@_Id"] || infNFe["@_id"] || infNFe["@_ID"];
      if (idAttr) {
        const idStr = String(idAttr).trim();
        // Remover prefixo "NFe" se existir
        if (idStr.startsWith("NFe") || idStr.startsWith("nfe")) {
          chNFe = idStr.replace(/^NFe/i, "").trim();
        } else if (idStr.length === 44) {
          chNFe = idStr;
        }
      }
    }
    
    // Tentativa 3: Buscar em outras estruturas possíveis
    if (!chNFe) {
      if (json.nfeProc?.NFe?.infNFe?.ide?.chNFE) {
        chNFe = String(json.nfeProc.NFe.infNFe.ide.chNFE).trim();
      }
    }

    // Tentativa 4: Buscar chave diretamente no XML como texto
    if (!chNFe) {
      const chaveMatch = xmlContent.match(/<chNFe[^>]*>(\d{44})<\/chNFe>/i);
      if (chaveMatch) {
        chNFe = chaveMatch[1];
      } else {
        const idMatch = xmlContent.match(/Id=["']NFe(\d{44})["']/i);
        if (idMatch) {
          chNFe = idMatch[1];
        }
      }
    }

    // Tentativa 5: Buscar chave de 44 dígitos em qualquer lugar do JSON (último recurso)
    if (!chNFe || chNFe.length !== 44) {
      const jsonStr = JSON.stringify(json);
      const chaveMatch = jsonStr.match(/(\d{44})/);
      if (chaveMatch && chaveMatch[1]) {
        const chaveEncontrada = chaveMatch[1].trim();
        if (chaveEncontrada.length === 44) {
          chNFe = chaveEncontrada;
        }
      }
    }

    // Validar e normalizar chave encontrada
    if (!chNFe) {
      return null;
    }
    
    // Normalizar chave: remover espaços e garantir 44 dígitos
    chNFe = String(chNFe).trim().replace(/\s+/g, "");
    
    if (chNFe.length !== 44) {
      return null;
    }

    // Buscar itens (det) de forma genérica - suporta modelo 55 e 65
    let det: any[] = [];
    
    if (infNFe?.det) {
      det = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];
    } else if (infNFe?.dados?.det) {
      det = Array.isArray(infNFe.dados.det) ? infNFe.dados.det : [infNFe.dados.det];
    } else {
      // Buscar recursivamente por "det" no objeto infNFe
      const findDet = (obj: any, depth: number = 0): any[] => {
        if (depth > 10) return [];
        if (!obj || typeof obj !== "object") return [];
        
        if (obj.det) {
          return Array.isArray(obj.det) ? obj.det : [obj.det];
        }
        
        for (const key in obj) {
          if (obj[key] && typeof obj[key] === "object") {
            const found = findDet(obj[key], depth + 1);
            if (found.length > 0) return found;
          }
        }
        
        return [];
      };
      
      det = findDet(infNFe);
    }

    // Extrair itens de forma genérica (suporta modelo 55 e 65)
    const extractedItems = det
      .filter((item: any) => item && item.prod)
      .map((item: any) => {
        const prod = item.prod || {};
        
        const cod_item_raw = prod.cProd || 
                        prod["@_cProd"] || 
                        prod.cProduto ||
                        prod.codigo || 
                        prod.codigoProduto ||
                        prod.cEAN ||
                        null;
        
        if (!cod_item_raw) {
          return null;
        }
        
        // Normalizar cod_item para 6 dígitos (com zeros à esquerda)
        const cod_item = normalizeCodItem(cod_item_raw);

        const qtd = parseNumberBR(
          prod.qCom || 
          prod["@_qCom"] || 
          prod.qComercial ||
          prod.quantidade || 
          prod.quantidadeComercial ||
          prod.qtd ||
          prod.qtde
        ) ?? 0;

        const vl_item = parseNumberBR(
          prod.vProd || 
          prod["@_vProd"] || 
          prod.vProduto ||
          prod.valor || 
          prod.valorProduto ||
          prod.vlTotal ||
          prod.vl_item
        ) ?? 0;

        const unid = prod.uCom || 
                     prod["@_uCom"] || 
                     prod.uComercial ||
                     prod.unidade || 
                     prod.unidadeComercial || 
                     prod.unid ||
                     undefined;

        const descr_compl = prod.xProd || 
                           prod["@_xProd"] || 
                           prod.xProduto ||
                           prod.descricao || 
                           prod.descricaoProduto ||
                           prod.desc ||
                           undefined;

        const cfop = prod.CFOP || 
                     prod["@_CFOP"] || 
                     prod.cfop ||
                     undefined;

        return {
          cod_item, // Já normalizado para 6 dígitos acima
          descr_compl: descr_compl ? String(descr_compl).trim() : undefined,
          qtd,
          unid: unid ? String(unid).trim() : undefined,
          vl_item,
          cfop: cfop ? String(cfop).trim() : undefined,
        };
      })
      .filter((item: any): item is NonNullable<typeof item> => item !== null && item.qtd > 0);

    return {
      chNFe,
      serie: xmlSerie ? String(xmlSerie).trim() : null,
      numero: xmlNumero ? String(xmlNumero).trim() : null,
      items: extractedItems,
    };
  } catch (error) {
    // Tentar extrair a chave mesmo em caso de erro parcial
    try {
      const chaveMatch = xmlContent.match(/(\d{44})/);
      if (chaveMatch && chaveMatch[1] && chaveMatch[1].length === 44) {
        return {
          chNFe: chaveMatch[1],
          serie: null,
          numero: null,
          items: [],
        };
      }
    } catch {
      // Ignorar erro no fallback
    }
    return null;
  }
}

// Função para processar XMLs (pode ser usada em background ou sincronamente)
async function processXMLsInBackground(
  supabaseAdmin: any,
  fileId: string,
  files: File[],
  importLabel?: string
): Promise<{
  totalXMLs: number;
  totalXMLsProcessados: number;
  totalItensInseridos: number;
  pendencias: Pendencia[];
  importId?: string;
}> {
  const pendencias: Pendencia[] = [];
  let totalXMLs = 0;
  let totalXMLsProcessados = 0;
  let totalItensInseridos = 0;
  
  // Buscar período ativo
  const { data: activePeriod } = await supabaseAdmin
    .from("periods")
    .select("id")
    .eq("is_active", true)
    .single();

  // Criar registro de importação
  const { data: importRecord, error: importError } = await supabaseAdmin
    .from("xml_sales_imports")
    .insert({
      sped_file_id: fileId,
      label: importLabel || `Importação - ${new Date().toLocaleString("pt-BR")}`,
      total_xmls: 0,
      total_items: 0,
      period_id: activePeriod?.id || null,
    })
    .select()
    .single();

  if (importError || !importRecord) {
    throw new Error(`Erro ao criar registro de importação: ${importError?.message}`);
  }

  const xmlImportId = importRecord.id;
  
  // Criar um documento sintético para esta importação de XMLs
  // Isso permite manter a integridade referencial sem precisar vincular ao SPED
  const { data: syntheticDoc, error: docError } = await supabaseAdmin
    .from("documents")
    .insert({
      sped_file_id: fileId,
      ind_oper: "1", // Marcado como saída
      cod_mod: "XML", // Identificador de que é documento sintético de XML
      serie: "XML",
      num_doc: `XML-IMPORT-${xmlImportId.substring(0, 8)}`,
      chv_nfe: null, // Não tem chave pois não vem do SPED
      dt_doc: new Date().toISOString().split("T")[0],
      dt_e_s: new Date().toISOString().split("T")[0],
      vl_doc: 0, // Será calculado depois
    })
    .select()
    .single();

  if (docError || !syntheticDoc) {
    throw new Error(`Erro ao criar documento sintético: ${docError?.message}`);
  }

  const syntheticDocumentId = syntheticDoc.id;
  
  console.log(`[api/sped/import-xml-sales] Documento sintético criado: ${syntheticDocumentId} para importação ${xmlImportId}`);

  // Aumentar tamanho dos lotes para processar mais rápido
  const XML_BATCH_SIZE = 200; // Processar 200 XMLs por vez (antes era 100)
  const INSERT_CHUNK_SIZE = 1000; // Inserir 1000 itens por vez (antes era 500)
  const allItems: NFItem[] = [];

  console.log(`[api/sped/import-xml-sales] Iniciando processamento de ${files.length} arquivo(s) em background`);

  // Processar cada arquivo
  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.log(`[api/sped/import-xml-sales] Arquivo ${fileIdx + 1}/${files.length}: ${file.name} (${fileSizeMB} MB)`);
    
    try {
      // Ler arquivo
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = file.name.toLowerCase();
      let xmlContents: string[] = [];

      if (fileName.endsWith(".zip")) {
        console.log(`[api/sped/import-xml-sales] Extraindo ZIP: ${file.name}`);
        const zip = await JSZip.loadAsync(buffer);
        const xmlFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith(".xml"));
        console.log(`[api/sped/import-xml-sales] Encontrados ${xmlFiles.length} XMLs no ZIP`);

        for (const xmlFileName of xmlFiles) {
          const xmlFile = zip.files[xmlFileName];
          if (xmlFile && !xmlFile.dir) {
            try {
              const content = await xmlFile.async("string");
              xmlContents.push(content);
            } catch (err) {
              console.error(`[api/sped/import-xml-sales] Erro ao extrair ${xmlFileName}:`, err);
            }
          }
        }
      } else if (fileName.endsWith(".xml")) {
        const content = buffer.toString("utf-8");
        xmlContents.push(content);
      } else {
        console.warn(`[api/sped/import-xml-sales] Arquivo ignorado: ${file.name}`);
        continue;
      }

      // Processar XMLs em lotes
      for (let batchStart = 0; batchStart < xmlContents.length; batchStart += XML_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + XML_BATCH_SIZE, xmlContents.length);
        const batch = xmlContents.slice(batchStart, batchEnd);
        const batchItems: NFItem[] = [];
        
        const batchNum = Math.floor(batchStart / XML_BATCH_SIZE) + 1;
        if (xmlContents.length > XML_BATCH_SIZE) {
          console.log(`[api/sped/import-xml-sales] Lote ${batchNum}: XMLs ${batchStart + 1}-${batchEnd} de ${xmlContents.length}`);
        }
        
        // Extrair dados dos XMLs
        const extractedData: Array<{
          chNFe: string | null;
          serie?: string | null;
          numero?: string | null;
          items: any[];
        }> = [];
        
        for (let xmlIdx = 0; xmlIdx < batch.length; xmlIdx++) {
          const xmlContent = batch[xmlIdx];
          totalXMLs++;
          
          try {
            const extracted = extractItemsFromXML(xmlContent);
            
            if (!extracted) {
              pendencias.push({
                chNFe: null,
                motivo: "Erro ao parsear XML ou chave de acesso não encontrada",
              });
              continue;
            }
            
            if (extracted.items.length === 0) {
              // Ainda tentar processar a chave (pode ter documento mas sem itens)
            }
            
            extractedData.push(extracted);
          } catch (xmlError) {
            pendencias.push({
              chNFe: null,
              motivo: `Erro ao processar XML: ${xmlError instanceof Error ? xmlError.message : "Erro desconhecido"}`,
            });
          }
        }
        
        // Processar itens dos XMLs
        // Nova abordagem: não vinculamos ao SPED, apenas extraímos os dados dos XMLs
        for (const extracted of extractedData) {
          const { items } = extracted;
          
          // Verificar se há itens válidos
          if (!items || items.length === 0) {
            pendencias.push({
              chNFe: extracted.chNFe ?? null,
              motivo: "XML sem itens (det) válidos para inserir",
            });
            continue;
          }
          
          // Criar itens de documento usando o documento sintético
          // TODOS os itens de TODOS os XMLs desta importação usam o mesmo document_id sintético
          for (const item of items) {
            batchItems.push({
              document_id: syntheticDocumentId, // Documento sintético criado para esta importação
              cod_item: item.cod_item,
              descr_compl: item.descr_compl,
              qtd: item.qtd,
              unid: item.unid,
              vl_item: item.vl_item,
              cfop: item.cfop,
              movement_type: "saida",
              movement_qty: -Math.abs(item.qtd),
              xml_import_id: xmlImportId, // Vincular à importação
            });
          }
          
          totalXMLsProcessados++;
          if (totalXMLsProcessados % 50 === 0) {
            console.log(`[api/sped/import-xml-sales] Processados ${totalXMLsProcessados} XMLs com sucesso (sem vinculação ao SPED)`);
          }
        }
        
        // Adicionar itens do lote ao array principal
        allItems.push(...batchItems);
      }
    } catch (fileError) {
      console.error(`[api/sped/import-xml-sales] Erro ao processar arquivo ${file.name}:`, fileError);
      pendencias.push({
        chNFe: null,
        motivo: `Erro ao processar arquivo: ${fileError instanceof Error ? fileError.message : "Erro desconhecido"}`,
      });
      continue;
    }
  }

  // Inserir todos os itens no banco em lotes
  if (allItems.length > 0) {
    console.log(`[api/sped/import-xml-sales] Inserindo ${allItems.length} itens no banco em lotes de ${INSERT_CHUNK_SIZE}...`);
    
    for (let i = 0; i < allItems.length; i += INSERT_CHUNK_SIZE) {
      const chunk = allItems.slice(i, i + INSERT_CHUNK_SIZE);
      const { error: insertError } = await supabaseAdmin
        .from("document_items")
        .insert(chunk);
      
      if (insertError) {
        console.error(`[api/sped/import-xml-sales] Erro ao inserir itens (lote ${Math.floor(i / INSERT_CHUNK_SIZE) + 1}):`, insertError);
        throw new Error(`Erro ao inserir itens: ${insertError.message}`);
      }
      
      totalItensInseridos += chunk.length;
    }
  }

  // Calcular valor total dos itens inseridos
  const valorTotal = allItems.reduce((acc, item) => acc + (item.vl_item ?? 0), 0);

  // Atualizar documento sintético com o valor total
  const { error: docUpdateError } = await supabaseAdmin
    .from("documents")
    .update({
      vl_doc: valorTotal,
    })
    .eq("id", syntheticDocumentId);

  if (docUpdateError) {
    console.error(`[api/sped/import-xml-sales] Erro ao atualizar documento sintético:`, docUpdateError);
  }

  // Atualizar registro de importação com os totais
  const { error: updateError } = await supabaseAdmin
    .from("xml_sales_imports")
    .update({
      total_xmls: totalXMLs,
      total_items: totalItensInseridos,
    })
    .eq("id", xmlImportId);

  if (updateError) {
    console.error(`[api/sped/import-xml-sales] Erro ao atualizar registro de importação:`, updateError);
  }

  console.log(`[api/sped/import-xml-sales] ✓ Importação concluída (nova abordagem - sem vinculação ao SPED)`);
  console.log(`[api/sped/import-xml-sales]   Total XMLs: ${totalXMLs}`);
  console.log(`[api/sped/import-xml-sales]   XMLs processados: ${totalXMLsProcessados}`);
  console.log(`[api/sped/import-xml-sales]   Itens inseridos: ${totalItensInseridos}`);
  console.log(`[api/sped/import-xml-sales]   Valor total: R$ ${valorTotal.toFixed(2)}`);
  console.log(`[api/sped/import-xml-sales]   Pendências: ${pendencias.length}`);
  console.log(`[api/sped/import-xml-sales]   Documento sintético ID: ${syntheticDocumentId}`);
  console.log(`[api/sped/import-xml-sales]   Import ID: ${xmlImportId}`);

  return {
    totalXMLs,
    totalXMLsProcessados,
    totalItensInseridos,
    pendencias,
    importId: xmlImportId,
  };
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    const fileSizeMB = contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : "?";
    
    // Ler formData
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formDataError) {
      // Se o erro for de conexão abortada, não logar como erro crítico
      if (formDataError instanceof Error) {
        if (formDataError.message === "aborted" || (formDataError as any).code === "ECONNRESET") {
          console.log("[api/sped/import-xml-sales] Conexão abortada durante leitura do formData (esperado em alguns casos)");
          return NextResponse.json({
            ok: false,
            error: "Conexão abortada durante upload. O cliente tentará novamente automaticamente.",
          }, { status: 400 });
        }
        
        if (formDataError.message.includes("Failed to parse body as FormData") || 
            formDataError.message.includes("boundary") || 
            formDataError.message.includes("FormData")) {
          console.error("[api/sped/import-xml-sales] Erro ao processar formData:", formDataError.message);
          return NextResponse.json({
            ok: false,
            error: "Erro ao processar formData. O cliente tentará novamente automaticamente.",
            detail: formDataError.message
          }, { status: 400 });
        }
      }
      
      console.error("[api/sped/import-xml-sales] Erro inesperado ao ler formData:", formDataError);
      throw formDataError;
    }
    
    const { getSupabaseAdmin } = await import("@/lib/supabaseServer");
    const supabaseAdmin = getSupabaseAdmin();

    const fileId = formData.get("fileId") as string | null;
    const files = formData.getAll("files") as File[];
    const label = formData.get("label") as string | null;

    if (!fileId) {
      return NextResponse.json({ error: "fileId é obrigatório" }, { status: 400 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    console.log(`[api/sped/import-xml-sales] Lote recebido: ${files.length} arquivo(s) (tamanho: ${fileSizeMB} MB)`);

    // Verificar se o sped_file existe
    const { data: spedFile, error: spedFileError } = await supabaseAdmin
      .from("sped_files")
      .select("id, name")
      .eq("id", fileId)
      .single();

    if (spedFileError || !spedFile) {
      return NextResponse.json(
        { error: `Arquivo SPED não encontrado: ${fileId}` },
        { status: 404 }
      );
    }

    // Processar os arquivos sincronamente (já que são lotes pequenos)
    // Usar a função de processamento em background, mas aguardar o resultado
    const result = await processXMLsInBackground(supabaseAdmin, fileId, files, label || undefined);

    // Retornar resultados
    return NextResponse.json({
      ok: true,
      totalXmls: result.totalXMLs,
      xmlsProcessados: result.totalXMLsProcessados,
      itensInseridos: result.totalItensInseridos,
      pendencias: result.pendencias,
    });
  } catch (e) {
    console.error("[api/sped/import-xml-sales] Erro inesperado:", e);
    return NextResponse.json(
      { error: "Erro ao importar XMLs", detail: String(e) },
      { status: 500 }
    );
  }
}
