"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SpedUploadFormProps {
  hideHeader?: boolean;
  hideFooter?: boolean;
  variant?: "standalone" | "embedded";
}

interface SpedFile {
  id: string;
  name: string;
  uploaded_at: string;
  period_id: string | null;
}

export default function SpedUploadForm({
  hideHeader = false,
  hideFooter = false,
  variant = "standalone",
}: SpedUploadFormProps) {
  const [mode, setMode] = useState<"upload" | "select">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [spedFiles, setSpedFiles] = useState<SpedFile[]>([]);
  const [selectedSpedFileId, setSelectedSpedFileId] = useState<string>("");
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    if (mode === "select") {
      loadSpedFiles();
    }
  }, [mode]);

  const loadSpedFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch("/api/sped/list");
      const data = await res.json();
      if (data.ok) {
        setSpedFiles(data.files || []);
      }
    } catch (err) {
      console.error("Erro ao carregar arquivos SPED:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "upload") {
      if (!file) return;

      const fd = new FormData();
      fd.append("file", file);

      setStatus("Importando...");
      setIsLoading(true);

      try {
        const res = await fetch("/api/sped/import", {
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
          if (json.resumo) {
            setStatus(
              `Importado com sucesso!\n` +
                `Produtos: ${json.resumo.produtos || 0}\n` +
                `Documentos: ${json.resumo.documentos || 0}\n` +
                `Itens de documento: ${json.resumo.documentItems || 0}\n` +
                `Inventários: ${json.resumo.inventarios || 0}`
            );
          } else {
            setStatus(`Importado com sucesso! ID: ${json.spedFileId}`);
          }
          setFile(null);
          const fileInput = document.querySelector(
            `input[type="file"][data-upload-type="sped-${variant}"]`
          ) as HTMLInputElement | null;
          if (fileInput) fileInput.value = "";
          await loadSpedFiles();
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
      if (!selectedSpedFileId) {
        setStatus("Erro: Selecione um arquivo SPED para vincular ao período");
        return;
      }

      setStatus("Vinculando ao período ativo...");
      setIsLoading(true);

      try {
        const res = await fetch("/api/sped/link-period", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spedFileId: selectedSpedFileId }),
        });

        const json = await res.json();
        if (json.ok) {
          setStatus("Arquivo SPED vinculado ao período ativo com sucesso!");
          setSelectedSpedFileId("");
          await loadSpedFiles();
        } else {
          setStatus(`Erro: ${json.error || "Erro desconhecido"}`);
        }
      } catch (error) {
        console.error("Erro ao vincular SPED:", error);
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
            Etapa 2 – Importar SPED
          </h1>
          <p className="text-gray-600 mt-2">
            Importe o arquivo .txt do SPED EFD ICMS/IPI contendo os blocos C
            (documentos), H (inventário) etc.
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
                  htmlFor={`sped-input-${variant}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Selecione o arquivo SPED (.txt)
                </label>
                <input
                  id={`sped-input-${variant}`}
                  data-upload-type={`sped-${variant}`}
                  type="file"
                  accept=".txt"
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
                {isLoading ? "Importando..." : "Importar"}
              </button>
            </>
          ) : (
            <>
              <div>
                <label
                  htmlFor={`select-sped-${variant}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Selecione um arquivo SPED existente
                </label>
                {loadingFiles ? (
                  <p className="text-sm text-gray-500">Carregando arquivos...</p>
                ) : spedFiles.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum arquivo SPED encontrado. Use a aba &quot;Importar Novo Arquivo&quot; para criar um.
                  </p>
                ) : (
                  <select
                    id={`select-sped-${variant}`}
                    value={selectedSpedFileId}
                    onChange={(e) => setSelectedSpedFileId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    disabled={isLoading}
                  >
                    <option value="">Selecione um arquivo SPED...</option>
                    {spedFiles.map((spedFile) => (
                      <option key={spedFile.id} value={spedFile.id}>
                        {spedFile.name} ({new Date(spedFile.uploaded_at).toLocaleDateString("pt-BR")})
                        {spedFile.period_id && " (já vinculado)"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                disabled={!selectedSpedFileId || isLoading || loadingFiles}
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
          <p className="font-medium whitespace-pre-line">{status}</p>
        </div>
      )}

      {!hideFooter && (
        <div className="mt-6 space-y-2">
          <Link
            href="/sped"
            className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Ver arquivos SPED importados
          </Link>
          <div>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
            >
              ← Voltar ao dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

