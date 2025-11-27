"use client";

import { useState, useEffect } from "react";
import AdjustmentsTable from "./AdjustmentsTable";
import AdjustmentsSummaryCard from "./AdjustmentsSummaryCard";

interface Adjustment {
  id: string;
  cod_negativo: string;
  cod_positivo: string;
  qtd_baixada: number;
  unit_cost: number;
  total_value: number;
  created_at: string;
}

interface AdjustmentsPageClientProps {
  spedFileId: string;
  fileName: string;
  initialAdjustments: Adjustment[];
}

export default function AdjustmentsPageClient({
  spedFileId,
  fileName,
  initialAdjustments,
}: AdjustmentsPageClientProps) {
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initialAdjustments);

  // Sincronizar ajustes iniciais quando mudarem (ex: mudança de arquivo SPED)
  useEffect(() => {
    setAdjustments(initialAdjustments);
  }, [initialAdjustments]);

  const handleAdjustmentsChange = (newAdjustments: Adjustment[]) => {
    setAdjustments(newAdjustments);
  };

  return (
    <>
      {/* Card de resumo - atualizado em tempo real */}
      <AdjustmentsSummaryCard adjustments={adjustments} />

      {/* Tabela de ajustes */}
      <AdjustmentsTable
        spedFileId={spedFileId}
        fileName={fileName}
        initialAdjustments={initialAdjustments}
        onAdjustmentsChange={handleAdjustmentsChange}
      />
    </>
  );
}

