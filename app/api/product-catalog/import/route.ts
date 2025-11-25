import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { parseNumberBR, mapHeaderToField, normalizeCodItem } from "@/lib/utils";
import * as XLSX from "xlsx";
import Papa from "papaparse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProductRecord {
  cod_item: string;
  descr_item: string;
  unid?: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado" },
        { status: 400 }
      );
    }

    let records: ProductRecord[] = [];

    // Detectar tipo de arquivo
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split(".").pop();

    if (fileExtension === "txt") {
      // Formato TXT (SPED ou similar)
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

      for (const line of lines) {
        const parts = line.split("|");
        if (parts.length < 3) continue;

        // Tentar detectar formato SPED 0200
        if (parts[1] === "0200") {
          const codItem = normalizeCodItem(parts[2]?.trim() || "");
          const descrItem = parts[3]?.trim() || "";
          const unid = parts[4]?.trim() || "";

          if (codItem && descrItem) {
            records.push({
              cod_item: codItem,
              descr_item: descrItem,
              unid: unid || undefined,
            });
          }
        } else {
          // Formato simples: codigo|descricao|unidade
          const codItem = normalizeCodItem(parts[0]?.trim() || "");
          const descrItem = parts[1]?.trim() || "";
          const unid = parts[2]?.trim() || "";

          if (codItem && descrItem) {
            records.push({
              cod_item: codItem,
              descr_item: descrItem,
              unid: unid || undefined,
            });
          }
        }
      }
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      // Formato Excel
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (jsonData.length < 2) {
        return NextResponse.json(
          { error: "Planilha vazia ou sem cabeçalho" },
          { status: 400 }
        );
      }

      const headers = (jsonData[0] as any[]).map((h: any) =>
        String(h).toLowerCase().trim()
      );
      const codItemIndex = headers.findIndex((h) =>
        ["cod_item", "codigo", "código", "codproduto", "cod_produto"].some(
          (v) => h.includes(v)
        )
      );
      const descrIndex = headers.findIndex((h) =>
        [
          "descr_item",
          "descricao",
          "descrição",
          "descricao_item",
          "descricao_produto",
          "produto",
        ].some((v) => h.includes(v))
      );
      const unidIndex = headers.findIndex((h) =>
        ["unid", "unidade", "unidade_medida", "um"].some((v) => h.includes(v))
      );

      if (codItemIndex === -1 || descrIndex === -1) {
        return NextResponse.json(
          { error: "Colunas obrigatórias não encontradas: código e descrição" },
          { status: 400 }
        );
      }

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        const codItem = normalizeCodItem(String(row[codItemIndex] || "").trim());
        const descrItem = String(row[descrIndex] || "").trim();
        const unid =
          unidIndex >= 0 ? String(row[unidIndex] || "").trim() : "";

        if (codItem && descrItem) {
          records.push({
            cod_item: codItem,
            descr_item: descrItem,
            unid: unid || undefined,
          });
        }
      }
    } else if (fileExtension === "csv") {
      // Formato CSV
      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        delimiter: ";",
      });

      if (!parsed.data || parsed.data.length === 0) {
        return NextResponse.json(
          { error: "Arquivo CSV vazio ou inválido" },
          { status: 400 }
        );
      }

      const headers = Object.keys(parsed.data[0] as any).map((h) =>
        h.toLowerCase().trim()
      );
      const codItemField = headers.find((h) =>
        ["cod_item", "codigo", "código", "codproduto", "cod_produto"].some(
          (v) => h.includes(v)
        )
      );
      const descrField = headers.find((h) =>
        [
          "descr_item",
          "descricao",
          "descrição",
          "descricao_item",
          "descricao_produto",
          "produto",
        ].some((v) => h.includes(v))
      );
      const unidField = headers.find((h) =>
        ["unid", "unidade", "unidade_medida", "um"].some((v) => h.includes(v))
      );

      if (!codItemField || !descrField) {
        return NextResponse.json(
          { error: "Colunas obrigatórias não encontradas: código e descrição" },
          { status: 400 }
        );
      }

      for (const row of parsed.data as any[]) {
        const codItem = normalizeCodItem(String(row[codItemField] || "").trim());
        const descrItem = String(row[descrField] || "").trim();
        const unid = unidField ? String(row[unidField] || "").trim() : "";

        if (codItem && descrItem) {
          records.push({
            cod_item: codItem,
            descr_item: descrItem,
            unid: unid || undefined,
          });
      }
      }
    } else {
      return NextResponse.json(
        { error: "Formato de arquivo não suportado. Use: TXT, XLSX ou CSV" },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: "Nenhum registro válido encontrado no arquivo" },
        { status: 400 }
      );
    }

    // Remover duplicatas (manter o último)
    const uniqueRecords = new Map<string, ProductRecord>();
    records.forEach((rec) => {
      uniqueRecords.set(rec.cod_item, rec);
    });

    const finalRecords = Array.from(uniqueRecords.values());

    // Fazer upsert no banco (atualiza se existir, insere se não existir)
    const { error: insertError } = await supabaseAdmin
      .from("product_catalog")
      .upsert(
        finalRecords.map((rec) => ({
          cod_item: rec.cod_item,
          descr_item: rec.descr_item,
          unid: rec.unid || null,
        })),
        {
          onConflict: "cod_item",
          ignoreDuplicates: false,
        }
      );

    if (insertError) {
      console.error("Erro ao inserir cadastro:", insertError);
      return NextResponse.json(
        { error: `Erro ao salvar cadastro: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      total_registros: finalRecords.length,
      mensagem: `Cadastro importado com sucesso! ${finalRecords.length} produtos cadastrados/atualizados.`,
    });
  } catch (error) {
    console.error("Erro ao importar cadastro:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

