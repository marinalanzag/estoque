import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeCodItem } from "@/lib/utils";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType } from "docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function generateWordFile(
  adjustments: any[],
  spedFileId: string,
  periodId?: string | null
) {
  const supabaseAdmin = getSupabaseAdmin();

  // Buscar período ativo ou usar period_id fornecido
  let activePeriod: { id: string; name: string } | null = null;
  
  if (periodId) {
    const { data: periodData } = await supabaseAdmin
      .from("periods")
      .select("id, name")
      .eq("id", periodId)
      .single();
    activePeriod = periodData || null;
  } else {
    const { data: periodData } = await supabaseAdmin
      .from("periods")
      .select("id, name")
      .eq("is_active", true)
      .single();
    activePeriod = periodData || null;
  }

  if (!adjustments || adjustments.length === 0) {
    throw new Error("Nenhum ajuste encontrado para exportar");
  }

  // Buscar todos os códigos únicos (positivos e negativos)
  const codigosUnicos = new Set<string>();
  adjustments.forEach((adj) => {
    codigosUnicos.add(normalizeCodItem(adj.cod_negativo));
    codigosUnicos.add(normalizeCodItem(adj.cod_positivo));
  });

  // Buscar descrições dos produtos do SPED
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("cod_item, descr_item")
    .eq("sped_file_id", spedFileId);

  const productMap = new Map<string, string>();
  products?.forEach((prod) => {
    const codItem = normalizeCodItem(prod.cod_item);
    if (codigosUnicos.has(codItem)) {
      productMap.set(codItem, prod.descr_item || "[Sem descrição]");
    }
  });

  // Buscar descrições do catálogo de produtos (fallback)
  const codigosSemDescricao = Array.from(codigosUnicos).filter(
    (cod) => !productMap.has(cod)
  );

  if (codigosSemDescricao.length > 0) {
    const { data: catalogProducts } = await supabaseAdmin
      .from("product_catalog")
      .select("cod_item, descr_item")
      .in("cod_item", codigosSemDescricao);

    catalogProducts?.forEach((prod) => {
      const codItem = normalizeCodItem(prod.cod_item);
      if (!productMap.has(codItem)) {
        productMap.set(codItem, prod.descr_item || "[Sem descrição]");
      }
    });
  }

  // Preparar dados para a tabela
  const periodoNome = activePeriod?.name || "Período não especificado";
  
  // Cabeçalho da tabela
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ text: "CÓDIGO EQUIVOCADO", alignment: AlignmentType.CENTER })],
        width: { size: 15, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "CÓDIGO ADEQUADO", alignment: AlignmentType.CENTER })],
        width: { size: 15, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "DESCRIÇÃO DO CÓDIGO AJUSTADO", alignment: AlignmentType.CENTER })],
        width: { size: 25, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "DESCRIÇÃO ITEM INADEQUADO", alignment: AlignmentType.CENTER })],
        width: { size: 25, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "QUANTIDADE BAIXADA", alignment: AlignmentType.CENTER })],
        width: { size: 10, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "CUSTO UNITÁRIO", alignment: AlignmentType.CENTER })],
        width: { size: 10, type: WidthType.PERCENTAGE },
      }),
      new TableCell({
        children: [new Paragraph({ text: "IMPACTO FINANCEIRO", alignment: AlignmentType.CENTER })],
        width: { size: 10, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  // Linhas de dados
  const dataRows = adjustments.map((adj) => {
    const codNegativo = normalizeCodItem(adj.cod_negativo);
    const codPositivo = normalizeCodItem(adj.cod_positivo);
    const qtdBaixada = Number(adj.qtd_baixada);
    const custoUnitario = Number(adj.unit_cost);
    const impactoFinanceiro = qtdBaixada * custoUnitario;

    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: codNegativo })],
        }),
        new TableCell({
          children: [new Paragraph({ text: codPositivo })],
        }),
        new TableCell({
          children: [new Paragraph({ text: productMap.get(codPositivo) || "[Sem descrição]" })],
        }),
        new TableCell({
          children: [new Paragraph({ text: productMap.get(codNegativo) || "[Sem descrição]" })],
        }),
        new TableCell({
          children: [new Paragraph({ text: qtdBaixada.toFixed(2) })],
        }),
        new TableCell({
          children: [new Paragraph({ text: `R$ ${custoUnitario.toFixed(2)}` })],
        }),
        new TableCell({
          children: [new Paragraph({ text: `R$ ${impactoFinanceiro.toFixed(2)}` })],
        }),
      ],
    });
  });

  // Criar tabela
  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  // Criar documento
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: `CORREÇÕES REALIZADAS NO PERÍODO DE ${periodoNome}`,
            heading: "Heading1",
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: "",
            spacing: { after: 200 },
          }),
          table,
        ],
      },
    ],
  });

  // Gerar buffer
  const buffer = await Packer.toBuffer(doc);

  // Nome do arquivo
  const periodoNomeSanitizado = periodoNome.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `correcoes_periodo_${periodoNomeSanitizado}.docx`;

  return {
    buffer,
    fileName,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { adjustments, spedFileId, periodId } = body;

    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
      return NextResponse.json(
        { error: "Lista de ajustes é obrigatória e não pode estar vazia" },
        { status: 400 }
      );
    }

    if (!spedFileId) {
      return NextResponse.json(
        { error: "sped_file_id é obrigatório" },
        { status: 400 }
      );
    }

    const { buffer, fileName } = await generateWordFile(adjustments, spedFileId, periodId);

    // Converter Buffer para Uint8Array para compatibilidade com NextResponse
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao exportar ajustes em Word:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const spedFileId = searchParams.get("sped_file_id");
    const periodId = searchParams.get("period_id");

    if (!spedFileId) {
      return NextResponse.json(
        { error: "sped_file_id é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar período ativo ou usar period_id da query string
    let activePeriod: { id: string; name: string } | null = null;
    
    if (periodId) {
      const { data: periodData } = await supabaseAdmin
        .from("periods")
        .select("id, name")
        .eq("id", periodId)
        .single();
      activePeriod = periodData || null;
    } else {
      const { data: periodData } = await supabaseAdmin
        .from("periods")
        .select("id, name")
        .eq("is_active", true)
        .single();
      activePeriod = periodData || null;
    }

    // Buscar ajustes (do arquivo SPED e do período ativo se existir)
    let adjustmentsQuery = supabaseAdmin
      .from("code_offset_adjustments")
      .select("id, cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value, created_at, period_id")
      .eq("sped_file_id", spedFileId);

    if (activePeriod) {
      adjustmentsQuery = adjustmentsQuery.or(`period_id.eq.${activePeriod.id},period_id.is.null`);
    }

    adjustmentsQuery = adjustmentsQuery.order("created_at", { ascending: false });

    const { data: adjustments, error: adjError } = await adjustmentsQuery;

    if (adjError) {
      throw new Error(`Erro ao buscar ajustes: ${adjError.message}`);
    }

    if (!adjustments || adjustments.length === 0) {
      return NextResponse.json(
        { error: "Nenhum ajuste encontrado para exportar" },
        { status: 404 }
      );
    }

    const { buffer, fileName } = await generateWordFile(adjustments, spedFileId, periodId);

    // Converter Buffer para Uint8Array para compatibilidade com NextResponse
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Erro ao exportar ajustes em Word:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
