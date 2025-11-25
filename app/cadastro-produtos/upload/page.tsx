"use client";

import { useState } from "react";
import Link from "next/link";

export default function CadastroProdutosUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus("Erro: Selecione um arquivo");
      return;
    }

    setIsLoading(true);
    setStatus("Importando cadastro...");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/product-catalog/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("Importação concluída com sucesso!");
        setResult(data);
      } else {
        setStatus(`Erro: ${data.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      setStatus(
        `Erro: ${err instanceof Error ? err.message : "Erro ao importar"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Importar Cadastro de Produtos
        </h1>
        <p className="text-gray-600">
          Importe um cadastro fixo de produtos que será usado como fallback
          para preencher descrições quando não encontradas no SPED.
        </p>
      </div>

      {/* Card de upload */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arquivo de Cadastro *
            </label>
            <input
              type="file"
              accept=".txt,.csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              Formatos aceitos: TXT, CSV, XLSX
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">
              Formato esperado:
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>
                <strong>TXT:</strong> Formato SPED (|0200|CODIGO|DESCRICAO|UNID|...)
                ou simples (CODIGO|DESCRICAO|UNID)
              </li>
              <li>
                <strong>CSV/XLSX:</strong> Colunas: código, descrição, unidade
                (opcional)
              </li>
              <li>
                O código será normalizado automaticamente para 6 dígitos
              </li>
              <li>
                Produtos existentes serão atualizados, novos serão inseridos
              </li>
            </ul>
          </div>

          {status && (
            <div
              className={`p-4 rounded-md ${
                status.includes("Erro")
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-green-50 border border-green-200 text-green-700"
              }`}
            >
              <p>{status}</p>
              {result && (
                <div className="mt-2 text-sm">
                  <p>
                    <strong>Total de registros:</strong> {result.total_registros}
                  </p>
                  <p>{result.mensagem}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading || !file}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? "Importando..." : "Importar Cadastro"}
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
            >
              Voltar ao Dashboard
            </Link>
          </div>
        </form>
      </div>

      {/* Informações adicionais */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-900 mb-2">Importante</h3>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>
            Este cadastro é global e será usado em todos os SPEDs importados
          </li>
          <li>
            Quando um produto não tiver descrição no SPED, o sistema buscará
            neste cadastro
          </li>
          <li>
            Você pode importar o cadastro quantas vezes quiser - produtos
            existentes serão atualizados
          </li>
        </ul>
      </div>
    </div>
  );
}

