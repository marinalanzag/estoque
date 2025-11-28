import { getSupabaseAdmin } from "@/lib/supabaseServer";
import InventoryFinalTable from "@/components/inventory/InventoryFinalTable";

interface InventarioFinalPageProps {
  searchParams?: {
    fileId?: string;
  };
}

export default async function InventarioFinalPage({
  searchParams,
}: InventarioFinalPageProps) {
  const supabaseAdmin = getSupabaseAdmin();

  // CRÍTICO: Buscar período ativo e usar SPED base (mesma lógica da aba Entradas)
  const { getActivePeriodFromRequest, getBaseSpedFileForPeriod } = await import("@/lib/periods");
  const urlParams = new URLSearchParams();
  if (searchParams?.fileId) {
    urlParams.set("fileId", searchParams.fileId);
  }
  const activePeriod = await getActivePeriodFromRequest(urlParams);

  // Buscar arquivos SPED do período ativo (ou todos se não houver período ativo)
  const spedQuery = supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at, is_base")
    .order("uploaded_at", { ascending: false });

  if (activePeriod) {
    spedQuery.eq("period_id", activePeriod.id);
  }

  const { data: spedFiles } = await spedQuery;

  if (!spedFiles || spedFiles.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Inventário Final
        </h1>
        <p className="text-gray-600">
          Nenhum arquivo SPED encontrado. Importe um arquivo SPED primeiro.
        </p>
      </div>
    );
  }

  // IMPORTANTE: Se houver período ativo, SEMPRE usar o SPED base, ignorando qualquer seleção manual
  let selectedFileId: string | null = null;
  
  if (activePeriod) {
    const baseSpedId = await getBaseSpedFileForPeriod(activePeriod.id);
    if (baseSpedId) {
      selectedFileId = baseSpedId;
      console.log("[inventario-final/page] Usando SPED base do período:", baseSpedId);
    } else {
      // Se não há base, usar o primeiro SPED do período
      selectedFileId = spedFiles[0]?.id ?? null;
      console.warn("[inventario-final/page] Nenhum SPED base configurado, usando primeiro SPED do período");
    }
  } else {
    // Se não há período ativo, usar o SPED solicitado ou o primeiro disponível
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
          Inventário Final
        </h1>
        <p className="text-gray-600">
          Não foi possível determinar um arquivo SPED.
        </p>
      </div>
    );
  }

  const selectedFile = spedFiles.find((f) => f.id === selectedFileId);
  const activePeriodId = activePeriod?.id ?? null;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Inventário Final</h1>
        <p className="text-gray-600">
          Estoque consolidado após aplicação dos ajustes de códigos.
        </p>
      </div>

      {/* Filtro de SPED */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <form action="/inventario-final" method="get" className="flex gap-4 items-end">
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

      {/* Tabela de inventário final */}
      <InventoryFinalTable
        spedFileId={selectedFileId}
        fileName={selectedFile?.name ?? "Arquivo SPED"}
        periodId={activePeriodId}
      />
    </div>
  );
}

