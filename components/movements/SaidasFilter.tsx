"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface SpedFile {
  id: string;
  name: string;
  uploaded_at: string;
}

interface XmlImport {
  id: string;
  label: string | null;
  total_xmls: number;
  total_items: number;
  created_at: string;
}

interface SaidasFilterProps {
  spedFiles: SpedFile[];
  xmlImports: XmlImport[] | null;
  selectedFileId: string;
  selectedImportIds: string[] | null;
}

export default function SaidasFilter({
  spedFiles,
  xmlImports,
  selectedFileId,
  selectedImportIds,
}: SaidasFilterProps) {
  const router = useRouter();
  const [fileId, setFileId] = useState(selectedFileId);
  const [importIds, setImportIds] = useState<string[]>(
    selectedImportIds || []
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const params = new URLSearchParams();
    params.set("fileId", fileId);

    if (importIds.length > 0) {
      importIds.forEach((id) => {
        params.append("importId", id);
      });
    }

    router.push(`/movimentacoes/saidas?${params.toString()}`);
  };

  const handleImportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions);
    const values = selectedOptions.map((option) => option.value);
    
    // Se "Todas as importações" (valor vazio) estiver selecionado, limpar outras seleções
    if (values.includes("")) {
      setImportIds([]);
    } else {
      setImportIds(values);
    }
  };

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
            Importação de XMLs (segure Ctrl/Cmd para selecionar múltiplas)
          </label>
          {xmlImports && xmlImports.length > 0 ? (
            <select
              multiple
              size={Math.min(xmlImports.length + 1, 10)}
              value={importIds}
              onChange={handleImportChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">Todas as importações</option>
              {xmlImports.map((imp) => (
                <option key={imp.id} value={imp.id}>
                  {imp.label || "Sem descrição"} -{" "}
                  {new Date(imp.created_at).toLocaleString("pt-BR")} (
                  {imp.total_xmls} XMLs, {imp.total_items} itens)
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500 py-2">
              Nenhuma importação encontrada
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

