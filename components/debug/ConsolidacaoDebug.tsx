"use client";

import { useEffect, useState } from "react";

interface DebugInfo {
  totalValorEntradas: number;
  totalValorConsolidacao: number;
  diferenca: number;
  percentualDiferenca: number;
  codItemsComDiferenca: Array<{
    cod_item: string;
    valorEntradas: number;
    valorConsolidacao: number;
    diffValor: number;
  }>;
  codItemsFaltando: Array<{
    cod_item: string;
    valor: number;
    qty: number;
  }>;
}

export default function ConsolidacaoDebug() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Os logs estão no servidor, mas podemos criar uma API route para buscar os dados
    // Por enquanto, vamos apenas mostrar instruções
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Carregando informações de debug...</div>;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 shadow-lg max-w-md z-50">
      <h3 className="font-bold text-yellow-900 mb-2">🔍 Como ver os logs de debug:</h3>
      <ol className="list-decimal list-inside space-y-2 text-sm text-yellow-800">
        <li>
          <strong>Abra o terminal</strong> onde você rodou <code className="bg-yellow-100 px-1 rounded">npm run dev</code>
        </li>
        <li>
          <strong>Acesse a página Consolidação</strong> no navegador
        </li>
        <li>
          <strong>Os logs aparecerão no terminal</strong>, não no console do navegador
        </li>
        <li>
          Procure por seções como:
          <ul className="list-disc list-inside ml-4 mt-1">
            <li>📊 COMPARAÇÃO DE TOTAIS GERAIS</li>
            <li>🔍 ANÁLISE: Identificando itens faltando</li>
            <li>📊 TOP 20 CÓDIGOS COM MAIOR DIFERENÇA</li>
          </ul>
        </li>
      </ol>
      <div className="mt-4 p-2 bg-yellow-100 rounded text-xs">
        <strong>Dica:</strong> Use <code className="bg-yellow-200 px-1 rounded">Ctrl+F</code> no terminal para buscar por "DIFERENÇA" ou "TOP 20"
      </div>
    </div>
  );
}


