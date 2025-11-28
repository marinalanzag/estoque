"use client";

import { useMemo, useState } from "react";
import type { ConsolidatedRow } from "@/types/consolidado";
import * as XLSX from "xlsx";

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

  const handleDownloadExcel = () => {
    // Calcular totais
    const totais = filteredRows.reduce(
      (acc, row) => ({
        qtdInicial: acc.qtdInicial + row.qtd_inicial,
        entradas: acc.entradas + row.entradas,
        saidas: acc.saidas + row.saidas,
        qtdFinal: acc.qtdFinal + row.qtd_final,
        valorTotal: acc.valorTotal + row.valor_total,
      }),
      {
        qtdInicial: 0,
        entradas: 0,
        saidas: 0,
        qtdFinal: 0,
        valorTotal: 0,
      }
    );

    // Preparar dados para exportação (valores numéricos para cálculos no Excel)
    const exportData = filteredRows.map((row) => ({
      "Código": row.cod_item,
      "Descrição": row.descr_item,
      "Unidade": row.unidade || "-",
      "Estoque Inicial": row.qtd_inicial,
      "Entradas": row.entradas,
      "Saídas": row.saidas,
      "Estoque Final": row.qtd_final,
      "Custo Médio": row.custo_medio,
      "Valor Total": row.valor_total,
    }));

    // Adicionar linha de totais
    exportData.push({
      "Código": "TOTAL",
      "Descrição": "",
      "Unidade": "",
      "Estoque Inicial": totais.qtdInicial,
      "Entradas": totais.entradas,
      "Saídas": totais.saidas,
      "Estoque Final": totais.qtdFinal,
      "Custo Médio": "",
      "Valor Total": totais.valorTotal,
    });

    // Criar workbook e worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 12 }, // Código
      { wch: 40 }, // Descrição
      { wch: 10 }, // Unidade
      { wch: 15 }, // Estoque Inicial
      { wch: 12 }, // Entradas
      { wch: 12 }, // Saídas
      { wch: 15 }, // Estoque Final
      { wch: 15 }, // Custo Médio
      { wch: 15 }, // Valor Total
    ];
    ws["!cols"] = colWidths;

    // Formatar células numéricas e linha de totais
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    
    // Formatar todas as células numéricas
    for (let row = 1; row <= range.e.r; row++) {
      // Colunas numéricas: D (Estoque Inicial), E (Entradas), F (Saídas), G (Estoque Final), H (Custo Médio), I (Valor Total)
      const colIndices = [3, 4, 5, 6, 7, 8]; // D, E, F, G, H, I (0-indexed: 3, 4, 5, 6, 7, 8)
      
      colIndices.forEach((colIdx) => {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIdx });
        const cell = ws[cellAddress];
        
        if (cell && typeof cell.v === "number") {
          // Formatar como número com 2 casas decimais
          cell.z = "#,##0.00";
          
          // Para colunas de valor (H e I), formatar como moeda
          if (colIdx === 7 || colIdx === 8) {
            // Custo Médio e Valor Total
            cell.z = cell.v === 0 ? "#,##0.00" : 'R$ #,##0.00';
          }
        }
      });
      
      // Destacar linha de totais
      if (row === range.e.r) {
        const totalRow = range.e.r;
        colIndices.forEach((colIdx) => {
          const cellAddress = XLSX.utils.encode_cell({ r: totalRow, c: colIdx });
          if (ws[cellAddress]) {
            ws[cellAddress].s = {
              font: { bold: true },
              fill: { fgColor: { rgb: "E0E0E0" } },
            };
          }
        });
        // Destacar também a célula "TOTAL"
        const totalCell = ws[XLSX.utils.encode_cell({ r: totalRow, c: 0 })];
        if (totalCell) {
          totalCell.s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "E0E0E0" } },
          };
        }
      }
    }

    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, "Consolidação");

    // Gerar nome do arquivo com data/hora
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const fileName = `consolidacao_${dateStr}_${timeStr}.xlsx`;

    // Fazer download
    XLSX.writeFile(wb, fileName);
  };

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
        <div className="flex items-end">
          <button
            onClick={handleDownloadExcel}
            disabled={filteredRows.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
            title="Baixar tabela consolidada em Excel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Baixar Excel
          </button>
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

