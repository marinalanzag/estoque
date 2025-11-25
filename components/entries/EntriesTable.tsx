"use client";

import { useEffect, useMemo, useState } from "react";

interface EntryRow {
  documentItemId: string;
  nota: string;
  fornecedor: string;
  fornecedorDoc: string | null;
  dataDocumento?: string | null;
  cod_item: string;
  descr_item: string;
  unidade_0200: string | null;
  unidade_nf: string | null;
  quantidade_nf: number;
  unidade_produto: string | null;
  qtd_produto: number;
  custo_unitario: number;
  custo_total: number;
  adjusted_qty: number | null;
}

interface EntriesTableProps {
  entries: EntryRow[];
}

export default function EntriesTable({ entries }: EntriesTableProps) {
  const [rows, setRows] = useState(entries);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loadingRow, setLoadingRow] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setRows(entries);
    setEditedValues(
      entries.reduce((acc, row) => {
        acc[row.documentItemId] =
          row.adjusted_qty !== null && row.adjusted_qty !== undefined
            ? String(row.adjusted_qty)
            : "";
        return acc;
      }, {} as Record<string, string>)
    );
  }, [entries]);

  const totalCusto = useMemo(
    () => rows.reduce((acc, row) => acc + row.custo_total, 0),
    [rows]
  );

  const totalQtdNF = useMemo(
    () => rows.reduce((acc, row) => acc + row.quantidade_nf, 0),
    [rows]
  );

  const totalQtdAjustada = useMemo(() => {
    return rows.reduce((acc, row) => {
      const adjusted = row.adjusted_qty;
      if (adjusted !== null && adjusted !== undefined) {
        return acc + adjusted;
      }
      return acc + row.quantidade_nf;
    }, 0);
  }, [rows]);

  const handleInputChange = (id: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const saveAdjustment = async (row: EntryRow) => {
    const rawValue = editedValues[row.documentItemId];
    const parsedValue =
      rawValue === "" || rawValue === undefined ? null : Number(rawValue);

    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      setFeedback("Quantidade inválida.");
      return;
    }

    const tolerance = 1e-6;
    const value =
      parsedValue !== null &&
      Math.abs(parsedValue - row.quantidade_nf) < tolerance
        ? null
        : parsedValue;

    setLoadingRow(row.documentItemId);
    setFeedback(null);

    try {
      const res = await fetch("/api/document-items/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentItemId: row.documentItemId,
          adjustedQty: value,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Erro ao salvar ajuste");
      }

      setRows((prev) =>
        prev.map((current) =>
          current.documentItemId === row.documentItemId
            ? { ...current, adjusted_qty: value }
            : current
        )
      );

      setFeedback("Ajuste salvo com sucesso.");
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error ? error.message : "Erro ao salvar ajuste"
      );
    } finally {
      setLoadingRow(null);
    }
  };

  const resetAdjustment = async (row: EntryRow) => {
    setEditedValues((prev) => ({ ...prev, [row.documentItemId]: "" }));
    await saveAdjustment({ ...row, adjusted_qty: null });
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Custo total (NF)</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totalCusto.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Quantidade NF</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totalQtdNF.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Quantidade ajustada</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totalQtdAjustada.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {feedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
          {feedback}
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Nota
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Fornecedor
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Item
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Unidade (0200)
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Unidade NF
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Quantidade NF
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Unidade (0220)
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Qtd (0220)
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Custo unitário
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Custo total
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Quantidade ajustada
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const isAdjusted =
                row.adjusted_qty !== null &&
                row.adjusted_qty !== undefined &&
                row.adjusted_qty !== row.quantidade_nf;

              return (
                <tr
                  key={row.documentItemId}
                  className={isAdjusted ? "bg-yellow-50" : undefined}
                >
                  <td className="px-4 py-2 text-gray-900">
                    <div className="font-semibold">{row.nota}</div>
                    <div className="text-xs text-gray-500">
                      {row.dataDocumento
                        ? new Date(row.dataDocumento).toLocaleDateString(
                            "pt-BR"
                          )
                        : "-"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    <div className="font-medium">{row.fornecedor}</div>
                    {row.fornecedorDoc && (
                      <div className="text-xs text-gray-500">
                        {row.fornecedorDoc}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    <div className="font-semibold">{row.cod_item}</div>
                    <div className="text-xs text-gray-500">
                      {row.descr_item}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {row.unidade_0200 || "-"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {row.unidade_nf || "-"}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {row.quantidade_nf.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {row.unidade_produto || "-"}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {row.qtd_produto.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {row.custo_unitario.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {row.custo_total.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      className="w-32 px-2 py-1 border border-gray-300 rounded-md text-right text-sm"
                      value={
                        editedValues[row.documentItemId] ??
                        (row.adjusted_qty ?? "")
                      }
                      onChange={(e) =>
                        handleInputChange(
                          row.documentItemId,
                          e.target.value
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button
                      onClick={() => saveAdjustment(row)}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                      disabled={loadingRow === row.documentItemId}
                    >
                      {loadingRow === row.documentItemId
                        ? "Salvando..."
                        : "Salvar"}
                    </button>
                    {row.adjusted_qty !== null &&
                      row.adjusted_qty !== undefined && (
                        <button
                          onClick={() => resetAdjustment(row)}
                          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                        >
                          Remover
                        </button>
                      )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

