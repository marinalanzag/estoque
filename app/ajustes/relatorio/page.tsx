import { getSupabaseAdmin } from "@/lib/supabaseServer";
import AdjustmentsReportTable from "@/components/adjustments/AdjustmentsReportTable";

interface AjustesRelatorioPageProps {
  searchParams?: {
    fileId?: string;
  };
}

export default async function AjustesRelatorioPage({
  searchParams,
}: AjustesRelatorioPageProps) {
  const supabaseAdmin = getSupabaseAdmin();

  // Buscar período ativo usando helper robusto
  const { getActivePeriodFromRequest } = await import("@/lib/periods");
  const activePeriod = await getActivePeriodFromRequest();
  
  console.log("[ajustes/relatorio/page] Período ativo encontrado:", activePeriod?.id || "nenhum");

  // IMPORTANTE: Se houver período ativo, SEMPRE usar o SPED base, ignorando qualquer seleção manual
  let selectedFileId: string | null = null;
  
  if (activePeriod) {
    const { getBaseSpedFileForPeriod } = await import("@/lib/periods");
    
    // Buscar todos os SPEDs do período para debug
    const { data: spedFilesForPeriod } = await supabaseAdmin
      .from("sped_files")
      .select("id, name, is_base, period_id")
      .eq("period_id", activePeriod.id);
    
    console.log(`[ajustes/relatorio/page] SPEDs vinculados ao período ${activePeriod.id}:`, spedFilesForPeriod?.length || 0);
    
    const baseSpedId = await getBaseSpedFileForPeriod(activePeriod.id);
    console.log("[ajustes/relatorio/page] SPED base retornado:", baseSpedId || "nenhum");
    
    if (baseSpedId) {
      selectedFileId = baseSpedId;
      console.log("[ajustes/relatorio/page] ✅ Usando SPED base do período:", baseSpedId);
    } else {
      // Se não há base mas há SPEDs do período, usar o primeiro como fallback
      if (spedFilesForPeriod && spedFilesForPeriod.length > 0) {
        console.warn(`[ajustes/relatorio/page] ⚠️ Nenhum SPED marcado como base, mas encontrados ${spedFilesForPeriod.length} SPED(s) do período. Usando o primeiro como fallback.`);
        selectedFileId = spedFilesForPeriod[0].id;
      } else {
        // Se não há base, mostrar aviso
        console.error("[ajustes/relatorio/page] ❌ Nenhum SPED base encontrado e nenhum SPED vinculado ao período");
        return (
          <div className="max-w-6xl mx-auto p-6 space-y-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              Relatório de Ajustes
            </h1>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium mb-2">
                ⚠️ Nenhum SPED base configurado para este período
              </p>
              <p className="text-yellow-700 text-sm mb-3">
                Configure o SPED base na página de configuração do período.
              </p>
              <p className="text-yellow-600 text-xs mb-2">
                Período: {activePeriod.label || `${activePeriod.year}/${activePeriod.month}`} (ID: {activePeriod.id.substring(0, 8)}...)
              </p>
              <a
                href="/periodos/configuracao"
                className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium"
              >
                Configurar período
              </a>
            </div>
          </div>
        );
      }
    }
  } else {
    // Se não há período ativo, buscar arquivos SPED disponíveis
    const { data: spedFiles } = await supabaseAdmin
      .from("sped_files")
      .select("id, name, uploaded_at")
      .order("uploaded_at", { ascending: false });

    if (!spedFiles || spedFiles.length === 0) {
      return (
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Relatório de Ajustes
          </h1>
          <p className="text-gray-600">
            Nenhum arquivo SPED encontrado. Importe um arquivo SPED primeiro.
          </p>
        </div>
      );
    }

    const requestedFileId = searchParams?.fileId ?? null;
    selectedFileId =
      requestedFileId && spedFiles.some((file) => file.id === requestedFileId)
        ? requestedFileId
        : spedFiles[0]?.id ?? null;
  }

  if (!selectedFileId) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Relatório de Ajustes
        </h1>
        <p className="text-gray-600">
          Não foi possível determinar um arquivo SPED.
        </p>
      </div>
    );
  }

  // Buscar informações do arquivo SPED selecionado
  const { data: selectedFileData } = await supabaseAdmin
    .from("sped_files")
    .select("id, name")
    .eq("id", selectedFileId)
    .single();

  const selectedFile = selectedFileData || { id: selectedFileId, name: "Arquivo SPED" };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Relatório Consolidado de Ajustes
        </h1>
        <p className="text-gray-600">
          Relatório detalhado dos ajustes realizados entre códigos positivos e
          negativos.
        </p>
      </div>

      {/* Informações do SPED base (se houver período ativo) */}
      {activePeriod && selectedFileId ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Período ativo:</span>
              <span>{activePeriod.id}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">SPED base:</span>
              <span>{selectedFile.name || "Não encontrado"}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Para alterar o SPED base, acesse a página de importação/configuração.
            </p>
          </div>
        </div>
      ) : null}

      {/* Tabela de relatório */}
      <AdjustmentsReportTable
        spedFileId={selectedFileId}
        fileName={selectedFile?.name ?? "Arquivo SPED"}
        activePeriodId={activePeriod?.id || null}
      />
    </div>
  );
}

