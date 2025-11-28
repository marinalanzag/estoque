"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initialAdjustments);

  // Sincronizar ajustes iniciais quando mudarem (ex: mudança de arquivo SPED ou refresh da página)
  useEffect(() => {
    console.log("[AdjustmentsPageClient] initialAdjustments atualizados:", initialAdjustments.length);
    setAdjustments(initialAdjustments);
  }, [initialAdjustments]);

  const handleAdjustmentsChange = useCallback((newAdjustments: Adjustment[]) => {
    console.log("[AdjustmentsPageClient] Ajustes atualizados via callback:", newAdjustments.length);
    setAdjustments(newAdjustments);
  }, []);

  // Função para forçar refresh da página (buscar dados do servidor)
  const handleRefresh = useCallback(() => {
    console.log("[AdjustmentsPageClient] Forçando refresh da página...");
    router.refresh();
  }, [router]);

  // Recarregar quando a página recebe foco (usuário volta para a aba)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("[AdjustmentsPageClient] Página visível novamente, recarregando...");
        router.refresh();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [router]);

  return (
    <>
      {/* Card de resumo - atualizado em tempo real */}
      <AdjustmentsSummaryCard adjustments={adjustments} />

      {/* Tabela de ajustes */}
      <AdjustmentsTable
        spedFileId={spedFileId}
        fileName={fileName}
        initialAdjustments={initialAdjustments} // Passar initialAdjustments do servidor
        onAdjustmentsChange={handleAdjustmentsChange}
        onRefresh={handleRefresh} // Passar função de refresh
      />
    </>
  );
}

