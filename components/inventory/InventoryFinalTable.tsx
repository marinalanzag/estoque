"use client";

import { useState, useEffect } from "react";

interface InventoryItem {
  cod_item: string;
  descr_item?: string | null;
  unid?: string | null;
  estoque_inicial: number;
  entradas: number;
  saidas: number;
  estoque_teorico: number;
  ajustes_recebidos: number;
  ajustes_fornecidos: number;
  estoque_final: number;
  unit_cost: number;
  valor_estoque_final: number;
}

interface InventoryFinalTableProps {
  spedFileId: string;
  fileName: string;
}

export default function InventoryFinalTable({
  spedFileId,
  fileName,
}: InventoryFinalTableProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"sped" | "xlsx" | "csv">("sped");
  const [removeZeros, setRemoveZeros] = useState(false);
  const [removeNegatives, setRemoveNegatives] = useState(false);

  useEffect(() => {
    loadData();
  }, [spedFileId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/inventory-final/data?sped_file_id=${spedFileId}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar inventário final");
      }

      setItems(data.items || []);
      setSummary(data.summary || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(exportFormat);
      
      // Mapear formato para o esperado pela API
      const apiFormat = exportFormat === "sped" ? "sped_txt" : exportFormat;
      
      const params = new URLSearchParams({
        format: apiFormat,
        removeZeros: removeZeros.toString(),
        removeNegatives: removeNegatives.toString(),
      });
      
      const url = `/api/sped/${spedFileId}/export-inventory?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar arquivo");
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      
      // Determinar extensão
      let extension = "txt";
      if (exportFormat === "xlsx") extension = "xlsx";
      if (exportFormat === "csv") extension = "csv";
      
      a.download = `inventario_final_${fileName}_${new Date().toISOString().split("T")[0]}.${extension}`;
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
        <p className="text-gray-600">Carregando inventário final...</p>
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
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">Total de Itens</p>
            <p className="text-2xl font-semibold text-blue-900">
              {summary.total_itens}
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-700">Quantidade Total</p>
            <p className="text-2xl font-semibold text-green-900">
              {summary.total_quantidade.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-700">Valor Total</p>
            <p className="text-2xl font-semibold text-purple-900">
              {summary.total_valor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-700">Itens Negativos</p>
            <p className="text-2xl font-semibold text-orange-900">
              {summary.itens_negativos}
            </p>
          </div>
        </div>
      )}

      {/* Opções de exportação */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">Exportar Inventário</h3>
        
        {/* Formato de saída */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Formato de Saída
          </label>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="flex items-center p-4 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="exportFormat"
                value="sped"
                checked={exportFormat === "sped"}
                onChange={(e) => setExportFormat(e.target.value as "sped")}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900">SPED Bloco H (TXT)</div>
                <div className="text-sm text-gray-500">Formato oficial SPED EFD</div>
              </div>
            </label>
            <label className="flex items-center p-4 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="exportFormat"
                value="xlsx"
                checked={exportFormat === "xlsx"}
                onChange={(e) => setExportFormat(e.target.value as "xlsx")}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900">Excel (XLSX)</div>
                <div className="text-sm text-gray-500">Planilha com múltiplas abas</div>
              </div>
            </label>
            <label className="flex items-center p-4 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="exportFormat"
                value="csv"
                checked={exportFormat === "csv"}
                onChange={(e) => setExportFormat(e.target.value as "csv")}
                className="mr-3"
              />
              <div>
                <div className="font-medium text-gray-900">CSV</div>
                <div className="text-sm text-gray-500">Arquivo separado por ponto e vírgula</div>
              </div>
            </label>
          </div>
        </div>

        {/* Opções de limpeza */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Opções de Limpeza
          </label>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={removeZeros}
                onChange={(e) => setRemoveZeros(e.target.checked)}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">
                  Remover itens com saldo zero
                </div>
                <div className="text-sm text-gray-500">
                  Exclui itens com estoque final igual a zero do arquivo exportado
                </div>
              </div>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={removeNegatives}
                onChange={(e) => setRemoveNegatives(e.target.checked)}
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <div className="font-medium text-gray-900">
                  Remover itens com saldo negativo
                </div>
                <div className="text-sm text-gray-500">
                  Exclui itens com estoque final negativo (arquivo 100% saneado)
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Botão de exportação */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleDownload}
            disabled={downloading !== null}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {downloading ? `Gerando ${exportFormat.toUpperCase()}...` : "Exportar Inventário"}
          </button>
        </div>
      </div>

      {/* Tabela de itens */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidade
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estoque Inicial
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entradas
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saídas
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estoque Teórico
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ajustes
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estoque Final
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Custo Unit.
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                    Nenhum item encontrado.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const ajustesLiquido = item.ajustes_recebidos - item.ajustes_fornecidos;
                  const isNegativo = item.estoque_final < 0;

                  return (
                    <tr
                      key={item.cod_item}
                      className={isNegativo ? "bg-red-50" : ""}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.cod_item}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.descr_item || "[Sem descrição]"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.unid || "UN"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {item.estoque_inicial.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {item.entradas.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {item.saidas.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {item.estoque_teorico.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        {ajustesLiquido !== 0 && (
                          <span
                            className={
                              ajustesLiquido > 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {ajustesLiquido > 0 ? "+" : ""}
                            {ajustesLiquido.toFixed(2)}
                          </span>
                        )}
                        {ajustesLiquido === 0 && (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                        isNegativo ? "text-red-600" : "text-gray-900"
                      }`}>
                        {item.estoque_final.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        R$ {item.unit_cost.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        R$ {item.valor_estoque_final.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

