"use client";

import { useMemo, useState } from "react";

export interface ConsolidatedRow {
  cod_item: string;
  descr_item: string;
  unidade?: string | null;
  qtd_inicial: number;
  valor_inicial: number;
  entradas: number;
  valor_entradas: number;
  saidas: number;
  qtd_final: number;
  custo_medio: number | null;
  valor_total: number;
}

interface ConsolidatedTableProps {
  rows: ConsolidatedRow[];
}

export default function ConsolidatedTable({ rows }: ConsolidatedTableProps) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.trim().toLowerCase();
    return rows.filter(
      (row) =>
        row.cod_item.toLowerCase().includes(term) ||
        row.descr_item.toLowerCase().includes(term)
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Buscar item
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite código ou descrição..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Código
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Descrição
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Unidade
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Estoque inicial
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Entradas
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Saídas
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Estoque final
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Custo médio
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Valor total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((row) => (
              <tr key={row.cod_item}>
                <td className="px-4 py-2 font-semibold text-gray-900">
                  {row.cod_item}
                </td>
                <td className="px-4 py-2 text-gray-700">{row.descr_item}</td>
                <td className="px-4 py-2 text-gray-700">
                  {row.unidade || "-"}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {row.qtd_inicial.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {row.entradas.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {row.saidas.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {row.qtd_final.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">
                  {row.custo_medio !== null
                    ? row.custo_medio.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "-"}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {row.valor_total.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-gray-500 text-sm"
                >
                  Nenhum item encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

