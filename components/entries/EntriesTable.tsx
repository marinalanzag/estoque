"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface EntryRow {
  documentItemId: string;
  nota: string;
  fornecedor: string;
  fornecedorDoc: string | null;
  dataDocumento?: string | null;
  cod_item: string;
  descr_item: string;
  unidade_nf: string | null;
  quantidade_nf: number;
  unidade_produto: string | null;
  fat_conv: number | null;
  qtd_produto: number;
  custo_unitario: number;
  custo_total: number;
  adjusted_qty: number | null;
  sped_file_id: string;
}

interface EntriesTableProps {
  entries: EntryRow[];
  selectedSpedFileId?: string; // ID do SPED selecionado para filtrar o custo total
}

export default function EntriesTable({ entries, selectedSpedFileId }: EntriesTableProps) {
  const [rows, setRows] = useState(entries);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loadingRow, setLoadingRow] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set()); // Itens que foram salvos nesta sessão
  const [searchTerm, setSearchTerm] = useState<string>(""); // Termo de busca

  // Inicializar com valores do servidor
  useEffect(() => {
    console.log(`[EntriesTable] Entries atualizados: ${entries.length} itens`);
    const ajustados = entries.filter(e => e.adjusted_qty !== null && e.adjusted_qty !== undefined);
    console.log(`[EntriesTable] Itens com ajuste: ${ajustados.length}`);
    
    if (ajustados.length > 0) {
      console.log(`[EntriesTable] IDs dos itens com ajuste:`, ajustados.map(a => a.documentItemId).slice(0, 5));
      console.log(`[EntriesTable] Valores dos ajustes:`, ajustados.map(a => ({ id: a.documentItemId, qty: a.adjusted_qty })).slice(0, 5));
    }
    
    setRows(entries);
    const initialValues: Record<string, string> = {};
    entries.forEach((row) => {
      // Sempre usar o valor do servidor se existir
      if (row.adjusted_qty !== null && row.adjusted_qty !== undefined) {
        initialValues[row.documentItemId] = String(row.adjusted_qty);
      } else {
        initialValues[row.documentItemId] = "";
      }
    });
    setEditedValues(initialValues);
  }, [entries]);


  // Calcular custo total apenas dos itens do SPED selecionado
  const totalCusto = useMemo(
    () => {
      if (selectedSpedFileId) {
        // Filtrar apenas itens do SPED selecionado
        return rows
          .filter(row => row.sped_file_id === selectedSpedFileId)
          .reduce((acc, row) => acc + row.custo_total, 0);
      }
      // Se não houver SPED selecionado, somar todos (comportamento anterior)
      return rows.reduce((acc, row) => acc + row.custo_total, 0);
    },
    [rows, selectedSpedFileId]
  );

  // Calcular quantidade NF apenas dos itens do SPED selecionado
  const totalQtdNF = useMemo(
    () => {
      if (selectedSpedFileId) {
        return rows
          .filter(row => row.sped_file_id === selectedSpedFileId)
          .reduce((acc, row) => acc + row.quantidade_nf, 0);
      }
      return rows.reduce((acc, row) => acc + row.quantidade_nf, 0);
    },
    [rows, selectedSpedFileId]
  );

  // Calcular quantidade ajustada apenas dos itens do SPED selecionado
  const totalQtdAjustada = useMemo(() => {
    const rowsToSum = selectedSpedFileId 
      ? rows.filter(row => row.sped_file_id === selectedSpedFileId)
      : rows;
    
    return rowsToSum.reduce((acc, row) => {
      const adjusted = row.adjusted_qty;
      if (adjusted !== null && adjusted !== undefined) {
        return acc + adjusted;
      }
      return acc + row.quantidade_nf;
    }, 0);
  }, [rows, selectedSpedFileId]);

  // Filtrar linhas baseado no termo de busca
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) {
      return rows;
    }
    const term = searchTerm.trim().toUpperCase();
    return rows.filter((row) => 
      row.cod_item.toUpperCase().includes(term) ||
      row.descr_item.toUpperCase().includes(term)
    );
  }, [rows, searchTerm]);

  const handleInputChange = (id: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const saveAdjustment = async (row: EntryRow) => {
    // ============================================================================
    // LOG INICIAL MUITO VISÍVEL
    // ============================================================================
    alert(`🚀 FUNÇÃO saveAdjustment CHAMADA!\nCódigo: ${row.cod_item}\nDocumentItemId: ${row.documentItemId}`);
    console.log("🚀🚀🚀 FUNÇÃO saveAdjustment CHAMADA 🚀🚀🚀");
    console.log("Row recebido:", row);
    
    // ============================================================================
    // VALIDAÇÃO CRÍTICA: Verificar se o documentItemId está correto
    // ============================================================================
    if (!row.documentItemId || typeof row.documentItemId !== 'string' || row.documentItemId.trim() === '') {
      alert("❌ ERRO: documentItemId inválido!");
      console.error("❌❌❌ ERRO CRÍTICO: documentItemId inválido!", row.documentItemId);
      setFeedback("Erro: ID do item inválido. Por favor, recarregue a página.");
      return;
    }
    
    // Verificar se o documentItemId existe na lista de entries
    const entryExists = entries.some(e => e.documentItemId === row.documentItemId);
    
    // Se não existir, mostrar TODOS os itens com o mesmo código
    if (!entryExists) {
      const entriesComMesmoCodigo = entries.filter(e => e.cod_item === row.cod_item);
      const mensagemErro = `❌ ERRO: documentItemId não encontrado!\n\nID usado: ${row.documentItemId}\nCódigo: ${row.cod_item}\n\nItens com código ${row.cod_item} na lista:\n${entriesComMesmoCodigo.map((e, idx) => `${idx + 1}. ID: ${e.documentItemId}\n   Nota: ${e.nota}\n   Qtd NF: ${e.quantidade_nf}`).join('\n\n')}`;
      
      alert(mensagemErro);
      console.error("❌❌❌ ERRO CRÍTICO: documentItemId não encontrado na lista de entries!", {
        documentItemId: row.documentItemId,
        cod_item: row.cod_item,
        nota: row.nota,
        totalEntries: entries.length,
        entriesComMesmoCodigo: entriesComMesmoCodigo.map(e => ({
          documentItemId: e.documentItemId,
          nota: e.nota,
          qtd_nf: e.quantidade_nf
        }))
      });
      setFeedback(`Erro: Item não encontrado na lista. Por favor, recarregue a página.`);
      return;
    }
    
    const rawValue = editedValues[row.documentItemId];
    const parsedValue =
      rawValue === "" || rawValue === undefined ? null : Number(rawValue);

    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      setFeedback("Quantidade inválida.");
      return;
    }

    const tolerance = 1e-6;
    const value =
      parsedValue !== null &&
      Math.abs(parsedValue - row.quantidade_nf) < tolerance
        ? null
        : parsedValue;

    setLoadingRow(row.documentItemId);
    setFeedback(null);

    // ============================================================================
    // LOGS NO FRONTEND PARA DEBUG
    // ============================================================================
    console.error("========================================");
    console.error("🚀🚀🚀 [FRONTEND] SALVANDO AJUSTE 🚀🚀🚀");
    console.error("========================================");
    console.error("[FRONTEND] Row completo:", JSON.stringify(row, null, 2));
    console.error("[FRONTEND]   - documentItemId:", row.documentItemId);
    console.error("[FRONTEND]   - cod_item:", row.cod_item);
    console.error("[FRONTEND]   - qtd_nf:", row.quantidade_nf);
    console.error("[FRONTEND]   - adjustedQty (value):", value);
    console.error("[FRONTEND]   - rawValue:", rawValue);
    console.error("[FRONTEND]   - nota:", row.nota);
    console.error("[FRONTEND]   - fornecedor:", row.fornecedor);
    console.error("[FRONTEND] ✅ Validação: documentItemId existe na lista de entries");
    console.error("========================================");

    try {
      const payload = {
        documentItemId: row.documentItemId,
        adjustedQty: value,
      };
      
      console.error("[FRONTEND] Enviando payload para /api/document-items/adjust:", JSON.stringify(payload, null, 2));
      
      const res = await fetch("/api/document-items/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.error("[FRONTEND] Resposta recebida - status:", res.status, res.statusText);

      const json = await res.json();
      
      console.error("[FRONTEND] Resposta JSON:", JSON.stringify(json, null, 2));

      if (!res.ok) {
        throw new Error(json.error || "Erro ao salvar ajuste");
      }

      // Atualizar estado local IMEDIATAMENTE
      setRows((prev) =>
        prev.map((current) =>
          current.documentItemId === row.documentItemId
            ? { ...current, adjusted_qty: value }
            : current
        )
      );

      // Atualizar valor editado
      setEditedValues((prev) => ({
        ...prev,
        [row.documentItemId]: value !== null ? String(value) : "",
      }));

      // Marcar como salvo
      setSavedItems((prev) => new Set(prev).add(row.documentItemId));

      const qtyDisplay = value !== null 
        ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "removida";
      
      setFeedback(`✓ Ajuste salvo com sucesso! Quantidade ajustada: ${qtyDisplay}. O ajuste foi salvo no banco de dados e persistirá mesmo ao fechar a página.`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error ? error.message : "Erro ao salvar ajuste"
      );
    } finally {
      setLoadingRow(null);
    }
  };

  const resetAdjustment = async (row: EntryRow) => {
    setEditedValues((prev) => ({ ...prev, [row.documentItemId]: "" }));
    await saveAdjustment({ ...row, adjusted_qty: null });
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Custo total (NF)</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totalCusto.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Quantidade NF</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totalQtdNF.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Quantidade ajustada</p>
          <p className="text-2xl font-semibold text-gray-900">
            {totalQtdAjustada.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-md p-3 text-sm ${
            feedback.includes("sucesso") || feedback.includes("salvo")
              ? "bg-green-50 border border-green-200 text-green-800"
              : feedback.includes("Erro") || feedback.includes("erro")
              ? "bg-red-50 border border-red-200 text-red-800"
              : "bg-blue-50 border border-blue-200 text-blue-800"
          }`}
        >
          {feedback}
        </div>
      )}

      {/* Campo de busca */}
      <div className="mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <label
            htmlFor="searchItem"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Buscar por código ou descrição do item
          </label>
          <input
            id="searchItem"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Digite o código ou descrição do item..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          {searchTerm && (
            <p className="mt-2 text-sm text-gray-600">
              Mostrando {filteredRows.length} de {rows.length} itens
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Nota
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Fornecedor
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Item
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Unidade NF
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Quantidade NF
              </th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">
                Conversão (0220)
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Qtd Convertida
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Custo unitário
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Custo total
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Quantidade ajustada
              </th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.map((row, rowIndex) => {
              const isAdjusted =
                row.adjusted_qty !== null &&
                row.adjusted_qty !== undefined &&
                Math.abs((row.adjusted_qty ?? 0) - row.quantidade_nf) > 1e-6;
              
              // Calcular custo unitário ajustado
              const qtdUsada = isAdjusted ? (row.adjusted_qty ?? row.quantidade_nf) : row.quantidade_nf;
              const custoUnitarioAjustado = qtdUsada > 0 ? row.custo_total / qtdUsada : row.custo_unitario;
              
              // Verificar se tem conversão (bloco 0220)
              const temConversao = row.unidade_produto !== null && row.fat_conv !== null && row.fat_conv !== 1;
              
              // Recalcular qtd_produto se houver ajuste e conversão
              const qtdProdutoAjustada = temConversao && isAdjusted && row.adjusted_qty !== null
                ? row.adjusted_qty * (row.fat_conv ?? 1)
                : row.qtd_produto;
              
              const foiSalvo = savedItems.has(row.documentItemId);
              
              // Criar uma função wrapper para garantir que o row correto seja usado
              const handleSaveClick = () => {
                console.log(`🔍 CLIQUE NA LINHA ${rowIndex}:`);
                console.log(`  - Código: ${row.cod_item}`);
                console.log(`  - DocumentItemId: ${row.documentItemId}`);
                console.log(`  - Quantidade NF: ${row.quantidade_nf}`);
                console.log(`  - Nota: ${row.nota}`);
                console.log(`  - Row completo:`, row);
                saveAdjustment(row);
              };

              return (
                <tr
                  key={row.documentItemId}
                  data-row-index={rowIndex}
                  data-document-item-id={row.documentItemId}
                  data-cod-item={row.cod_item}
                  className={`${isAdjusted ? "bg-yellow-50 border-l-4 border-yellow-400" : ""} ${foiSalvo ? "ring-2 ring-green-300" : ""} hover:bg-gray-50 transition-colors`}
                >
                  <td className="px-4 py-2 text-gray-900">
                    <div className="font-semibold">{row.nota}</div>
                    <div className="text-xs text-gray-500">
                      {row.dataDocumento
                        ? new Date(row.dataDocumento).toLocaleDateString(
                            "pt-BR"
                          )
                        : "-"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    <div className="font-medium">{row.fornecedor}</div>
                    {row.fornecedorDoc && (
                      <div className="text-xs text-gray-500">
                        {row.fornecedorDoc}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    <div className="font-semibold">{row.cod_item}</div>
                    <div className="text-xs text-gray-500">
                      {row.descr_item}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {row.unidade_nf || "-"}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {row.quantidade_nf.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {temConversao ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-blue-600">
                          {row.unidade_produto}
                        </span>
                        <span className="text-xs text-gray-500">
                          Fator: {row.fat_conv?.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {temConversao ? (
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-blue-600">
                          {qtdProdutoAjustada.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-xs text-gray-500">
                          {isAdjusted && row.adjusted_qty !== null ? (
                            <>
                              <span className="line-through text-gray-400">
                                {row.quantidade_nf.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              {" "}
                              <span className="text-blue-600 font-medium">
                                {row.adjusted_qty.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </>
                          ) : (
                            row.quantidade_nf.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          )}{" "}
                          × {row.fat_conv?.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    <div className="flex flex-col items-end">
                      {isAdjusted ? (
                        <>
                          <span className="text-xs text-gray-500 line-through">
                            {row.custo_unitario.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                          <span className="font-semibold text-blue-600">
                            {custoUnitarioAjustado.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </>
                      ) : (
                        <span>
                          {row.custo_unitario.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {row.custo_total.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <input
                        type="number"
                        step="0.01"
                        className={`w-32 px-2 py-1 border rounded-md text-right text-sm ${
                          isAdjusted
                            ? "border-yellow-400 bg-yellow-50 font-semibold"
                            : "border-gray-300"
                        }`}
                        value={
                          editedValues[row.documentItemId] ??
                          (row.adjusted_qty !== null && row.adjusted_qty !== undefined
                            ? String(row.adjusted_qty)
                            : "")
                        }
                        onChange={(e) =>
                          handleInputChange(
                            row.documentItemId,
                            e.target.value
                          )
                        }
                        placeholder={String(row.quantidade_nf)}
                      />
                      {isAdjusted && (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-yellow-600 font-medium">
                            ✓ Ajustado
                          </span>
                          {foiSalvo && (
                            <span className="text-xs text-green-600 font-semibold">
                              💾 Salvo no banco
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={async (e) => {
                          try {
                            e.preventDefault();
                            e.stopPropagation();
                            alert(`🔍 DEBUG: Salvando ajuste para código ${row.cod_item}\nDocumentItemId: ${row.documentItemId}\nQuantidade NF: ${row.quantidade_nf}\nLinha: ${rowIndex}`);
                            handleSaveClick();
                          } catch (error) {
                            alert(`❌ ERRO ao chamar saveAdjustment: ${error}`);
                            console.error("❌ ERRO ao chamar saveAdjustment:", error);
                          }
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          isAdjusted || (editedValues[row.documentItemId] && editedValues[row.documentItemId] !== String(row.quantidade_nf))
                            ? "text-white bg-green-600 hover:bg-green-700"
                            : "text-white bg-blue-600 hover:bg-blue-700"
                        } disabled:bg-gray-400`}
                        disabled={loadingRow === row.documentItemId}
                      >
                        {loadingRow === row.documentItemId
                          ? "Salvando..."
                          : isAdjusted
                          ? "Atualizar"
                          : "Salvar"}
                      </button>
                      {isAdjusted && (
                        <button
                          onClick={() => resetAdjustment(row)}
                          className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                          disabled={loadingRow === row.documentItemId}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


