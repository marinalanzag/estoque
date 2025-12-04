"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SetBaseButtonProps {
  type: "stock" | "sped" | "xml";
  id: string;
  isBase: boolean;
  label: string;
}

export default function SetBaseButton({
  type,
  id,
  isBase,
  label,
}: SetBaseButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setIsLoading(true);

    try {
      let endpoint = "";
      let body: any = {};

      if (type === "stock") {
        endpoint = "/api/stock-initial/set-base";
        body = { stockImportId: id, isBase: !isBase };
      } else if (type === "sped") {
        endpoint = "/api/sped/set-base";
        body = { spedFileId: id, isBase: !isBase };
      } else if (type === "xml") {
        endpoint = "/api/xml-sales/set-base";
        body = { xmlImportId: id, isBase: !isBase };
      } else {
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Erro: ${error.error || "Erro ao atualizar base"}`);
        return;
      }

      // Recarregar a página para atualizar os dados
      router.refresh();
    } catch (error) {
      console.error("Erro ao atualizar base:", error);
      alert("Erro ao atualizar base. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`px-3 py-1.5 text-sm rounded-md font-medium ${
        isBase
          ? "bg-gray-600 text-white hover:bg-gray-700"
          : "bg-green-600 text-white hover:bg-green-700"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isLoading ? "..." : label}
    </button>
  );
}






