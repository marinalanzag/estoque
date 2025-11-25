"use client";

import { useState } from "react";
import Link from "next/link";

interface SpedUploadFormProps {
  hideHeader?: boolean;
  hideFooter?: boolean;
  variant?: "standalone" | "embedded";
}

export default function SpedUploadForm({
  hideHeader = false,
  hideFooter = false,
  variant = "standalone",
}: SpedUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <form onSubmit={handleSubmit} className="space-y-4">
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

