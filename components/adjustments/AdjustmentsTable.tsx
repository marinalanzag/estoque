"use client";

import { useState, useEffect } from "react";

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
}

export default function AdjustmentsTable({
  spedFileId,
  fileName,
  initialAdjustments,
}: AdjustmentsTableProps) {
  const [negativos, setNegativos] = useState<InventoryItem[]>([]);
  const [positivos, setPositivos] = useState<InventoryItem[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initialAdjustments);
  const [loading, setLoading] = useState(true);
  const [selectedNegativo, setSelectedNegativo] = useState<string | null>(null);
  const [selectedPositivo, setSelectedPositivo] = useState<string | null>(null);
  const [qtdBaixada, setQtdBaixada] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadInventoryData();
  }, [spedFileId]);

  const loadInventoryData = async () => {
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

      setSuccess("Ajuste criado com sucesso!");
      setAdjustments([data.adjustment, ...adjustments]);
      setSelectedNegativo(null);
      setSelectedPositivo(null);
      setQtdBaixada("");
      
      // Recarregar dados do inventário
      await loadInventoryData();
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

      {/* Tabela de ajustes realizados */}
      {adjustments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900">
              Ajustes Realizados ({adjustments.length})
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
                    Código Positivo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
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
                {adjustments.map((adj) => (
                  <tr key={adj.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(adj.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {adj.cod_negativo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {adj.cod_positivo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {Number(adj.qtd_baixada).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                      R$ {Number(adj.unit_cost).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      R$ {Number(adj.total_value).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                    Total:
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                    R$ {totalAjustes.toFixed(2)}
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

