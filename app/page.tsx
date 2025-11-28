import { redirect } from "next/navigation";
import { getActivePeriodFromRequest } from "@/lib/periods";

/**
 * Página inicial redireciona para a página de configuração do período
 * ou para movimentações se não houver período ativo
 */
export default async function HomePage() {
  const activePeriod = await getActivePeriodFromRequest();

  if (activePeriod) {
    redirect("/periodos/configuracao");
  } else {
    redirect("/movimentacoes/consolidado");
  }
}
