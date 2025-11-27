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
  const [searchTerm, setSearchTerm] = useState<string>("");

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

      {/* Campo de busca */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <label
          htmlFor="searchItem"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Buscar por código ou descrição do item
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            id="searchItem"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Digite o código ou descrição do item..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
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
              ) : (() => {
                // Filtrar itens baseado no termo de busca
                const filteredItems = items.filter((item) => {
                  if (!searchTerm.trim()) return true;
                  const search = searchTerm.toLowerCase();
                  return (
                    item.cod_item.toLowerCase().includes(search) ||
                    (item.descr_item?.toLowerCase().includes(search) ?? false)
                  );
                });

                if (filteredItems.length === 0) {
                  return (
                    <tr>
                      <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                        Nenhum item encontrado com o termo de busca.
                      </td>
                    </tr>
                  );
                }

                return filteredItems.map((item) => {
                  const ajustesLiquido = item.ajustes_recebidos - item.ajustes_fornecidos;
                  const isNegativo = item.estoque_final < 0;
                  const temAjustes = item.ajustes_recebidos > 0 || item.ajustes_fornecidos > 0;

                  return (
                    <tr
                      key={item.cod_item}
                      className={`${
                        isNegativo ? "bg-red-50" : ""
                      } ${
                        temAjustes ? "border-l-4 border-l-yellow-400" : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {item.cod_item}
                          {temAjustes && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                              title={`Ajustes recebidos: ${item.ajustes_recebidos.toFixed(2)}, Ajustes fornecidos: ${item.ajustes_fornecidos.toFixed(2)}`}
                            >
                              <svg
                                className="h-3 w-3 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Ajustado
                            </span>
                          )}
                        </div>
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
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

