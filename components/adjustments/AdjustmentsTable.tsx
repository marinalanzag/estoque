"use client";

import { useState, useEffect, useCallback } from "react";

interface InventoryItem {
  cod_item: string;
  descr_item?: string | null;
  estoque_inicial: number;
  entradas: number;
  saidas: number;
  estoque_teorico: number;
  unit_cost: number;
  valor_estoque: number;
  ajustes_recebidos: number;
  ajustes_fornecidos: number;
  estoque_final: number;
}

interface Adjustment {
  id: string;
  cod_negativo: string;
  cod_positivo: string;
  qtd_baixada: number;
  unit_cost: number;
  total_value: number;
  created_at: string;
}

interface AdjustmentsTableProps {
  spedFileId: string;
  fileName: string;
  initialAdjustments: Adjustment[];
  onAdjustmentsChange?: (adjustments: Adjustment[]) => void;
}

export default function AdjustmentsTable({
  spedFileId,
  fileName,
  initialAdjustments,
  onAdjustmentsChange,
}: AdjustmentsTableProps) {
  const [negativos, setNegativos] = useState<InventoryItem[]>([]);
  const [positivos, setPositivos] = useState<InventoryItem[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initialAdjustments);

  // Sincronizar ajustes iniciais quando mudarem
  useEffect(() => {
    setAdjustments(initialAdjustments);
  }, [initialAdjustments]);

  // Notificar mudanças nos ajustes
  useEffect(() => {
    if (onAdjustmentsChange) {
      onAdjustmentsChange(adjustments);
    }
  }, [adjustments, onAdjustmentsChange]);
  const [loading, setLoading] = useState(true);
  const [selectedNegativo, setSelectedNegativo] = useState<string | null>(null);
  const [selectedPositivo, setSelectedPositivo] = useState<string | null>(null);
  const [qtdBaixada, setQtdBaixada] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/adjustments/inventory-data?sped_file_id=${spedFileId}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar dados");
      }

      setNegativos(data.negativos || []);
      setPositivos(data.positivos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [spedFileId]);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  const loadAdjustments = async () => {
    try {
      const res = await fetch(
        `/api/adjustments/list?sped_file_id=${spedFileId}`
      );
      const data = await res.json();

      if (res.ok && data.adjustments) {
        setAdjustments(data.adjustments);
      }
    } catch (err) {
      console.error("Erro ao recarregar ajustes:", err);
    }
  };

  const handleCreateAdjustment = async () => {
    if (!selectedNegativo || !selectedPositivo || !qtdBaixada) {
      setError("Preencha todos os campos");
      return;
    }

    const qtd = parseFloat(qtdBaixada);
    if (isNaN(qtd) || qtd <= 0) {
      setError("Quantidade deve ser maior que zero");
      return;
    }

    const negativo = negativos.find((n) => n.cod_item === selectedNegativo);
    const positivo = positivos.find((p) => p.cod_item === selectedPositivo);

    if (!negativo || !positivo) {
      setError("Códigos não encontrados");
      return;
    }

    if (qtd > positivo.estoque_final) {
      setError(
        `Quantidade excede o estoque disponível (${positivo.estoque_final.toFixed(2)})`
      );
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/adjustments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sped_file_id: spedFileId,
          cod_negativo: selectedNegativo,
          cod_positivo: selectedPositivo,
          qtd_baixada: qtd,
          unit_cost: positivo.unit_cost,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar ajuste");
      }

      setSuccess(`✅ Ajuste criado e salvo com sucesso! Código ${data.adjustment.cod_positivo} → ${data.adjustment.cod_negativo} - Qtd: ${data.adjustment.qtd_baixada}`);
      
      // Atualizar estado local IMEDIATAMENTE com o novo ajuste
      const newAdjustments = [data.adjustment, ...adjustments];
      setAdjustments(newAdjustments);
      
      setSelectedNegativo(null);
      setSelectedPositivo(null);
      setQtdBaixada("");
      
      // Recarregar dados do inventário para refletir os ajustes
      await loadInventoryData();
      
      // Recarregar ajustes do banco para garantir sincronização completa
      await loadAdjustments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedNegativoItem = negativos.find(
    (n) => n.cod_item === selectedNegativo
  );
  const selectedPositivoItem = positivos.find(
    (p) => p.cod_item === selectedPositivo
  );

  const totalAjustes = adjustments.reduce(
    (acc, adj) => acc + Number(adj.total_value ?? 0),
    0
  );

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Carregando dados do inventário...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulário de novo ajuste */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Criar Novo Ajuste
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            {success}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código Negativo *
            </label>
            <select
              value={selectedNegativo || ""}
              onChange={(e) => setSelectedNegativo(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um código negativo...</option>
              {negativos.map((item) => (
                <option key={item.cod_item} value={item.cod_item}>
                  {item.cod_item} - {item.descr_item || "[Sem descrição]"} (
                  Estoque: {item.estoque_final.toFixed(2)})
                </option>
              ))}
            </select>
            {selectedNegativoItem && (
              <p className="mt-1 text-xs text-gray-500">
                Saldo atual: {selectedNegativoItem.estoque_final.toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código Positivo *
            </label>
            <select
              value={selectedPositivo || ""}
              onChange={(e) => setSelectedPositivo(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um código positivo...</option>
              {positivos.map((item) => (
                <option key={item.cod_item} value={item.cod_item}>
                  {item.cod_item} - {item.descr_item || "[Sem descrição]"} (
                  Estoque: {item.estoque_final.toFixed(2)}, Custo: R${" "}
                  {item.unit_cost.toFixed(2)})
                </option>
              ))}
            </select>
            {selectedPositivoItem && (
              <p className="mt-1 text-xs text-gray-500">
                Disponível: {selectedPositivoItem.estoque_final.toFixed(2)} | Custo
                unitário: R$ {selectedPositivoItem.unit_cost.toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantidade a Baixar *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={qtdBaixada}
              onChange={(e) => setQtdBaixada(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            {selectedPositivoItem && qtdBaixada && (
              <p className="mt-1 text-xs text-gray-500">
                Valor total: R${" "}
                {(
                  parseFloat(qtdBaixada) * selectedPositivoItem.unit_cost
                ).toFixed(2)}
              </p>
            )}
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCreateAdjustment}
              disabled={submitting || !selectedNegativo || !selectedPositivo || !qtdBaixada}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Criando ajuste..." : "Criar Ajuste"}
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de itens negativos */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <h2 className="text-lg font-semibold text-red-900">
            Itens com Saldo Negativo ({negativos.length})
          </h2>
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
                  Estoque Final
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ajustes Recebidos
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {negativos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Nenhum item com saldo negativo encontrado.
                  </td>
                </tr>
              ) : (
                negativos.map((item) => {
                  const ajustesRecebidos = adjustments
                    .filter((adj) => adj.cod_negativo === item.cod_item)
                    .reduce((acc, adj) => acc + Number(adj.qtd_baixada), 0);
                  const saldoAposAjustes = item.estoque_final + ajustesRecebidos;
                  const resolvido = saldoAposAjustes >= 0;

                  return (
                    <tr
                      key={item.cod_item}
                      className={resolvido ? "bg-green-50" : ""}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.cod_item}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.descr_item || "[Sem descrição]"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {item.estoque_final.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                        +{ajustesRecebidos.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {resolvido ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Resolvido
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                            Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela de ajustes realizados - DESTACADA */}
      {adjustments.length === 0 ? (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-yellow-900 mb-2">
            Nenhum ajuste realizado ainda
          </h3>
          <p className="text-yellow-700">
            Os ajustes que você criar aparecerão aqui e serão salvos automaticamente no banco de dados.
          </p>
        </div>
      ) : (
        <div className="bg-white border-2 border-blue-300 rounded-lg overflow-hidden shadow-lg">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 border-b border-blue-200">
            <h2 className="text-xl font-bold text-white">
              📋 Ajustes Realizados e Salvos ({adjustments.length})
            </h2>
            <p className="text-sm text-blue-100 mt-1">
              Todos os ajustes estão salvos no banco de dados e persistem mesmo após fechar a aba ou mudar de mês
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Transferência
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Quantidade Baixada
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Custo Unit.
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adjustments.map((adj, index) => (
                  <tr 
                    key={adj.id}
                    className={`${index === 0 ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="font-medium">
                        {new Date(adj.created_at).toLocaleDateString("pt-BR")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(adj.created_at).toLocaleTimeString("pt-BR")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <div className="text-xs text-gray-500 mb-1">De (Positivo):</div>
                          <span className="text-sm font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                            {adj.cod_positivo}
                          </span>
                        </div>
                        <div className="text-blue-600 font-bold text-lg">→</div>
                        <div className="flex flex-col">
                          <div className="text-xs text-gray-500 mb-1">Para (Negativo):</div>
                          <span className="text-sm font-bold text-red-700 bg-red-100 px-2 py-1 rounded">
                            {adj.cod_negativo}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className="font-bold text-blue-900 text-lg">
                        {Number(adj.qtd_baixada).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                      R$ {Number(adj.unit_cost).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className="font-bold text-gray-900 text-lg">
                        R$ {Number(adj.total_value).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50 border-t-2 border-blue-300">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right text-sm font-bold text-blue-900">
                    TOTAL GERAL:
                  </td>
                  <td colSpan={2} className="px-6 py-4 text-right">
                    <span className="text-xl font-bold text-blue-900">
                      R$ {totalAjustes.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

