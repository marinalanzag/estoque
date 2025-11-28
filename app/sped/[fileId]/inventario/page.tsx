import { getSupabaseAdmin } from "@/lib/supabaseServer";
import Link from "next/link";

interface PageProps {
  params: Promise<{
    fileId: string;
  }>;
}

interface InventoryRow {
  sped_file_id: string;
  cod_item: string;
  descr_item: string | null;
  estoque_inicial: number;
  entradas: number;
  saidas: number;
  estoque_teorico: number;
  valor_inicial: number;
  valor_entradas: number;
  custo_medio_unitario: number | null;
  valor_estoque: number | null;
}

export default async function InventarioPage({ params }: PageProps) {
  const { fileId } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  // Buscar informações do arquivo SPED
  const { data: spedFile, error: fileError } = await supabaseAdmin
    .from("sped_files")
    .select("id, name")
    .eq("id", fileId)
    .single();

  if (fileError || !spedFile) {
    console.error("Erro ao buscar arquivo SPED:", fileError);
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Inventário Fiscal Teórico
        </h1>
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md space-y-2">
          <p className="font-semibold">Arquivo SPED não encontrado.</p>
          <p className="text-sm">
            ID buscado: <code className="bg-red-100 px-2 py-1 rounded">{fileId}</code>
          </p>
          {fileError && (
            <p className="text-sm">Erro: {fileError.message}</p>
          )}
          <div className="mt-4">
            <Link
              href="/periodos/configuracao"
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              ← Voltar à configuração do período
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Buscar dados da VIEW inventory_theoretical
  const { data: inventoryData, error: inventoryError } = await supabaseAdmin
    .from("inventory_theoretical")
    .select("*")
    .eq("sped_file_id", fileId)
    .order("cod_item");

  if (inventoryError) {
    console.error("Erro ao buscar inventário teórico:", inventoryError);
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Inventário Fiscal Teórico
        </h1>
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
          <p>Erro ao carregar inventário: {inventoryError.message}</p>
          <p className="text-sm mt-2">
            Verifique se a VIEW inventory_theoretical existe no banco de dados.
          </p>
        </div>
      </div>
    );
  }

  const inventoryRows = (inventoryData || []) as InventoryRow[];

  // Calcular totais e estatísticas
  // IMPORTANTE: Valores negativos ou null são ignorados (não podem ser usados para contagem)
  const totalValorInventario = inventoryRows.reduce(
    (acc, row) => {
      const valor = row.valor_estoque ?? 0;
      // Ignorar valores negativos ou zero
      return acc + (valor > 0 ? valor : 0);
    },
    0
  );

  const totalItens = inventoryRows.length;
  const itensComEstoqueNegativo = inventoryRows.filter(
    (row) => row.estoque_teorico < 0
  ).length;

  function formatNumber(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatCurrency(value: number | null): string {
    if (value === null) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Inventário Fiscal Teórico
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href={`/inventario-final?fileId=${fileId}`}
              className="text-sm text-purple-600 hover:text-purple-800 hover:underline font-medium"
            >
              📥 Ver Inventário Final e Exportar
            </Link>
            <Link
              href={`/sped/${fileId}/diagnostico`}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              🔍 Diagnosticar saídas
            </Link>
            <a
              href={`/sped/upload-xml-sales?fileId=${fileId}`}
              className="text-sm text-green-600 hover:text-green-800 hover:underline"
            >
              + Importar XMLs de venda
            </a>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          Arquivo SPED: {spedFile.name}
        </p>
        <p className="text-xs text-gray-500">
          Estoque inicial baseado na tabela stock_initial (não usa Bloco H do SPED)
        </p>
      </div>

      {/* Painel de Resumo */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Valor Total do Inventário
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalValorInventario)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Itens com Estoque Negativo
          </h3>
          <p className="text-2xl font-bold text-red-600">
            {itensComEstoqueNegativo}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Quantidade Total de Itens
          </h3>
          <p className="text-2xl font-bold text-gray-900">{totalItens}</p>
        </div>
      </div>

      {/* Tabela de Inventário */}
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Código
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Descrição
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Estoque Inicial
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Entradas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Saídas
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Estoque Teórico
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Custo Médio Unitário
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Valor Total do Estoque
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {inventoryRows.map((item) => (
              <tr
                key={item.cod_item}
                className={`hover:bg-gray-50 ${
                  item.estoque_teorico < 0 ? "bg-red-50" : ""
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                  {item.cod_item}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {item.descr_item || "[Sem descrição]"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                  {formatNumber(item.estoque_inicial)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 text-right">
                  {formatNumber(item.entradas)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 text-right">
                  {formatNumber(item.saidas)}
                </td>
                <td
                  className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${
                    item.estoque_teorico < 0
                      ? "text-red-600"
                      : "text-gray-900"
                  }`}
                >
                  {formatNumber(item.estoque_teorico)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">
                  {item.custo_medio_unitario !== null
                    ? formatCurrency(item.custo_medio_unitario)
                    : "-"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                  {item.valor_estoque !== null
                    ? formatCurrency(item.valor_estoque)
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inventoryRows.length === 0 && (
        <div className="mt-4 bg-gray-50 border border-gray-200 text-gray-600 p-4 rounded-md">
          <p>Nenhum item encontrado no inventário teórico.</p>
        </div>
      )}
    </div>
  );
}
