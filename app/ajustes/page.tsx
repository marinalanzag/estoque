import { getSupabaseAdmin } from "@/lib/supabaseServer";
import AdjustmentsTable from "@/components/adjustments/AdjustmentsTable";

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

  const requestedFileId = searchParams?.fileId ?? null;
  const selectedFileId =
    requestedFileId && spedFiles.some((file) => file.id === requestedFileId)
      ? requestedFileId
      : spedFiles[0]?.id ?? null;

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

  // Buscar ajustes já feitos
  const { data: adjustments } = await supabaseAdmin
    .from("code_offset_adjustments")
    .select("id, cod_negativo, cod_positivo, qtd_baixada, unit_cost, total_value, created_at")
    .eq("sped_file_id", selectedFileId)
    .order("created_at", { ascending: false });

  const totalAjustes = (adjustments ?? []).reduce(
    (acc, adj) => acc + Number(adj.total_value ?? 0),
    0
  );

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

      {/* Filtro de SPED */}
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

      {/* Card de resumo */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-700">Valor total das baixas</p>
            <p className="text-2xl font-semibold text-blue-900">
              {totalAjustes.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-700">Total de ajustes</p>
            <p className="text-2xl font-semibold text-blue-900">
              {adjustments?.length ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de ajustes */}
      <AdjustmentsTable
        spedFileId={selectedFileId}
        fileName={selectedFile?.name ?? "Arquivo SPED"}
        initialAdjustments={adjustments ?? []}
      />
    </div>
  );
}

