import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: imports, error } = await supabaseAdmin
      .from("xml_sales_imports")
      .select("id, label, sped_file_id, total_xmls, total_items, created_at, period_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar imports de XMLs:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    // Buscar nomes dos arquivos SPED relacionados
    const spedFileIds = Array.from(new Set((imports || []).map(imp => imp.sped_file_id).filter(Boolean)));
    const spedFilesMap = new Map<string, string>();
    
    if (spedFileIds.length > 0) {
      const { data: spedFiles } = await supabaseAdmin
        .from("sped_files")
        .select("id, name")
        .in("id", spedFileIds);
      
      spedFiles?.forEach(file => {
        spedFilesMap.set(file.id, file.name);
      });
    }

    // Adicionar nome do SPED a cada import
    const importsWithSpedName = (imports || []).map(imp => ({
      ...imp,
      sped_files: imp.sped_file_id ? {
        name: spedFilesMap.get(imp.sped_file_id) || null
      } : null
    }));

    // Agrupar imports por SPED e data (mesmo dia)
    const groupedImports = new Map<string, {
      key: string;
      sped_file_id: string;
      sped_name: string | null;
      date: string;
      imports: typeof importsWithSpedName;
      total_xmls: number;
      total_items: number;
      all_linked: boolean;
      import_ids: string[];
    }>();

    importsWithSpedName.forEach(imp => {
      const date = new Date(imp.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `${imp.sped_file_id || 'null'}_${date}`;
      
      if (!groupedImports.has(key)) {
        groupedImports.set(key, {
          key,
          sped_file_id: imp.sped_file_id || '',
          sped_name: imp.sped_files?.name || null,
          date,
          imports: [],
          total_xmls: 0,
          total_items: 0,
          all_linked: true,
          import_ids: [],
        });
      }

      const group = groupedImports.get(key)!;
      group.imports.push(imp);
      group.total_xmls += imp.total_xmls || 0;
      group.total_items += imp.total_items || 0;
      group.import_ids.push(imp.id);
      
      if (!imp.period_id) {
        group.all_linked = false;
      }
    });

    // Converter para array e ordenar por data (mais recente primeiro)
    const groupedArray = Array.from(groupedImports.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      ok: true,
      imports: importsWithSpedName, // Manter imports individuais para compatibilidade
      grouped: groupedArray, // Adicionar grupos
    });
  } catch (error) {
    console.error("Erro ao listar imports de XMLs:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

