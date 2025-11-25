import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { parseNumberBR, mapHeaderToField, normalizeCodItem } from "@/lib/utils";
import XLSX from "xlsx";
import Papa from "papaparse";

interface StockInitialRecord {
  cod_item: string;
  descr_item?: string;
  qtd: number;
  unid?: string;
  unit_cost?: number;
}

/**
 * Parser para arquivo TXT SPED (formato H010)
 */
function parseSPEDTXT(text: string): StockInitialRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const records: StockInitialRecord[] = [];

  for (const line of lines) {
    const parts = line.split("|");
    const reg = parts[1];

    // Apenas processar linhas H010
    if (reg !== "H010") continue;

    const cod_item_raw = parts[2]?.trim();
    if (!cod_item_raw) continue;

    const cod_item = normalizeCodItem(cod_item_raw); // Normalizar para 6 dígitos
    const qtd = parseNumberBR(parts[4]);
    if (qtd === null) continue;

    // SPED H010: parts[5] = vl_unit, parts[6] = vl_item
    const vl_unit = parseNumberBR(parts[5]);
    
    records.push({
      cod_item,
      unid: parts[3]?.trim() || undefined,
      qtd,
      descr_item: undefined, // SPED H010 não traz descrição
      unit_cost: vl_unit || undefined,
    });
  }

  return records;
}

/**
 * Parser para arquivo CSV
 */
function parseCSV(text: string): StockInitialRecord[] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  if (parsed.data.length === 0) return [];

  const records: StockInitialRecord[] = [];
  const headers = parsed.data[0] || [];
  
  // Mapear índices das colunas
  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const field = mapHeaderToField(header);
    if (field) {
      columnMap[field] = index;
    }
  });

  // Verificar se temos pelo menos cod_item e qtd
  if (columnMap.cod_item === undefined || columnMap.qtd === undefined) {
    throw new Error(
      "CSV deve conter colunas 'cod_item' (ou variações) e 'qtd' (ou variações)"
    );
  }

  // Processar linhas de dados (pular cabeçalho)
  for (let i = 1; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (!row || row.length === 0) continue;

    const cod_item = normalizeCodItem(row[columnMap.cod_item]);
    if (!cod_item || cod_item === "000000") continue;

    const qtd = parseNumberBR(row[columnMap.qtd]);
    if (qtd === null) continue;

    const unit_cost = columnMap.unit_cost !== undefined 
      ? parseNumberBR(row[columnMap.unit_cost])
      : undefined;
    
    records.push({
      cod_item,
      descr_item: columnMap.descr_item !== undefined 
        ? row[columnMap.descr_item]?.trim() || undefined 
        : undefined,
      qtd,
      unid: columnMap.unid !== undefined 
        ? row[columnMap.unid]?.trim() || undefined 
        : undefined,
      unit_cost: unit_cost || undefined,
    });
  }

  return records;
}

/**
 * Parser para arquivo XLSX
 */
function parseXLSX(buffer: ArrayBuffer): StockInitialRecord[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  if (!worksheet) {
    throw new Error("Planilha vazia ou inválida");
  }

  const data = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    defval: "",
  });

  if (data.length === 0) return [];

  const records: StockInitialRecord[] = [];
  const headers = (data[0] || []) as string[];
  
  // Mapear índices das colunas
  const columnMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    const field = mapHeaderToField(String(header));
    if (field) {
      columnMap[field] = index;
    }
  });

  // Verificar se temos pelo menos cod_item e qtd
  if (columnMap.cod_item === undefined || columnMap.qtd === undefined) {
    throw new Error(
      "Planilha deve conter colunas 'cod_item' (ou variações) e 'qtd' (ou variações)"
    );
  }

  // Processar linhas de dados (pular cabeçalho)
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as string[];
    if (!row || row.length === 0) continue;

    const cod_item = normalizeCodItem(String(row[columnMap.cod_item] || ""));
    if (!cod_item || cod_item === "000000") continue;

    const qtd = parseNumberBR(String(row[columnMap.qtd] || ""));
    if (qtd === null) continue;

    const unit_cost = columnMap.unit_cost !== undefined 
      ? parseNumberBR(String(row[columnMap.unit_cost] || ""))
      : undefined;
    
    records.push({
      cod_item,
      descr_item: columnMap.descr_item !== undefined 
        ? String(row[columnMap.descr_item] || "").trim() || undefined 
        : undefined,
      qtd,
      unid: columnMap.unid !== undefined 
        ? String(row[columnMap.unid] || "").trim() || undefined 
        : undefined,
      unit_cost: unit_cost || undefined,
    });
  }

  return records;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const label =
      (formData.get("label") as string | null)?.trim() ||
      file.name ||
      `Importação ${new Date().toLocaleDateString("pt-BR")}`;
    let records: StockInitialRecord[] = [];

    // Detectar tipo de arquivo e processar
    if (fileName.endsWith(".txt")) {
      // Arquivo TXT SPED
      const text = await file.text();
      records = parseSPEDTXT(text);
    } else if (fileName.endsWith(".csv")) {
      // Arquivo CSV
      const text = await file.text();
      records = parseCSV(text);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      // Arquivo Excel
      const buffer = await file.arrayBuffer();
      records = parseXLSX(buffer);
    } else {
      return NextResponse.json(
        { error: "Formato de arquivo não suportado. Use .txt, .csv ou .xlsx" },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: "Nenhum registro válido encontrado no arquivo" },
        { status: 400 }
      );
    }

    const totalValue = records.reduce((acc, record) => {
      const unit = record.unit_cost ?? 0;
      return acc + unit * record.qtd;
    }, 0);

    // Buscar período ativo
    const { data: activePeriod } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("is_active", true)
      .single();

    const { data: importBatch, error: importError } = await supabaseAdmin
      .from("stock_initial_imports")
      .insert({
        label,
        total_items: records.length,
        total_value: totalValue,
        period_id: activePeriod?.id || null,
      })
      .select("id")
      .single();

    if (importError || !importBatch) {
      console.error("Erro ao criar registro de importação:", importError);
      return NextResponse.json(
        { error: "Erro ao registrar importação do estoque inicial" },
        { status: 500 }
      );
    }

    // Inserir registros normalizados (acumular histórico)
    const { error: insertError } = await supabaseAdmin
      .from("stock_initial")
      .insert(
        records.map((record) => ({
          ...record,
          import_id: importBatch.id,
        }))
      );

    if (insertError) {
      console.error("Erro ao inserir estoque inicial:", insertError);
      return NextResponse.json(
        { error: `Erro ao inserir estoque inicial: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: records.length,
      importId: importBatch.id,
      label,
    });
  } catch (error) {
    console.error("Erro ao importar estoque inicial:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido ao processar arquivo";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

