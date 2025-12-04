"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LinkPeriodButtonProps {
  type: "stock";
  id: string;
  label?: string;
}

export default function LinkPeriodButton({
  type,
  id,
  label = "Vincular ao Período",
}: LinkPeriodButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    if (!confirm("Deseja vincular este arquivo ao período ativo?")) {
      return;
    }

    setIsLoading(true);

    try {
      let endpoint = "";
      let body: any = {};

      if (type === "stock") {
        endpoint = "/api/stock-initial/link-period";
        body = { importId: id };
      } else {
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(`Erro: ${data.error || "Erro ao vincular ao período"}`);
        return;
      }

      // Disparar evento para recarregar períodos
      window.dispatchEvent(new CustomEvent('period:linked'));
      
      // Recarregar a página para atualizar os dados
      router.refresh();
    } catch (error) {
      console.error("Erro ao vincular ao período:", error);
      alert("Erro ao vincular ao período. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="px-3 py-1.5 text-sm rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? "Vinculando..." : label}
    </button>
  );
}

