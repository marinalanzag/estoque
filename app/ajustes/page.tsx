import { getSupabaseAdmin } from "@/lib/supabaseServer";
import AdjustmentsPageClient from "@/components/adjustments/AdjustmentsPageClient";

interface AjustesPageProps {
  searchParams?: {
    fileId?: string;
  };
}

export default async function AjustesPage({ searchParams }: AjustesPageProps) {
  const supabaseAdmin = getSupabaseAdmin();

  // Buscar arquivos SPED disponíveis
  const { data: spedFiles } = await supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at")
    .order("uploaded_at", { ascending: false });

  if (!spedFiles || spedFiles.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Ajustes de Códigos
        </h1>
        <p className="text-gray-600">
          Nenhum arquivo SPED encontrado. Importe um arquivo SPED primeiro.
        </p>
      </div>
    );
  }

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
      console.log("[ajustes/page] Usando SPED base do período:", baseSpedId);
    } else {
      // Se não há base, mostrar aviso
      return (
        <div className="max-w-6xl mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Ajustes de Códigos
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
    // Se não há período ativo, usar o primeiro SPED disponível (compatibilidade)
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
          Ajustes de Códigos
        </h1>
        <p className="text-gray-600">
          Não foi possível determinar um arquivo SPED.
        </p>
      </div>
    );
  }

  const selectedFile = spedFiles.find((f) => f.id === selectedFileId);

  // Buscar ajustes já feitos (do arquivo SPED e do período ativo se existir)
  const adjustmentsQuery = supabaseAdmin
    .from("code_offset_adjustments")
    .select("id, cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value, created_at, period_id")
    .eq("sped_file_id", selectedFileId)
    .order("created_at", { ascending: false });

  // Se houver período ativo, filtrar por ele também para garantir que os ajustes sejam do período correto
  if (activePeriod) {
    adjustmentsQuery.eq("period_id", activePeriod.id);
  }

  const { data: adjustments } = await adjustmentsQuery;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Ajustes de Códigos (Positivos x Negativos)
        </h1>
        <p className="text-gray-600">
          Ajuste saldos negativos transferindo quantidades de códigos positivos.
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
              <span>{selectedFile?.name || "Não encontrado"}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Para alterar o SPED base, acesse a página de importação/configuração.
            </p>
          </div>
        </div>
      ) : (
        /* Filtro de SPED (apenas quando não há período ativo) */
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <form action="/ajustes" method="get" className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arquivo SPED
              </label>
              <select
                name="fileId"
                defaultValue={selectedFileId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {spedFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name} (
                    {new Date(file.uploaded_at).toLocaleDateString("pt-BR")})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Filtrar
            </button>
          </form>
        </div>
      )}

      {/* Componente Client que gerencia estado e atualização em tempo real */}
      <AdjustmentsPageClient
        spedFileId={selectedFileId}
        fileName={selectedFile?.name ?? "Arquivo SPED"}
        initialAdjustments={adjustments ?? []}
      />
    </div>
  );
}

