"use client";

import { useState, useEffect, useCallback } from "react";

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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReport = useCallback(async (silent = false) => {
    try {
      console.log("[AdjustmentsReportTable] 🔄 Iniciando loadReport para spedFileId:", spedFileId);
      
      if (!silent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      
      // Buscar período ativo para garantir que busca os ajustes do período correto
      const periodRes = await fetch("/api/periods/active");
      const periodData = await periodRes.ok ? await periodRes.json() : null;
      const periodId = periodData?.period?.id;
      
      console.log("[AdjustmentsReportTable] Período ativo encontrado:", periodId);
      
      let url = `/api/adjustments/report?sped_file_id=${spedFileId}`;
      if (periodId) {
        url += `&period_id=${periodId}`;
      }
      
      console.log("[AdjustmentsReportTable] Buscando relatório na URL:", url);
      const res = await fetch(url, {
        cache: 'no-store', // Forçar busca sempre atualizada
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar relatório");
      }

      console.log("[AdjustmentsReportTable] ✅ Relatório recarregado:", {
        totalAjustes: data.report?.length || 0,
        summary: data.summary,
      });

      setReport(data.report || []);
      setSummary(data.summary || {});
      setImpactoNegativo(data.impacto_por_negativo || []);
      setImpactoPositivo(data.impacto_por_positivo || []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("[AdjustmentsReportTable] ❌ Erro ao recarregar relatório:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [spedFileId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Recarregar quando a aba ganha foco (usuário volta para a página)
  useEffect(() => {
    const handleFocus = () => {
      console.log("[AdjustmentsReportTable] Página recebeu foco, recarregando relatório...");
      loadReport(true);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadReport]);

  // Recarregar quando a página fica visível novamente (usuário volta para a aba)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("[AdjustmentsReportTable] Página visível novamente, recarregando relatório...");
        loadReport(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadReport]);

  // Polling: verificar novos ajustes a cada 5 segundos quando a aba está visível
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const checkForUpdates = () => {
      // Só verificar se a aba está visível e não estiver carregando
      if (!document.hidden && !loading && !isRefreshing) {
        console.log("[AdjustmentsReportTable] Polling: verificando atualizações...");
        loadReport(true);
      }
    };

    // Verificar a cada 5 segundos
    intervalId = setInterval(checkForUpdates, 5000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [loadReport, loading, isRefreshing]);

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

      {/* Botões de ação */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex gap-4 items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => loadReport(false)}
              disabled={isRefreshing || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
            >
              {isRefreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Atualizando...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar Relatório
                </>
              )}
            </button>
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
          <div className="text-sm text-gray-500">
            Última atualização: {lastUpdate.toLocaleTimeString("pt-BR")}
            {isRefreshing && (
              <span className="ml-2 text-blue-600">🔄 Atualizando...</span>
            )}
          </div>
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

