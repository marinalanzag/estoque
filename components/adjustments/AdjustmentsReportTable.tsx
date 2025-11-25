"use client";

import { useState, useEffect } from "react";

interface AdjustmentReportItem {
  id: string;
  cod_negativo: string;
  descr_negativo: string;
  cod_positivo: string;
  descr_positivo: string;
  qtd_baixada: number;
  unit_cost: number;
  total_value: number;
  created_at: string;
}

interface ImpactoItem {
  cod_item: string;
  descr: string;
  qtd_total: number;
  valor_total: number;
}

interface AdjustmentsReportTableProps {
  spedFileId: string;
  fileName: string;
}

export default function AdjustmentsReportTable({
  spedFileId,
  fileName,
}: AdjustmentsReportTableProps) {
  const [report, setReport] = useState<AdjustmentReportItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [impactoNegativo, setImpactoNegativo] = useState<ImpactoItem[]>([]);
  const [impactoPositivo, setImpactoPositivo] = useState<ImpactoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [spedFileId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/adjustments/report?sped_file_id=${spedFileId}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar relatório");
      }

      setReport(data.report || []);
      setSummary(data.summary || {});
      setImpactoNegativo(data.impacto_por_negativo || []);
      setImpactoPositivo(data.impacto_por_positivo || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: "xlsx" | "csv") => {
    try {
      setDownloading(format);
      const url = `/api/adjustments/export?sped_file_id=${spedFileId}&format=${format}`;
      const res = await fetch(url);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar arquivo");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `relatorio_ajustes_${fileName}_${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer download");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Carregando relatório...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Erro: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      {summary && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">Total de Ajustes</p>
            <p className="text-2xl font-semibold text-blue-900">
              {summary.total_ajustes}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">Quantidade Total Baixada</p>
            <p className="text-2xl font-semibold text-green-900">
              {summary.total_quantidade_baixada.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-700">Valor Total Baixado</p>
            <p className="text-2xl font-semibold text-purple-900">
              {summary.total_valor_baixado.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          </div>
        </div>
      )}

      {/* Botões de download */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex gap-4">
          <button
            onClick={() => handleDownload("xlsx")}
            disabled={downloading !== null || report.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
          >
            {downloading === "xlsx" ? "Gerando..." : "Download Excel (XLSX)"}
          </button>
          <button
            onClick={() => handleDownload("csv")}
            disabled={downloading !== null || report.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
          >
            {downloading === "csv" ? "Gerando..." : "Download CSV"}
          </button>
        </div>
      </div>

      {/* Tabela detalhada de ajustes */}
      {report.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900">
              Ajustes Detalhados ({report.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código Negativo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição Negativo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código Positivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição Positivo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade Baixada
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Custo Unitário
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Impacto Financeiro
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {item.cod_negativo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.descr_negativo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {item.cod_positivo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.descr_positivo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {item.qtd_baixada.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      R$ {item.unit_cost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      R$ {item.total_value.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {summary && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                      Total:
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                      {summary.total_quantidade_baixada.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-gray-500">
                      -
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                      R$ {summary.total_valor_baixado.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">Nenhum ajuste encontrado para este arquivo SPED.</p>
        </div>
      )}

      {/* Impacto por código negativo */}
      {impactoNegativo.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <h2 className="text-lg font-semibold text-red-900">
              Impacto por Código Negativo ({impactoNegativo.length})
            </h2>
            <p className="text-sm text-red-700 mt-1">
              Total de quantidade e valor recebido por cada código negativo
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade Total Recebida
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total Recebido
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {impactoNegativo.map((item) => (
                  <tr key={item.cod_item}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.cod_item}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.descr}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {item.qtd_total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      R$ {item.valor_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Impacto por código positivo */}
      {impactoPositivo.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b border-green-200">
            <h2 className="text-lg font-semibold text-green-900">
              Impacto por Código Positivo ({impactoPositivo.length})
            </h2>
            <p className="text-sm text-green-700 mt-1">
              Total de quantidade e valor fornecido por cada código positivo
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade Total Fornecida
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total Fornecido
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {impactoPositivo.map((item) => (
                  <tr key={item.cod_item}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.cod_item}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.descr}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {item.qtd_total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      R$ {item.valor_total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

