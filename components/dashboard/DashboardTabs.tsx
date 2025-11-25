"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StockInitialUploadForm from "@/components/uploads/StockInitialUploadForm";
import SpedUploadForm from "@/components/uploads/SpedUploadForm";
import XmlSalesUploadForm from "@/components/uploads/XmlSalesUploadForm";

export interface InventoryInitialRow {
  cod_item: string;
  descr_item: string;
  qtd: number;
  unid?: string | null;
  unit_cost?: number | null;
  valor_total: number;
}

export interface InventorySummary {
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
}

export interface StockImportSummary {
  id: string;
  label: string | null;
  created_at: string;
  total_items: number | null;
  total_value: number | null;
}

const tabs = [
  { id: "upload", label: "1. Upload de Documentos" },
  { id: "inventory", label: "2. Inventário Inicial" },
  { id: "movements", label: "3. Movimentações" },
  { id: "analysis", label: "4. Consolidação" },
];

interface DashboardTabsProps {
  inventoryRows: InventoryInitialRow[];
  inventorySummary: InventorySummary;
  stockImports: StockImportSummary[];
  currentImportId: string | null;
}

export default function DashboardTabs({
  inventoryRows,
  inventorySummary,
  stockImports,
  currentImportId,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(tabs[0].id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedImportId, setSelectedImportId] = useState<string | null>(
    currentImportId
  );

  useEffect(() => {
    setSelectedImportId(currentImportId);
  }, [currentImportId]);

  const handleImportChange = (importId: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (importId) {
      params.set("importId", importId);
    } else {
      params.delete("importId");
    }
    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
  };

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Plataforma de Saneamento de Inventário
        </h1>
        <p className="text-gray-600 mt-2">
          Siga as etapas para importar documentos, consolidar dados e acompanhar
          o inventário fiscal.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              activeTab === tab.id
                ? "bg-blue-600 text-white border-blue-600 shadow"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        {activeTab === "upload" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Upload de Documentos
              </h2>
              <p className="text-gray-600">
                Importe os arquivos necessários para iniciar o saneamento. Os
                dados ficarão salvos até que você decida removê-los.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Estoque inicial
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  TXT (H010), XLSX ou CSV com códigos, descrições, unidades,
                  quantidades e custo unitário.
                </p>
                <StockInitialUploadForm
                  hideHeader
                  hideFooter
                  variant="embedded"
                />
              </div>

              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  SPED EFD
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Arquivo .txt contendo blocos C (documentos), 0200 (produtos) e
                  H (inventário fiscal).
                </p>
                <SpedUploadForm hideHeader hideFooter variant="embedded" />
              </div>

              <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  XMLs de venda
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  XMLs de NF-e/NFC-e ou ZIPs com múltiplos arquivos para
                  registrar saídas.
                </p>
                <XmlSalesUploadForm hideHeader hideFooter variant="embedded" />
              </div>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selecionar importação do estoque
                </label>
                <select
                  value={selectedImportId ?? ""}
                  onChange={(e) => handleImportChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  {stockImports.length === 0 ? (
                    <option value="">Nenhuma importação encontrada</option>
                  ) : (
                    stockImports.map((imp) => (
                      <option key={imp.id} value={imp.id}>
                        {(imp.label || "Sem descrição") +
                          " - " +
                          new Date(imp.created_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {selectedImportId && (
                <div className="text-sm text-gray-500">
                  {(() => {
                    const imp = stockImports.find(
                      (i) => i.id === selectedImportId
                    );
                    if (!imp) return null;
                    return (
                      <span>
                        Itens: {imp.total_items ?? 0} • Valor:{" "}
                        {formatCurrency(imp.total_value ?? 0)}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px] bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-blue-700">Itens no estoque</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {inventorySummary.totalItems}
                </p>
              </div>
              <div className="flex-1 min-w-[200px] bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <p className="text-sm text-emerald-700">Quantidade total</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">
                  {formatNumber(inventorySummary.totalQuantity)}
                </p>
              </div>
              <div className="flex-1 min-w-[200px] bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                <p className="text-sm text-indigo-700">Valor total</p>
                <p className="text-2xl font-bold text-indigo-900 mt-1">
                  {formatCurrency(inventorySummary.totalValue)}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Inventário Inicial Importado
                </h3>
                <p className="text-sm text-gray-500">
                  {inventoryRows.length} item(ns)
                </p>
              </div>
              {inventoryRows.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Nenhum estoque inicial importado ainda.
                </p>
              ) : (
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
                        <th className="px-4 py-2 text-right font-semibold text-gray-700">
                          Quantidade
                        </th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-700">
                          Custo unitário
                        </th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-700">
                          Valor total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inventoryRows.map((row) => (
                        <tr key={row.cod_item}>
                          <td className="px-4 py-2 font-medium text-gray-900">
                            {row.cod_item}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {row.descr_item}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {formatNumber(row.qtd)}
                            {row.unid ? (
                              <span className="text-xs text-gray-500 ml-1">
                                {row.unid}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-900">
                            {row.unit_cost != null
                              ? formatCurrency(row.unit_cost)
                              : "-"}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-900">
                            {formatCurrency(row.valor_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "movements" && (
          <div className="text-gray-600 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Movimentações Fiscais (em breve)
            </h2>
            <p>
              Nesta etapa você verá as entradas (compras) e saídas (vendas)
              consolidadas por item, incluindo documentos vinculados e status de
              conciliação.
            </p>
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="text-gray-600 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Consolidação e Alertas (em breve)
            </h2>
            <p>
              Nesta etapa vamos consolidar o inventário teórico completo,
              comparando com o bloco H e destacando divergências, rupturas e
              itens fora do esperado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

