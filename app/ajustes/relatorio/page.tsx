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

  // Buscar período ativo PRIMEIRO
  const { data: activePeriod } = await supabaseAdmin
    .from("periods")
    .select("id")
    .eq("is_active", true)
    .single();

  // IMPORTANTE: Se houver período ativo, SEMPRE usar o SPED base, ignorando qualquer seleção manual
  let selectedFileId: string | null = null;
  
  if (activePeriod) {
    const { getBaseSpedFileForPeriod } = await import("@/lib/periods");
    const baseSpedId = await getBaseSpedFileForPeriod(activePeriod.id);
    if (baseSpedId) {
      selectedFileId = baseSpedId;
      console.log("[ajustes/relatorio/page] Usando SPED base do período:", baseSpedId);
    } else {
      // Se não há base, mostrar aviso
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
      />
    </div>
  );
}

