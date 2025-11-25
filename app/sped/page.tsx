import { getSupabaseAdmin } from "@/lib/supabaseServer";
import Link from "next/link";

interface SpedFile {
  id: string;
  name: string;
  uploaded_at: string;
  year: number | null;
  period: string | null;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function SpedFilesPage() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: spedFiles, error } = await supabaseAdmin
    .from("sped_files")
    .select("id, name, uploaded_at, year, period")
    .order("uploaded_at", { ascending: false });


  if (error) {
    console.error("Erro ao buscar arquivos SPED:", error);
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Arquivos SPED
        </h1>
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
          <p>Erro ao carregar arquivos: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Arquivos SPED Importados
        </h1>
        <p className="text-gray-600 mt-2">
          Lista de todos os arquivos SPED importados
        </p>
      </div>

      {!spedFiles || spedFiles.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 text-gray-600 p-4 rounded-md">
          <p>Nenhum arquivo SPED importado ainda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Nome do Arquivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Data de Upload
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {spedFiles.map((file: SpedFile) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {file.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(file.uploaded_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                    <Link
                      href={`/sped/${file.id}/inventario`}
                      className="text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Ver inventário fiscal
                    </Link>
                    <span className="text-gray-300">|</span>
                    <Link
                      href={`/sped/upload-xml-sales?fileId=${file.id}`}
                      className="text-green-600 hover:text-green-800 hover:underline"
                    >
                      Importar XMLs de venda
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
        >
          ← Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}

