import { getAllPeriods, getActivePeriod, type Period } from "@/lib/periods";
import PeriodSelectorClient from "./PeriodSelectorClient";

/**
 * Server Component wrapper para PeriodSelector
 * Busca períodos no servidor e passa como props para o Client Component
 */
export default async function PeriodSelectorServer() {
  let periods: Period[] = [];
  let activePeriod: Period | null = null;
  
  try {
    periods = await getAllPeriods();
  } catch (error) {
    console.error("[PeriodSelectorServer] Erro ao buscar períodos:", error);
    // Continuar com array vazio em caso de erro
    periods = [];
  }
  
  try {
    activePeriod = await getActivePeriod();
  } catch (error) {
    console.error("[PeriodSelectorServer] Erro ao buscar período ativo:", error);
    // Continuar com null em caso de erro
    activePeriod = null;
  }

  // Sempre renderizar o componente, mesmo com dados vazios
  return (
    <PeriodSelectorClient
      initialPeriods={periods}
      initialActivePeriod={activePeriod}
    />
  );
}

