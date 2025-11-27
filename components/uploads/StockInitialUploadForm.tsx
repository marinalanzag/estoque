"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface StockInitialUploadFormProps {
  hideHeader?: boolean;
  hideFooter?: boolean;
  variant?: "standalone" | "embedded";
}

interface StockImport {
  id: string;
  label: string;
  total_items: number;
  total_value: number;
  created_at: string;
  period_id: string | null;
}

export default function StockInitialUploadForm({
  hideHeader = false,
  hideFooter = false,
  variant = "standalone",
}: StockInitialUploadFormProps) {
  const [mode, setMode] = useState<"upload" | "select">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imports, setImports] = useState<StockImport[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string>("");
  const [loadingImports, setLoadingImports] = useState(false);

  useEffect(() => {
    if (mode === "select") {
      loadImports();
    }
  }, [mode]);

  const loadImports = async () => {
    setLoadingImports(true);
    try {
      const res = await fetch("/api/stock-initial/imports");
      const data = await res.json();
      if (data.ok) {
        setImports(data.imports || []);
      }
    } catch (err) {
      console.error("Erro ao carregar imports:", err);
    } finally {
      setLoadingImports(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "upload") {
      if (!file) return;

      const fd = new FormData();
      fd.append("file", file);
      if (label.trim()) {
        fd.append("label", label.trim());
      }

      setStatus("Importando...");
      setIsLoading(true);

      try {
        const res = await fetch("/api/stock-initial/import", {
          method: "POST",
          body: fd,
        });

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          setStatus(
            `Erro: A API retornou HTML em vez de JSON. Status: ${res.status}. Verifique o console do servidor.`
          );
          console.error("Resposta não-JSON:", text.substring(0, 500));
          return;
        }

        const json = await res.json();
        if (res.ok) {
          setStatus(
            `Estoque inicial importado com sucesso! Registros: ${
              json.count || 0
            }`
          );
          setFile(null);
          setLabel("");
          const fileInput = document.querySelector(
            `input[type="file"][data-upload-type="stock-initial-${variant}"]`
          ) as HTMLInputElement | null;
          if (fileInput) fileInput.value = "";
          await loadImports();
        } else {
          setStatus(`Erro: ${json.error || "Erro desconhecido"}`);
          console.error("Erro da API:", json);
        }
      } catch (error) {
        console.error("Erro ao importar:", error);
        setStatus(
          `Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`
        );
      } finally {
        setIsLoading(false);
      }
    } else {
      // Modo seleção
      if (!selectedImportId) {
        setStatus("Erro: Selecione um import para vincular ao período");
        return;
      }

      setStatus("Vinculando ao período ativo...");
      setIsLoading(true);

      try {
        const res = await fetch("/api/stock-initial/link-period", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importId: selectedImportId }),
        });

        const json = await res.json();
        if (json.ok) {
          setStatus("Import vinculado ao período ativo com sucesso!");
          setSelectedImportId("");
          await loadImports();
        } else {
          setStatus(`Erro: ${json.error || "Erro desconhecido"}`);
        }
      } catch (error) {
        console.error("Erro ao vincular import:", error);
        setStatus(
          `Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Etapa 1 – Importar Estoque Inicial
          </h1>
          <p className="text-gray-600 mt-2">
            Importe o estoque inicial através de arquivo TXT (formato SPED Bloco
            H010) ou planilha (.xlsx / .csv)
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {/* Abas */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              mode === "upload"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📤 Importar Novo Arquivo
          </button>
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              mode === "select"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📋 Usar Arquivo Existente
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "upload" ? (
            <>
              <div>
                <label
                  htmlFor={`stock-initial-label-${variant}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Referência (ex: Jan/2022)
                </label>
                <input
                  id={`stock-initial-label-${variant}`}
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Digite o período ou identificação da importação"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor={`stock-initial-input-${variant}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Selecione o arquivo (.txt, .csv ou .xlsx)
                </label>
                <input
                  id={`stock-initial-input-${variant}`}
                  data-upload-type={`stock-initial-${variant}`}
                  type="file"
                  accept=".txt,.csv,.xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    border border-gray-300 rounded-md"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                disabled={!file || isLoading}
              >
                {isLoading ? "Importando..." : "Importar estoque inicial"}
              </button>
            </>
          ) : (
            <>
              <div>
                <label
                  htmlFor={`select-import-${variant}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Selecione um import existente
                </label>
                {loadingImports ? (
                  <p className="text-sm text-gray-500">Carregando imports...</p>
                ) : imports.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum import encontrado. Use a aba "Importar Novo Arquivo" para criar um.
                  </p>
                ) : (
                  <select
                    id={`select-import-${variant}`}
                    value={selectedImportId}
                    onChange={(e) => setSelectedImportId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    disabled={isLoading}
                  >
                    <option value="">Selecione um import...</option>
                    {imports.map((imp) => (
                      <option key={imp.id} value={imp.id}>
                        {imp.label || `Import ${new Date(imp.created_at).toLocaleDateString("pt-BR")}`} - {imp.total_items} itens
                        {imp.period_id && " (já vinculado)"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                disabled={!selectedImportId || isLoading || loadingImports}
              >
                {isLoading ? "Vinculando..." : "Vincular ao Período Ativo"}
              </button>
            </>
          )}
        </form>
      </div>

      {status && (
        <div
          className={`p-4 rounded-md ${
            status.includes("sucesso")
              ? "bg-green-50 text-green-800 border border-green-200"
              : status.includes("Erro")
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          <p className="font-medium">{status}</p>
        </div>
      )}

      {!hideFooter && (
        <div className="mt-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
          >
            ← Voltar ao dashboard
          </Link>
        </div>
      )}
    </div>
  );
}

