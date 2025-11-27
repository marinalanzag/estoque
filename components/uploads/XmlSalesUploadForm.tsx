"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SpedFile {
  id: string;
  name: string;
  uploaded_at: string;
}

interface Pendencia {
  chNFe: string | null;
  motivo: string;
}

interface XmlImport {
  id: string;
  label: string;
  sped_file_id: string;
  total_xmls: number;
  total_items: number;
  created_at: string;
  period_id: string | null;
  sped_files: {
    name: string;
  } | null;
}

interface GroupedXmlImport {
  key: string;
  sped_file_id: string;
  sped_name: string | null;
  date: string;
  imports: XmlImport[];
  total_xmls: number;
  total_items: number;
  all_linked: boolean;
  import_ids: string[];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

interface XmlSalesUploadFormInnerProps {
  hideHeader?: boolean;
  hideFooter?: boolean;
  variant?: "standalone" | "embedded";
}

function XmlSalesUploadFormInner({
  hideHeader = false,
  hideFooter = false,
  variant = "standalone",
}: XmlSalesUploadFormInnerProps) {
  const searchParams = useSearchParams();
  const fileIdFromUrl = searchParams.get("fileId");

  const [mode, setMode] = useState<"upload" | "select">("upload");
  const [spedFiles, setSpedFiles] = useState<SpedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>(
    fileIdFromUrl || ""
  );
  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<number>(0);
  const [totalBatches, setTotalBatches] = useState<number>(0);
  const [result, setResult] = useState<{
    total_xml: number;
    total_xml_processados: number;
    total_itens_inseridos: number;
    pendencias: Pendencia[];
  } | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [xmlImports, setXmlImports] = useState<XmlImport[]>([]);
  const [groupedImports, setGroupedImports] = useState<GroupedXmlImport[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string>("");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");
  const [loadingImports, setLoadingImports] = useState(false);

  useEffect(() => {
    async function fetchSpedFiles() {
      try {
        setLoadingError(null);
        
        // Adicionar timeout e melhor tratamento de erro
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos
        
        let res: Response;
        try {
          res = await fetch("/api/sped/list", {
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
            },
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError instanceof Error) {
            if (fetchError.name === 'AbortError') {
              throw new Error("Timeout: A requisição demorou muito para responder. Verifique se o servidor está funcionando.");
            }
            if (fetchError.message.includes("Failed to fetch") || 
                fetchError.message.includes("Load failed") ||
                fetchError.message.includes("NetworkError")) {
              throw new Error(
                "Não foi possível conectar ao servidor. " +
                "Isso pode indicar: (1) Variáveis de ambiente não configuradas no Vercel, " +
                "(2) Problema de rede, ou (3) A rota de API não está disponível. " +
                "Verifique os logs do Vercel para mais detalhes."
              );
            }
            throw fetchError;
          }
          throw new Error("Erro desconhecido ao fazer requisição");
        }
        
        if (!res.ok) {
          let errorData: any = {};
          try {
            errorData = await res.json();
          } catch {
            // Se não conseguir parsear JSON, usar o texto da resposta
            const text = await res.text().catch(() => "");
            throw new Error(`Erro ${res.status}: ${res.statusText}${text ? ` - ${text.substring(0, 200)}` : ""}`);
          }
          
          const errorMessage = errorData.error || errorData.detail || `Erro ${res.status}: ${res.statusText}`;
          const errorDetail = errorData.detail ? `\n\nDetalhes: ${errorData.detail}` : "";
          throw new Error(`${errorMessage}${errorDetail}`);
        }
        
        const data = await res.json();
        if (data.ok && Array.isArray(data.files)) {
          setSpedFiles(data.files);
        } else {
          setSpedFiles([]);
        }
      } catch (error) {
        console.error("Erro ao buscar arquivos SPED:", error);
        if (error instanceof Error) {
          setLoadingError(error.message);
        } else {
          setLoadingError("Erro desconhecido ao carregar arquivos SPED.");
        }
      }
    }
    fetchSpedFiles();
  }, []);

  useEffect(() => {
    if (mode === "select") {
      loadXmlImports();
    }
  }, [mode]);

  const loadXmlImports = async () => {
    setLoadingImports(true);
    try {
      const res = await fetch("/api/xml-sales/imports");
      const data = await res.json();
      if (data.ok) {
        setXmlImports(data.imports || []);
        setGroupedImports(data.grouped || []);
      }
    } catch (err) {
      console.error("Erro ao carregar imports de XMLs:", err);
    } finally {
      setLoadingImports(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "select") {
      // Modo seleção - vincular import(s) existente(s) ao período
      if (!selectedGroupKey && !selectedImportId) {
        setStatus("Erro: Selecione um grupo ou import de XMLs para vincular ao período");
        return;
      }

      setStatus("Vinculando ao período ativo...");
      setIsLoading(true);

      try {
        let importIds: string[] = [];
        
        if (selectedGroupKey) {
          // Vincular todos os imports do grupo
          const group = groupedImports.find(g => g.key === selectedGroupKey);
          if (group) {
            importIds = group.import_ids;
          }
        } else if (selectedImportId) {
          // Vincular apenas o import selecionado
          importIds = [selectedImportId];
        }

        if (importIds.length === 0) {
          setStatus("Erro: Nenhum import selecionado");
          setIsLoading(false);
          return;
        }

        const res = await fetch("/api/xml-sales/link-period", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importIds }),
        });

        const json = await res.json();
        if (json.ok) {
          const count = json.count || importIds.length;
          setStatus(`${count} import(s) de XMLs vinculado(s) ao período ativo com sucesso!`);
          setSelectedImportId("");
          setSelectedGroupKey("");
          await loadXmlImports();
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
      return;
    }

    // Modo upload - importar novos XMLs
    if (!selectedFileId) {
      setStatus("Erro: Selecione um arquivo SPED");
      return;
    }

    if (files.length === 0) {
      setStatus("Erro: Selecione pelo menos um arquivo XML ou ZIP");
      return;
    }

    // Limitar cada lote para evitar estouro de payload no servidor/edge
    const MAX_FILES_PER_BATCH = 300;
    const filesArray = Array.from(files);
    const batches = chunkArray(filesArray, MAX_FILES_PER_BATCH);

    setTotalBatches(batches.length);
    setCurrentBatch(0);
    setStatus(
      `Iniciando importação de ${files.length} arquivo(s) em ${batches.length} lote(s)...`
    );
    setIsLoading(true);
    setResult(null);

    const totals = {
      totalXmls: 0,
      totalXmlsProcessados: 0,
      totalItensInseridos: 0,
    };
    const pendenciasAcumuladas: Pendencia[] = [];

    try {
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setCurrentBatch(i + 1);
        setStatus(
          `Processando lote ${i + 1} de ${batches.length} (${batch.length} arquivo(s))...`
        );

        let success = false;
        let lastError: Error | null = null;
        const MAX_RETRIES = 2;
        const RETRY_DELAY = 1000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (attempt > 1) {
              setStatus(
                `Tentativa ${attempt} de ${MAX_RETRIES} para lote ${
                  i + 1
                } de ${batches.length}...`
              );
              await new Promise((resolve) =>
                setTimeout(resolve, RETRY_DELAY * (attempt - 1))
              );
            }

            const formData = new FormData();
            formData.append("fileId", selectedFileId);
            if (label.trim()) {
              formData.append("label", label.trim());
            }
            batch.forEach((file) => {
              formData.append("files", file);
            });

            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              600000
            );

            const res = await fetch("/api/sped/import-xml-sales", {
              method: "POST",
              body: formData,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Verificar se a resposta é JSON
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              const text = await res.text();
              const errorMsg = text.length > 0 
                ? text.substring(0, 500)
                : `Resposta inválida do servidor (status ${res.status})`;
              throw new Error(
                `Resposta inválida do servidor no lote ${i + 1}: ${errorMsg}`
              );
            }

            const json = await res.json();

            if (!res.ok) {
              const errorDetail = json.detail ? ` (${json.detail})` : "";
              throw new Error(
                `Erro no lote ${i + 1}: ${json.error || "Erro desconhecido"}${errorDetail}`
              );
            }

            totals.totalXmls += json.totalXmls ?? batch.length;
            totals.totalXmlsProcessados += json.xmlsProcessados ?? 0;
            totals.totalItensInseridos += json.itensInseridos ?? 0;

            if (Array.isArray(json.pendencias)) {
              pendenciasAcumuladas.push(...json.pendencias);
            }

            success = true;
            break;
          } catch (error) {
            lastError =
              error instanceof Error ? error : new Error(String(error));

            if (
              error instanceof Error &&
              (error.name === "AbortError" ||
                error.message.includes("aborted") ||
                error.message.includes("ECONNRESET") ||
                error.message.includes("Failed to fetch") ||
                error.message.includes("Load failed"))
            ) {
              if (attempt < MAX_RETRIES) {
                console.warn(
                  `Tentativa ${attempt} falhou para lote ${i + 1}, tentando novamente...`,
                  error
                );
                continue;
              }
            }

            throw error;
          }
        }

        if (!success && lastError) {
          console.error(
            `Falha ao processar lote ${i + 1} após ${MAX_RETRIES} tentativas:`,
            lastError
          );
          pendenciasAcumuladas.push({
            chNFe: "N/A",
            motivo: `Lote ${i + 1} falhou após ${MAX_RETRIES} tentativas: ${lastError.message}`,
          });
        }

        if (i < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      setStatus("Importação concluída com sucesso!");
      setResult({
        total_xml: totals.totalXmls,
        total_xml_processados: totals.totalXmlsProcessados,
        total_itens_inseridos: totals.totalItensInseridos,
        pendencias: pendenciasAcumuladas,
      });
      setFiles([]);

      const fileInput = document.querySelector(
        `input[type="file"][data-upload-type="xml-${variant}"]`
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch (error) {
      console.error("Erro ao importar XMLs:", error);
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          setStatus("Erro: Importação cancelada por timeout. Tente novamente.");
        } else if (
          error.message.includes("Failed to fetch") ||
          error.message.includes("Load failed") ||
          error.message.includes("NetworkError") ||
          error.name === "TypeError"
        ) {
          setStatus(
            "Erro: Não foi possível conectar ao servidor. Verifique se o servidor está rodando, se as variáveis de ambiente estão configuradas no Vercel, e tente novamente."
          );
        } else {
          setStatus(`Erro: ${error.message}`);
        }
      } else {
        setStatus(`Erro: Erro desconhecido ao importar XMLs`);
      }
    } finally {
      setIsLoading(false);
      setCurrentBatch(0);
      setTotalBatches(0);
    }
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Etapa 3 – Importar XMLs de Vendas
          </h1>
          <p className="text-gray-600 mt-2">
            Faça upload de XMLs de NF-e/NFC-e de venda para preencher os itens de
            saída que faltam no SPED. Os XMLs serão vinculados aos documentos
            C100 pelo número da chave de acesso.
          </p>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Importante:</strong> Os arquivos serão enviados em lotes
              de até 300 arquivos por vez para garantir processamento estável e
              rápido.
              {files.length > 0 && (
                <span className="block mt-1">
                  {files.length} arquivo(s) selecionado(s) serão divididos em{" "}
                  {Math.ceil(files.length / 300)} lote(s).
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {loadingError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-800 font-medium">⚠️ Erro ao carregar arquivos SPED</p>
          <p className="text-red-700 text-sm mt-1">{loadingError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Tentar novamente
          </button>
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
            📋 Usar Import Existente
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "upload" ? (
            <>
              <div>
                <label
                  htmlFor={`sped-file-select-${variant}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Arquivo SPED de destino *
                </label>
                <select
                  id={`sped-file-select-${variant}`}
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading || !!loadingError}
                  required
                >
                  <option value="">Selecione um arquivo SPED...</option>
                  {spedFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name} (
                      {new Date(file.uploaded_at).toLocaleDateString("pt-BR")})
                    </option>
                  ))}
                </select>
                {spedFiles.length === 0 && !loadingError && (
                  <p className="mt-1 text-sm text-gray-500">
                    Nenhum arquivo SPED encontrado. Importe um arquivo SPED primeiro.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label
                  htmlFor={`select-xml-import-group-${variant}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Selecione um grupo de imports de XMLs (agrupados por SPED e data)
                </label>
                {loadingImports ? (
                  <p className="text-sm text-gray-500">Carregando imports...</p>
                ) : groupedImports.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum import de XMLs encontrado. Use a aba "Importar Novo Arquivo" para criar um.
                  </p>
                ) : (
                  <select
                    id={`select-xml-import-group-${variant}`}
                    value={selectedGroupKey}
                    onChange={(e) => {
                      setSelectedGroupKey(e.target.value);
                      setSelectedImportId(""); // Limpar seleção individual
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    disabled={isLoading}
                  >
                    <option value="">Selecione um grupo de imports...</option>
                    {groupedImports.map((group) => {
                      const dateStr = new Date(group.date).toLocaleDateString("pt-BR");
                      const importCount = group.imports.length;
                      return (
                        <option key={group.key} value={group.key}>
                          {group.sped_name || "SPED desconhecido"} - {dateStr} - {group.total_xmls} XMLs, {group.total_items} itens
                          {importCount > 1 && ` (${importCount} imports)`}
                          {group.all_linked && " (todos vinculados)"}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedGroupKey && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-xs text-gray-600 mb-2">
                      <strong>Detalhes do grupo selecionado:</strong>
                    </p>
                    {(() => {
                      const group = groupedImports.find(g => g.key === selectedGroupKey);
                      if (!group) return null;
                      return (
                        <div className="space-y-1 text-xs text-gray-600">
                          <p>• <strong>{group.imports.length}</strong> import(s) neste grupo</p>
                          <p>• Total: <strong>{group.total_xmls}</strong> XMLs, <strong>{group.total_items}</strong> itens</p>
                          <p>• SPED: <strong>{group.sped_name || "N/A"}</strong></p>
                          <p>• Data: <strong>{new Date(group.date).toLocaleDateString("pt-BR")}</strong></p>
                          {group.all_linked && (
                            <p className="text-green-600">✓ Todos os imports deste grupo já estão vinculados ao período</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </>
          )}

          {mode === "upload" && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <label
                  htmlFor={`import-label-${variant}`}
                  className="block text-sm font-medium text-blue-900 mb-2"
                >
                  Referência da importação (opcional, mas recomendado)
                </label>
                <input
                  id={`import-label-${variant}`}
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Importação Janeiro 2025, XMLs de Vendas Jan/2025"
                  className="block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-blue-700">
                  💡 Identifique esta importação para facilitar a seleção posterior na página de saídas
                </p>
              </div>

              <div>
                <label
                  htmlFor={`xml-files-input-${variant}`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Arquivos XML ou ZIP *
                </label>
                <input
                  id={`xml-files-input-${variant}`}
                  data-upload-type={`xml-${variant}`}
                  type="file"
                  accept=".xml,.zip"
                  multiple
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    border border-gray-300 rounded-md"
                  disabled={isLoading}
                  required
                />
                {files.length > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    {files.length} arquivo(s) selecionado(s)
                    {files.length > 300 && (
                      <span className="text-blue-600 font-medium">
                        {" "}
                        • Serão enviados em {Math.ceil(files.length / 300)} lote(s)
                        de até 300 arquivos cada
                      </span>
                    )}
                    <span className="block mt-1 text-xs text-gray-500">
                      ⚡ Processamento otimizado: cada lote processa até 300 arquivos
                      para máxima velocidade
                    </span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                disabled={!selectedFileId || files.length === 0 || isLoading}
              >
                {isLoading
                  ? `Importando lote ${currentBatch}/${totalBatches}...`
                  : "Importar XMLs de Venda"}
              </button>
            </>
          )}

          {mode === "select" && (
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              disabled={(!selectedGroupKey && !selectedImportId) || isLoading || loadingImports}
            >
              {isLoading ? "Vinculando..." : selectedGroupKey ? "Vincular Todos os Imports do Grupo" : "Vincular ao Período Ativo"}
            </button>
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
          {isLoading && totalBatches > 0 && (
            <>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentBatch / totalBatches) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs mt-1 text-gray-600">
                  Progresso: {currentBatch} de {totalBatches} lote(s)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {result && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">Resultado da Importação</h3>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Total de XMLs:</span>{" "}
              {result.total_xml}
            </p>
            <p>
              <span className="font-medium">XMLs processados:</span>{" "}
              {result.total_xml_processados}
            </p>
            <p>
              <span className="font-medium">Itens inseridos:</span>{" "}
              {result.total_itens_inseridos}
            </p>
            {result.pendencias && result.pendencias.length > 0 && (
              <div>
                <p className="font-medium text-orange-700">
                  Pendências ({result.pendencias.length}):
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs text-gray-600 max-h-40 overflow-y-auto">
                  {result.pendencias.slice(0, 20).map((p, idx) => (
                    <li key={`${p.chNFe ?? "N/A"}-${idx}`}>
                      {p.chNFe && p.chNFe !== "N/A"
                        ? `${p.chNFe.substring(0, 10)}...`
                        : "N/A"}
                      : {p.motivo}
                    </li>
                  ))}
                  {result.pendencias.length > 20 && (
                    <li className="text-gray-500">
                      ... e mais {result.pendencias.length - 20} pendência(s)
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {!hideFooter && (
        <div className="mt-6 space-y-2">
          <Link
            href="/sped"
            className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Ver arquivos SPED
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

export default function XmlSalesUploadForm(props: XmlSalesUploadFormInnerProps) {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto p-6">Carregando...</div>}>
      <XmlSalesUploadFormInner {...props} />
    </Suspense>
  );
}

