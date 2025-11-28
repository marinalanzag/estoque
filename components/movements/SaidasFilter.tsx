"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface SpedFile {
  id: string;
  name: string;
  uploaded_at: string;
}

interface GroupedXmlImport {
  key: string;
  sped_file_id: string;
  sped_name: string | null;
  date: string;
  imports: Array<{
    id: string;
    label: string | null;
    total_xmls: number;
    total_items: number;
    created_at: string;
    period_id: string | null;
    sped_file_id: string | null;
  }>;
  total_xmls: number;
  total_items: number;
  all_linked: boolean;
  import_ids: string[];
}

interface SaidasFilterProps {
  spedFiles: SpedFile[];
  groupedXmlImports: GroupedXmlImport[];
  selectedFileId: string;
  selectedGroupKey: string | null;
  selectedImportIds: string[] | null;
  activePeriod?: { id: string } | null;
  hasBase?: boolean;
}

export default function SaidasFilter({
  spedFiles,
  groupedXmlImports,
  selectedFileId,
  selectedGroupKey,
  selectedImportIds,
  activePeriod,
  hasBase = false,
}: SaidasFilterProps) {
  const router = useRouter();
  const [fileId, setFileId] = useState(selectedFileId);
  const [groupKey, setGroupKey] = useState<string>(selectedGroupKey || "");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const params = new URLSearchParams();
    params.set("fileId", fileId);

    if (groupKey) {
      params.set("groupKey", groupKey);
    }

    const persistSelection = () => {
      if (typeof document === "undefined") return;
      const maxAge = 60 * 60 * 24 * 365;

      if (!groupKey && (!selectedImportIds || selectedImportIds.length === 0)) {
        document.cookie = `selectedXmlGroupKey=; path=/; max-age=0`;
        document.cookie = `selectedXmlImportIds=; path=/; max-age=0`;
        return;
      }

      const group = groupKey
        ? groupedXmlImports.find((g) => g.key === groupKey)
        : null;
      const importIds = group
        ? group.import_ids
        : selectedImportIds && selectedImportIds.length > 0
        ? selectedImportIds
        : [];

      if (groupKey) {
        document.cookie = `selectedXmlGroupKey=${encodeURIComponent(
          groupKey
        )}; path=/; max-age=${maxAge}`;
      }
      document.cookie = `selectedXmlImportIds=${encodeURIComponent(
        importIds.join(",")
      )}; path=/; max-age=${maxAge}`;
    };

    persistSelection();

    router.push(`/movimentacoes/saidas?${params.toString()}`);
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGroupKey(e.target.value);
  };

  if (hasBase && activePeriod) {
    // Quando há base, mostrar apenas informações
    const selectedFile = spedFiles.find((f) => f.id === selectedFileId);
    const baseGroups = groupedXmlImports.filter((group) =>
      selectedImportIds?.some((id) => group.import_ids.includes(id))
    );
    
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Período ativo:</span>
            <span>{activePeriod.id}</span>
          </div>
          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">SPED:</span>
              <span>{selectedFile.name}</span>
            </div>
          )}
          {baseGroups.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">XMLs base:</span>
              <span>
                {baseGroups.length} grupo(s) • {selectedImportIds?.length || 0} importação(ões)
              </span>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">
            Para alterar a base, acesse a{" "}
            <a
              href="/periodos/configuracao"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              página de configuração
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arquivo SPED
          </label>
          <select
            value={fileId}
            onChange={(e) => setFileId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            {spedFiles.map((file) => (
              <option key={file.id} value={file.id}>
                {file.name} (
                {new Date(file.uploaded_at).toLocaleDateString("pt-BR")})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Grupo de Importações de XMLs (agrupados por SPED e data)
          </label>
          {groupedXmlImports && groupedXmlImports.length > 0 ? (
            <select
              value={groupKey}
              onChange={handleGroupChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">Todas as importações do período</option>
              {groupedXmlImports.map((group) => {
                const dateStr = new Date(group.date).toLocaleDateString("pt-BR");
                const importCount = group.imports.length;
                return (
                  <option key={group.key} value={group.key}>
                    {group.sped_name || "SPED desconhecido"} - {dateStr} - {group.total_xmls} XMLs, {group.total_items} itens
                    {importCount > 1 && ` (${importCount} imports)`}
                    {group.all_linked && " ✓ vinculado"}
                  </option>
                );
              })}
            </select>
          ) : (
            <p className="text-sm text-gray-500 py-2">
              Nenhum grupo de importação encontrado para o período ativo
            </p>
          )}
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Filtrar
          </button>
        </div>
      </form>
    </div>
  );
}

