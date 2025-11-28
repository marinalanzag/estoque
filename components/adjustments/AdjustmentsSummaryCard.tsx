"use client";

interface Adjustment {
  id: string;
  cod_negativo: string;
  cod_positivo: string;
  qtd_baixada: number;
  unit_cost: number;
  total_value: number;
  created_at: string;
}

interface AdjustmentsSummaryCardProps {
  adjustments: Adjustment[];
}

export default function AdjustmentsSummaryCard({
  adjustments,
}: AdjustmentsSummaryCardProps) {
  const totalAjustes = adjustments.reduce(
    (acc, adj) => acc + Number(adj.total_value ?? 0),
    0
  );

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-blue-700">Valor total das baixas</p>
          <p className="text-2xl font-semibold text-blue-900">
            {totalAjustes.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-blue-700">Total de ajustes</p>
          <p className="text-2xl font-semibold text-blue-900">
            {adjustments.length}
          </p>
        </div>
      </div>
    </div>
  );
}




