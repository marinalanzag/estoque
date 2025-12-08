"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface InventoryItem {
  cod_item: string;
  descr_item?: string | null;
  unidade?: string | null;
  estoque_inicial: number;
  entradas: number;
  saidas: number;
  estoque_teorico: number;
  unit_cost: number;
  valor_estoque: number;
  ajustes_recebidos: number;
  ajustes_fornecidos: number;
  estoque_final: number;
}

interface Adjustment {
  id: string;
  cod_negativo: string;
  cod_positivo: string;
  qtd_baixada: number;
  unit_cost: number;
  total_value: number;
  created_at: string;
}

interface AdjustmentsTableProps {
  spedFileId: string;
  fileName: string;
  initialAdjustments: Adjustment[];
  onAdjustmentsChange?: (adjustments: Adjustment[]) => void;
  onRefresh?: () => void;
  activePeriodId?: string | null;
}

export default function AdjustmentsTable({
  spedFileId,
  fileName,
  initialAdjustments,
  onAdjustmentsChange,
  onRefresh,
  activePeriodId = null,
}: AdjustmentsTableProps) {
  const router = useRouter();
  const [negativos, setNegativos] = useState<InventoryItem[]>([]);
  const [positivos, setPositivos] = useState<InventoryItem[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initialAdjustments);

  // Sincronizar ajustes iniciais quando mudarem (ex: quando volta para a página)
  useEffect(() => {
    console.log("[AdjustmentsTable] 🔄 useEffect initialAdjustments - recebidos:", initialAdjustments.length);
    console.log("[AdjustmentsTable] 🔄 Ajustes atuais no estado:", adjustments.length);
    console.log("[AdjustmentsTable] 🔄 IDs iniciais:", initialAdjustments.map(a => a.id));
    console.log("[AdjustmentsTable] 🔄 IDs atuais:", adjustments.map(a => a.id));

    // CORREÇÃO Problema 02 + Cache: Proteger ajustes locais que ainda não estão no servidor
    // Se o estado local tem mais ajustes que initialAdjustments, pode ser cache do servidor
    // Preservar ajustes locais que foram criados recentemente
    if (adjustments.length > initialAdjustments.length) {
      console.log("[AdjustmentsTable] ⚠️ Estado local tem mais ajustes que servidor, pode ser cache. Preservando estado local.");
      console.log("[AdjustmentsTable]   - Ajustes locais:", adjustments.length);
      console.log("[AdjustmentsTable]   - Ajustes servidor:", initialAdjustments.length);
      console.log("[AdjustmentsTable]   - IDs locais:", adjustments.map(a => a.id));
      console.log("[AdjustmentsTable]   - IDs servidor:", initialAdjustments.map(a => a.id));

      // Fazer merge: manter ajustes locais que não estão no servidor
      const merged = [...initialAdjustments];
      adjustments.forEach(localAdj => {
        if (!merged.find(a => a.id === localAdj.id)) {
          console.log("[AdjustmentsTable]   - Preservando ajuste local:", localAdj.id);
          merged.push(localAdj);
        }
      });
      setAdjustments(merged);
      if (onAdjustmentsChange) {
        onAdjustmentsChange(merged);
      }
    } else {
      console.log("[AdjustmentsTable] ✅ Atualizando ajustes do servidor");
      setAdjustments(initialAdjustments);
      if (onAdjustmentsChange) {
        onAdjustmentsChange(initialAdjustments);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAdjustments]); // Remover onAdjustmentsChange da dependência para evitar loops

  // Recarregar ajustes quando a página recebe foco (usuário volta para a aba)
  useEffect(() => {
    const handleFocus = () => {
      console.log("[AdjustmentsTable] Página recebeu foco, recarregando ajustes...");
      loadAdjustments();
      loadInventoryData();
      // Se houver função de refresh do componente pai, chamá-la também
      if (onRefresh) {
        onRefresh();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spedFileId, onRefresh]); // loadAdjustments e loadInventoryData são funções estáveis

  // Notificar mudanças nos ajustes
  useEffect(() => {
    if (onAdjustmentsChange) {
      onAdjustmentsChange(adjustments);
    }
  }, [adjustments, onAdjustmentsChange]);
  const [loading, setLoading] = useState(true);
  const [selectedNegativo, setSelectedNegativo] = useState<string | null>(null);
  const [selectedPositivo, setSelectedPositivo] = useState<string | null>(null);
  const [qtdBaixada, setQtdBaixada] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filtros e busca para positivos
  const [searchPositivos, setSearchPositivos] = useState<string>("");
  const [sortPositivos, setSortPositivos] = useState<"codigo-asc" | "codigo-desc" | "descricao-asc" | "descricao-desc" | "quantidade-desc" | "quantidade-asc" | "usado-desc" | "usado-asc" | "disponivel-desc" | "disponivel-asc">("quantidade-desc");

  // Filtros e busca para negativos
  const [searchNegativos, setSearchNegativos] = useState<string>("");
  const [sortNegativos, setSortNegativos] = useState<"codigo-asc" | "codigo-desc" | "descricao-asc" | "descricao-desc" | "saldo-asc" | "saldo-desc" | "status">("saldo-asc");

  const loadInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/adjustments/inventory-data?sped_file_id=${spedFileId}`;
      if (activePeriodId) {
        url += `&period_id=${activePeriodId}`;
      }
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        // Se for erro de período sem dados, mostrar mensagem específica
        if (data.error === "PERIODO_SEM_DADOS") {
          setError(data.message || "Este período não possui dados vinculados. Por favor, importe os arquivos necessários.");
        } else {
          setError(data.error || "Erro ao carregar dados");
        }
        setNegativos([]);
        setPositivos([]);
        return;
      }

      setNegativos(data.negativos || []);
      setPositivos(data.positivos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [spedFileId, activePeriodId]);

  useEffect(() => {
    console.log("[AdjustmentsTable] useEffect inicial - carregando dados para spedFileId:", spedFileId, "periodId:", activePeriodId);
    loadInventoryData();
    // ✅ CORREÇÃO: NÃO chamar loadAdjustments() aqui pois ele sobrescreve os initialAdjustments
    // que vêm corretamente do servidor. O useEffect das linhas 53-89 já sincroniza initialAdjustments.
    // loadAdjustments(); // ← COMENTADO para usar dados do servidor (184 ajustes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spedFileId, activePeriodId]); // Carregar quando o SPED ou período mudar

  const loadAdjustments = async () => {
    try {
      console.log("[AdjustmentsTable] 🔄 Iniciando loadAdjustments para spedFileId:", spedFileId);

      console.log("[AdjustmentsTable] Período ativo recebido via props:", activePeriodId);

      let url = `/api/adjustments/list?sped_file_id=${spedFileId}`;
      if (activePeriodId) {
        url += `&period_id=${activePeriodId}`;
      }

      console.log("[AdjustmentsTable] Buscando ajustes na URL:", url);
      const res = await fetch(url, {
        cache: 'no-store', // Forçar busca sempre atualizada
      });
      const data = await res.json();

      if (res.ok && data.adjustments) {
        console.log("[AdjustmentsTable] ✅ Ajustes recarregados do banco:", data.adjustments.length);
        console.log("[AdjustmentsTable] IDs dos ajustes:", data.adjustments.map((a: Adjustment) => a.id));

        // Sempre atualizar o estado com os dados do banco
        setAdjustments(data.adjustments);

        // Notificar componente pai sobre a mudança
        if (onAdjustmentsChange) {
          console.log("[AdjustmentsTable] Notificando componente pai sobre ajustes recarregados");
          onAdjustmentsChange(data.adjustments);
        }
      } else {
        console.error("[AdjustmentsTable] ❌ Erro ao recarregar ajustes:", data.error);
        console.error("[AdjustmentsTable] Resposta completa:", data);
      }
    } catch (err) {
      console.error("[AdjustmentsTable] ❌ Erro ao recarregar ajustes:", err);
    }
  };

  const handleDeleteAdjustment = async (adjustmentId: string, codPositivo: string, codNegativo: string, qtdBaixada: number, totalValue: number) => {
    if (!window.confirm(
      `Tem certeza que deseja excluir este ajuste?\n\n` +
      `De: ${codPositivo} → Para: ${codNegativo}\n` +
      `Quantidade: ${Number(qtdBaixada).toFixed(2)}\n` +
      `Valor: R$ ${Number(totalValue).toFixed(2)}\n\n` +
      `Esta ação não pode ser desfeita.`
    )) {
      return;
    }

    try {
      console.log("[DELETE] Iniciando exclusão do ajuste:", adjustmentId);
      setError(null);

      const res = await fetch(`/api/adjustments/delete?id=${adjustmentId}`, {
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log("[DELETE] Response status:", res.status);

      const data = await res.json();

      if (!res.ok) {
        console.error("[DELETE] Erro na resposta:", data.error);
        throw new Error(data.error || "Erro ao excluir ajuste");
      }

      console.log("[DELETE] ✅ Ajuste excluído com sucesso");
      setSuccess(`Ajuste excluído com sucesso!`);

      // Remover do estado local
      setAdjustments((prev) => {
        const updated = prev.filter(a => a.id !== adjustmentId);
        if (onAdjustmentsChange) {
          onAdjustmentsChange(updated);
        }
        return updated;
      });

      // Recarregar dados
      await loadInventoryData();
      if (onRefresh) {
        onRefresh();
      }
      router.refresh();
    } catch (err) {
      console.error("[DELETE] Erro:", err);
      const errorMsg = err instanceof Error ? err.message : "Erro ao excluir ajuste";
      setError(errorMsg);
    }
  };

  const handleCreateAdjustment = async () => {
    if (!selectedNegativo || !selectedPositivo || !qtdBaixada) {
      setError("Preencha todos os campos");
      return;
    }

    // Garantir que a quantidade seja salva exatamente como o usuário digitou
    // Usar parseFloat para preservar decimais
    const qtd = parseFloat(qtdBaixada);
    if (isNaN(qtd) || qtd <= 0) {
      setError("Quantidade deve ser maior que zero");
      return;
    }

    // Log para debug - verificar se a quantidade está sendo preservada
    console.log("[AdjustmentsTable] Quantidade digitada pelo usuário:", qtdBaixada);
    console.log("[AdjustmentsTable] Quantidade parseada:", qtd);
    console.log("[AdjustmentsTable] Quantidade será salva como:", qtd);

    const negativo = negativos.find((n) => n.cod_item === selectedNegativo);
    const positivo = positivos.find((p) => p.cod_item === selectedPositivo);

    if (!negativo || !positivo) {
      setError("Códigos não encontrados");
      return;
    }

    // Verificar se as unidades são diferentes
    const unidadeNegativo = negativo.unidade || null;
    const unidadePositivo = positivo.unidade || null;
    const unidadesDiferentes = unidadeNegativo && unidadePositivo &&
      unidadeNegativo.toLowerCase() !== unidadePositivo.toLowerCase();

    // Se quantidade excede o saldo disponível
    if (qtd > positivo.estoque_final) {
      // Se as unidades são diferentes, mostrar aviso mas permitir
      if (unidadesDiferentes) {
        const confirmar = window.confirm(
          `⚠️ ATENÇÃO: A quantidade (${qtd.toFixed(2)}) excede o estoque disponível (${positivo.estoque_final.toFixed(2)}).\n\n` +
          `Unidades diferentes detectadas:\n` +
          `- Positivo: ${unidadePositivo}\n` +
          `- Negativo: ${unidadeNegativo}\n\n` +
          `Isso pode ser normal quando há conversão de unidades (ex: saco → kg).\n\n` +
          `Deseja continuar mesmo assim?`
        );
        if (!confirmar) {
          return;
        }
        // Continuar com o salvamento mesmo excedendo o saldo
      } else {
        // Se unidades são iguais ou não informadas, bloquear
        setError(
          `Quantidade excede o estoque disponível (${positivo.estoque_final.toFixed(2)})`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/adjustments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sped_file_id: spedFileId,
          cod_negativo: selectedNegativo,
          cod_positivo: selectedPositivo,
          qtd_baixada: qtd, // Garantir que seja o valor exato digitado pelo usuário
          unit_cost: positivo.unit_cost,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar ajuste");
      }

      console.log("[AdjustmentsTable] ✅ Ajuste salvo com sucesso:", data.adjustment);
      setSuccess(`✅ Ajuste criado e salvo com sucesso! Código ${data.adjustment.cod_positivo} → ${data.adjustment.cod_negativo} - Qtd: ${data.adjustment.qtd_baixada}`);

      // Limpar formulário primeiro
      setSelectedNegativo(null);
      setSelectedPositivo(null);
      setQtdBaixada("");

      // Adicionar o novo ajuste ao estado IMEDIATAMENTE para feedback visual
      const newAdjustment = data.adjustment;
      console.log("[AdjustmentsTable] Novo ajuste recebido do servidor:", newAdjustment);

      // Atualizar estado e notificar componente pai em uma única operação
      setAdjustments((prev) => {
        // Verificar se já não existe (evitar duplicação)
        const exists = prev.some(a => a.id === newAdjustment.id);
        if (exists) {
          console.log("[AdjustmentsTable] Ajuste já existe no estado, não adicionando duplicado");
          return prev;
        }
        console.log("[AdjustmentsTable] Adicionando novo ajuste ao estado:", newAdjustment.id);
        const updated = [newAdjustment, ...prev];
        console.log("[AdjustmentsTable] Total de ajustes após adicionar:", updated.length);

        // Notificar componente pai com o novo estado
        if (onAdjustmentsChange) {
          onAdjustmentsChange(updated);
        }

        return updated;
      });

      // Pequeno delay para garantir que o banco processou a inserção
      await new Promise(resolve => setTimeout(resolve, 500));

      // Recarregar ajustes do banco para garantir sincronização completa
      console.log("[AdjustmentsTable] Recarregando ajustes do banco...");
      await loadAdjustments();

      // Recarregar dados do inventário para refletir os ajustes
      console.log("[AdjustmentsTable] Recarregando dados do inventário...");
      await loadInventoryData();

      // Revalidar a página no servidor para garantir que os dados sejam atualizados
      console.log("[AdjustmentsTable] Revalidando página no servidor...");

      // Se houver função de refresh do componente pai, chamá-la primeiro
      if (onRefresh) {
        console.log("[AdjustmentsTable] Chamando onRefresh do componente pai...");
        onRefresh();
      }

      // Aguardar um pouco antes de fazer o refresh do router para garantir que o servidor processou
      await new Promise(resolve => setTimeout(resolve, 300));
      router.refresh();

      console.log("[AdjustmentsTable] ✅ Processo de salvamento concluído");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedNegativoItem = negativos.find(
    (n) => n.cod_item === selectedNegativo
  );
  const selectedPositivoItem = positivos.find(
    (p) => p.cod_item === selectedPositivo
  );

  const totalAjustes = adjustments.reduce(
    (acc, adj) => acc + Number(adj.total_value ?? 0),
    0
  );

  // Função para filtrar e ordenar positivos
  const getFilteredAndSortedPositivos = () => {
    let filtered = [...positivos];

    // Aplicar busca
    if (searchPositivos.trim()) {
      const searchLower = searchPositivos.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const codItem = (item.cod_item || "").toLowerCase();
        const descr = (item.descr_item || "").toLowerCase();
        return codItem.includes(searchLower) || descr.includes(searchLower);
      });
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      const ajustesA = adjustments
        .filter((adj) => adj.cod_positivo === a.cod_item)
        .reduce((acc, adj) => acc + Number(adj.qtd_baixada), 0);
      const ajustesB = adjustments
        .filter((adj) => adj.cod_positivo === b.cod_item)
        .reduce((acc, adj) => acc + Number(adj.qtd_baixada), 0);
      // Usar estoque teórico (base sem ajustes) menos ajustes já fornecidos no estado local
      const disponivelA = a.estoque_teorico - ajustesA;
      const disponivelB = b.estoque_teorico - ajustesB;

      switch (sortPositivos) {
        case "codigo-asc":
          return a.cod_item.localeCompare(b.cod_item);
        case "codigo-desc":
          return b.cod_item.localeCompare(a.cod_item);
        case "descricao-asc":
          return (a.descr_item || "").localeCompare(b.descr_item || "");
        case "descricao-desc":
          return (b.descr_item || "").localeCompare(a.descr_item || "");
        case "quantidade-desc":
          return b.estoque_final - a.estoque_final;
        case "quantidade-asc":
          return a.estoque_final - b.estoque_final;
        case "usado-desc":
          return ajustesB - ajustesA;
        case "usado-asc":
          return ajustesA - ajustesB;
        case "disponivel-desc":
          return disponivelB - disponivelA;
        case "disponivel-asc":
          return disponivelA - disponivelB;
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Função para filtrar e ordenar negativos
  const getFilteredAndSortedNegativos = () => {
    let filtered = [...negativos];

    // Aplicar busca
    if (searchNegativos.trim()) {
      const searchLower = searchNegativos.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const codItem = (item.cod_item || "").toLowerCase();
        const descr = (item.descr_item || "").toLowerCase();
        return codItem.includes(searchLower) || descr.includes(searchLower);
      });
    }

    // Aplicar ordenação
    filtered.sort((a, b) => {
      const ajustesA = adjustments
        .filter((adj) => adj.cod_negativo === a.cod_item)
        .reduce((acc, adj) => acc + Number(adj.qtd_baixada), 0);
      const ajustesB = adjustments
        .filter((adj) => adj.cod_negativo === b.cod_item)
        .reduce((acc, adj) => acc + Number(adj.qtd_baixada), 0);
      const saldoAposA = a.estoque_final + ajustesA;
      const saldoAposB = b.estoque_final + ajustesB;
      const resolvidoA = saldoAposA >= 0;
      const resolvidoB = saldoAposB >= 0;

      switch (sortNegativos) {
        case "codigo-asc":
          return a.cod_item.localeCompare(b.cod_item);
        case "codigo-desc":
          return b.cod_item.localeCompare(a.cod_item);
        case "descricao-asc":
          return (a.descr_item || "").localeCompare(b.descr_item || "");
        case "descricao-desc":
          return (b.descr_item || "").localeCompare(a.descr_item || "");
        case "saldo-asc":
          return a.estoque_final - b.estoque_final;
        case "saldo-desc":
          return b.estoque_final - a.estoque_final;
        case "status":
          // Primeiro os não resolvidos, depois os resolvidos
          if (resolvidoA !== resolvidoB) {
            return resolvidoA ? 1 : -1;
          }
          return a.estoque_final - b.estoque_final;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const filteredPositivos = getFilteredAndSortedPositivos();
  const filteredNegativos = getFilteredAndSortedNegativos();

  // Quando um negativo é selecionado, destacar positivos que já foram usados para ele
  const getPositivosUsadosParaNegativo = (codNegativo: string) => {
    return adjustments
      .filter((adj) => adj.cod_negativo === codNegativo)
      .map((adj) => adj.cod_positivo);
  };

  // Quando um negativo é selecionado, sugerir busca automática
  useEffect(() => {
    if (selectedNegativo && selectedNegativoItem) {
      // Tentar encontrar sugestões baseadas no código ou descrição
      const codNegativo = selectedNegativoItem.cod_item;
      const descrNegativo = (selectedNegativoItem.descr_item || "").toLowerCase();

      // Se não há busca ativa, tentar sugerir automaticamente
      if (!searchPositivos.trim()) {
        // Extrair prefixo do código (primeiros 3-4 caracteres)
        const prefixo = codNegativo.substring(0, Math.min(4, codNegativo.length));
        if (prefixo.length >= 2) {
          setSearchPositivos(prefixo);
        } else if (descrNegativo.length > 0) {
          // Tentar usar primeiras palavras da descrição
          const primeiraPalavra = descrNegativo.split(" ")[0];
          if (primeiraPalavra.length >= 3) {
            setSearchPositivos(primeiraPalavra);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNegativo, selectedNegativoItem]); // searchPositivos intencionalmente omitido para evitar loop

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">Carregando dados do inventário...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulário de novo ajuste */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Criar Novo Ajuste
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            {success}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código Negativo *
            </label>
            <select
              value={selectedNegativo || ""}
              onChange={(e) => setSelectedNegativo(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um código negativo...</option>
              {negativos.map((item) => (
                <option key={item.cod_item} value={item.cod_item}>
                  {item.cod_item} - {item.descr_item || "[Sem descrição]"} (
                  Estoque: {item.estoque_final.toFixed(2)})
                </option>
              ))}
            </select>
            {selectedNegativoItem && (
              <p className="mt-1 text-xs text-gray-500">
                Saldo atual: {selectedNegativoItem.estoque_final.toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código Positivo *
            </label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Buscar positivo por código ou descrição..."
                value={searchPositivos}
                onChange={(e) => setSearchPositivos(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={selectedPositivo || ""}
                onChange={(e) => setSelectedPositivo(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                size={Math.min(filteredPositivos.length + 1, 8)}
              >
                <option value="">Selecione um código positivo...</option>
                {filteredPositivos.map((item) => {
                  const ajustesFornecidos = adjustments
                    .filter((adj) => adj.cod_positivo === item.cod_item)
                    .reduce((acc, adj) => acc + Number(adj.qtd_baixada), 0);
                  // Usar estoque teórico (base sem ajustes) menos ajustes já fornecidos no estado local
                  const disponivel = item.estoque_teorico - ajustesFornecidos;
                  return (
                    <option key={item.cod_item} value={item.cod_item}>
                      {item.cod_item} - {item.descr_item || "[Sem descrição]"} |
                      Disponível: {disponivel.toFixed(2)} |
                      Custo: R$ {item.unit_cost.toFixed(2)}
                    </option>
                  );
                })}
              </select>
            </div>
            {selectedPositivoItem && (
              <div className="mt-2 space-y-1">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <p className="text-gray-700">
                    <strong>Disponível:</strong> {(() => {
                      const ajustesFornecidos = adjustments
                        .filter((adj) => adj.cod_positivo === selectedPositivoItem.cod_item)
                        .reduce((acc, adj) => acc + Number(adj.qtd_baixada), 0);
                      // Usar estoque teórico (base sem ajustes) menos ajustes já fornecidos no estado local
                      const disponivel = selectedPositivoItem.estoque_teorico - ajustesFornecidos;
                      return disponivel.toFixed(2);
                    })()} |
                    <strong> Custo unitário:</strong> R$ {selectedPositivoItem.unit_cost.toFixed(2)}
                    {selectedPositivoItem.unidade && (
                      <> | <strong>Unidade:</strong> {selectedPositivoItem.unidade}</>
                    )}
                  </p>
                </div>
                {selectedNegativoItem && selectedPositivoItem.unidade && selectedNegativoItem.unidade &&
                  selectedPositivoItem.unidade.toLowerCase() !== selectedNegativoItem.unidade.toLowerCase() && (
                    <div className="p-2 bg-yellow-50 border border-yellow-300 rounded text-xs">
                      <p className="text-yellow-800">
                        ⚠️ <strong>Atenção:</strong> Unidades diferentes detectadas (Positivo: {selectedPositivoItem.unidade}, Negativo: {selectedNegativoItem.unidade}).
                        A baixa pode exceder o saldo disponível devido à conversão de unidades.
                      </p>
                    </div>
                  )}
              </div>
            )}
            {searchPositivos && filteredPositivos.length === 0 && (
              <p className="mt-1 text-xs text-red-600">
                Nenhum item encontrado com a busca &quot;{searchPositivos}&quot;
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantidade a Baixar *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={qtdBaixada}
              onChange={(e) => setQtdBaixada(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            {selectedPositivoItem && qtdBaixada && (
              <p className="mt-1 text-xs text-gray-500">
                Valor total: R${" "}
                {(
                  parseFloat(qtdBaixada) * selectedPositivoItem.unit_cost
                ).toFixed(2)}
              </p>
            )}
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCreateAdjustment}
              disabled={submitting || !selectedNegativo || !selectedPositivo || !qtdBaixada}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Criando ajuste..." : "Criar Ajuste"}
            </button>
          </div>
        </div>
      </div>

      {/* Layout em duas colunas: Negativos e Positivos lado a lado */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Coluna 1: Itens Negativos com detalhes dos positivos usados */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <h2 className="text-lg font-semibold text-red-900">
              Itens com Saldo Negativo ({negativos.length})
            </h2>
            <p className="text-sm text-red-700 mt-1">
              Selecione um item negativo e encontre o positivo equivalente
            </p>
          </div>

          {/* Filtros para negativos */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar por código ou descrição..."
                value={searchNegativos}
                onChange={(e) => setSearchNegativos(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <select
                value={sortNegativos}
                onChange={(e) => setSortNegativos(e.target.value as any)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="saldo-asc">Saldo: Menor → Maior</option>
                <option value="saldo-desc">Saldo: Maior → Menor</option>
                <option value="codigo-asc">Código: A-Z</option>
                <option value="codigo-desc">Código: Z-A</option>
                <option value="descricao-asc">Descrição: A-Z</option>
                <option value="descricao-desc">Descrição: Z-A</option>
                <option value="status">Status: Pendentes primeiro</option>
              </select>
            </div>
            {searchNegativos && (
              <p className="text-xs text-gray-600">
                {filteredNegativos.length} item(ns) encontrado(s)
              </p>
            )}
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo Atual
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recebido
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredNegativos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      {searchNegativos ? "Nenhum item encontrado com a busca." : "Nenhum item com saldo negativo encontrado."}
                    </td>
                  </tr>
                ) : (
                  filteredNegativos.map((item) => {
                    const ajustesParaEsteNegativo = adjustments.filter(
                      (adj) => adj.cod_negativo === item.cod_item
                    );
                    const ajustesRecebidos = ajustesParaEsteNegativo.reduce(
                      (acc, adj) => acc + Number(adj.qtd_baixada),
                      0
                    );
                    const saldoAposAjustes = item.estoque_final + ajustesRecebidos;
                    const resolvido = saldoAposAjustes >= 0;
                    const aindaPrecisa = Math.abs(Math.min(0, saldoAposAjustes));

                    const isSelected = selectedNegativo === item.cod_item;
                    return (
                      <tr
                        key={item.cod_item}
                        onClick={() => setSelectedNegativo(item.cod_item)}
                        className={`${resolvido ? "bg-green-50" : "hover:bg-red-50"} ${isSelected ? "ring-2 ring-red-500 bg-red-100" : ""} transition-colors cursor-pointer`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.cod_item}
                          {isSelected && <span className="ml-2 text-red-600">✓</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={item.descr_item || "[Sem descrição]"}>
                          {item.descr_item || "[Sem descrição]"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          <span className={`font-bold ${item.estoque_final < 0 ? "text-red-600" : "text-gray-900"}`}>
                            {item.estoque_final.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          {ajustesRecebidos > 0 ? (
                            <span className="font-medium text-green-600">
                              +{ajustesRecebidos.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {resolvido ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              ✓ Resolvido
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              Precisa {aindaPrecisa.toFixed(2)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coluna 2: Itens Positivos com detalhes de quanto já foi usado */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b border-green-200">
            <h2 className="text-lg font-semibold text-green-900">
              Itens com Saldo Positivo ({positivos.length})
            </h2>
            <p className="text-sm text-green-700 mt-1">
              {selectedNegativo
                ? `Encontre o positivo equivalente para: ${selectedNegativoItem?.cod_item || selectedNegativo}`
                : "Selecione um negativo à esquerda para ver sugestões"}
            </p>
          </div>

          {/* Filtros para positivos */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar por código, descrição ou prefixo..."
                value={searchPositivos}
                onChange={(e) => setSearchPositivos(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <select
                value={sortPositivos}
                onChange={(e) => setSortPositivos(e.target.value as any)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="quantidade-desc">Maior Quantidade</option>
                <option value="quantidade-asc">Menor Quantidade</option>
                <option value="disponivel-desc">Mais Disponível</option>
                <option value="disponivel-asc">Menos Disponível</option>
                <option value="codigo-asc">Código: A-Z</option>
                <option value="codigo-desc">Código: Z-A</option>
                <option value="descricao-asc">Descrição: A-Z</option>
                <option value="descricao-desc">Descrição: Z-A</option>
                <option value="usado-desc">Mais Usado</option>
                <option value="usado-asc">Menos Usado</option>
              </select>
            </div>
            {searchPositivos && (
              <p className="text-xs text-gray-600">
                {filteredPositivos.length} item(ns) encontrado(s)
              </p>
            )}
            {selectedNegativo && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                💡 <strong>Dica:</strong> Procure por códigos similares ou descrições parecidas ao negativo selecionado
              </div>
            )}
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade Final
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Já Usado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Disponível
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPositivos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      {searchPositivos ? "Nenhum item encontrado com a busca." : "Nenhum item com saldo positivo encontrado."}
                    </td>
                  </tr>
                ) : (
                  filteredPositivos.map((item) => {
                    const ajustesFornecidos = adjustments
                      .filter((adj) => adj.cod_positivo === item.cod_item)
                      .reduce((acc, adj) => acc + Number(adj.qtd_baixada), 0);
                    // Usar estoque teórico (base sem ajustes) menos ajustes já fornecidos no estado local
                    const disponivel = item.estoque_teorico - ajustesFornecidos;
                    const percentualUsado = item.estoque_final > 0
                      ? (ajustesFornecidos / item.estoque_final) * 100
                      : 0;

                    // Verificar se este positivo já foi usado para o negativo selecionado
                    const positivosUsados = selectedNegativo
                      ? getPositivosUsadosParaNegativo(selectedNegativo)
                      : [];
                    const jaFoiUsadoParaEsteNegativo = selectedNegativo
                      ? positivosUsados.includes(item.cod_item)
                      : false;

                    // Verificar similaridade com o negativo selecionado (para destacar sugestões)
                    const isSimilar = selectedNegativo && selectedNegativoItem
                      ? item.cod_item.includes(selectedNegativoItem.cod_item.substring(0, 3)) ||
                      selectedNegativoItem.cod_item.includes(item.cod_item.substring(0, 3)) ||
                      (item.descr_item && selectedNegativoItem.descr_item &&
                        item.descr_item.toLowerCase().includes(selectedNegativoItem.descr_item.toLowerCase().substring(0, 5)))
                      : false;

                    return (
                      <tr
                        key={item.cod_item}
                        onClick={() => setSelectedPositivo(item.cod_item)}
                        className={`${ajustesFornecidos > 0 ? "bg-blue-50" : ""} ${selectedPositivo === item.cod_item ? "ring-2 ring-green-500 bg-green-100" : ""} ${jaFoiUsadoParaEsteNegativo ? "bg-yellow-50 border-l-4 border-yellow-400" : ""} ${isSimilar && selectedNegativo ? "bg-purple-50 border-l-4 border-purple-400" : ""} hover:bg-green-50 transition-colors cursor-pointer`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.cod_item}
                          {selectedPositivo === item.cod_item && <span className="ml-2 text-green-600">✓</span>}
                          {jaFoiUsadoParaEsteNegativo && selectedNegativo && (
                            <span className="ml-2 text-xs text-yellow-600" title="Já usado para este negativo">🔄</span>
                          )}
                          {isSimilar && selectedNegativo && !jaFoiUsadoParaEsteNegativo && (
                            <span className="ml-2 text-xs text-purple-600" title="Possível correspondência">💡</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={item.descr_item || "[Sem descrição]"}>
                          {item.descr_item || "[Sem descrição]"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          <span className="font-bold text-green-700">
                            {item.estoque_teorico.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          {ajustesFornecidos > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-medium text-orange-600">
                                -{ajustesFornecidos.toFixed(2)}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({percentualUsado.toFixed(1)}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                          <span className={`font-bold ${disponivel > 0 ? "text-green-700" : "text-red-600"}`}>
                            {disponivel.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mapa de correspondências: Mostra visualmente quais positivos cobrem quais negativos */}
      {adjustments.length > 0 && (
        <div className="bg-white border-2 border-blue-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <h2 className="text-lg font-semibold text-blue-900">
              📊 Mapa de Correspondências
            </h2>
            <p className="text-sm text-blue-700 mt-1">
              Visualize quais itens positivos estão sendo usados para cobrir quais negativos
            </p>
          </div>
          <div className="p-6">
            {/* Visão por Negativo: Mostra quais positivos cobrem cada negativo */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-700 mb-3">
                📉 Visão por Item Negativo (o que precisa ser coberto)
              </h3>
              <div className="space-y-4">
                {negativos
                  .filter((negativo) => {
                    const ajustesParaEsteNegativo = adjustments.filter(
                      (adj) => adj.cod_negativo === negativo.cod_item
                    );
                    return ajustesParaEsteNegativo.length > 0;
                  })
                  .map((negativo) => {
                    const ajustesParaEsteNegativo = adjustments.filter(
                      (adj) => adj.cod_negativo === negativo.cod_item
                    );

                    const totalRecebido = ajustesParaEsteNegativo.reduce(
                      (acc, adj) => acc + Number(adj.qtd_baixada),
                      0
                    );
                    const saldoAposAjustes = negativo.estoque_final + totalRecebido;
                    const resolvido = saldoAposAjustes >= 0;
                    const aindaPrecisa = Math.abs(Math.min(0, saldoAposAjustes));

                    return (
                      <div
                        key={negativo.cod_item}
                        className={`border-2 rounded-lg p-4 ${resolvido ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-red-700">
                                {negativo.cod_item}
                              </span>
                              <span className="text-xs text-gray-600">
                                {negativo.descr_item || "[Sem descrição]"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-2">
                              <span>
                                Saldo inicial: <strong className="text-red-600">{negativo.estoque_final.toFixed(2)}</strong>
                              </span>
                              <span>
                                Total recebido: <strong className="text-green-600">+{totalRecebido.toFixed(2)}</strong>
                              </span>
                              <span>
                                Saldo após: <strong className={resolvido ? "text-green-600" : "text-red-600"}>
                                  {saldoAposAjustes.toFixed(2)}
                                </strong>
                              </span>
                              {!resolvido && (
                                <span className="text-red-700 font-medium">
                                  ⚠️ Ainda precisa: {aindaPrecisa.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          {resolvido ? (
                            <span className="px-2 py-1 text-xs font-medium bg-green-200 text-green-800 rounded-full whitespace-nowrap">
                              ✓ Resolvido
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-red-200 text-red-800 rounded-full whitespace-nowrap">
                              Pendente
                            </span>
                          )}
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="text-xs font-medium text-gray-700 mb-2">
                            Coberto por {ajustesParaEsteNegativo.length} item(ns) positivo(s):
                          </div>
                          {ajustesParaEsteNegativo.map((adj) => {
                            const positivoItem = positivos.find(
                              (p) => p.cod_item === adj.cod_positivo
                            );
                            return (
                              <div
                                key={adj.id}
                                className="flex items-center justify-between bg-white border border-gray-200 rounded p-2 hover:border-green-300 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="text-sm font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                                    {adj.cod_positivo}
                                  </span>
                                  <span className="text-xs text-gray-600 truncate">
                                    {positivoItem?.descr_item || "[Sem descrição]"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs whitespace-nowrap ml-2">
                                  <span className="text-gray-600">
                                    Qtd: <strong className="text-blue-700">{Number(adj.qtd_baixada).toFixed(2)}</strong>
                                  </span>
                                  <span className="text-gray-600">
                                    Valor: <strong className="text-gray-900">R$ {Number(adj.total_value).toFixed(2)}</strong>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Visão por Positivo: Mostra para quais negativos cada positivo está sendo usado */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3">
                📈 Visão por Item Positivo (o que está sendo usado)
              </h3>
              <div className="space-y-4">
                {positivos
                  .filter((positivo) => {
                    const ajustesDestePositivo = adjustments.filter(
                      (adj) => adj.cod_positivo === positivo.cod_item
                    );
                    return ajustesDestePositivo.length > 0;
                  })
                  .map((positivo) => {
                    const ajustesDestePositivo = adjustments.filter(
                      (adj) => adj.cod_positivo === positivo.cod_item
                    );
                    const totalFornecido = ajustesDestePositivo.reduce(
                      (acc, adj) => acc + Number(adj.qtd_baixada),
                      0
                    );
                    // CORREÇÃO Problema 01: item.estoque_final já subtrai ajustes_fornecidos na API
                    const disponivel = positivo.estoque_final + (positivo.ajustes_fornecidos || 0) - totalFornecido;
                    const percentualUsado = positivo.estoque_final > 0
                      ? (totalFornecido / positivo.estoque_final) * 100
                      : 0;

                    return (
                      <div
                        key={positivo.cod_item}
                        className="border-2 border-green-300 bg-green-50 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-green-700">
                                {positivo.cod_item}
                              </span>
                              <span className="text-xs text-gray-600">
                                {positivo.descr_item || "[Sem descrição]"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-2">
                              <span>
                                Estoque total: <strong className="text-green-700">{positivo.estoque_final.toFixed(2)}</strong>
                              </span>
                              <span>
                                Já usado: <strong className="text-orange-600">-{totalFornecido.toFixed(2)}</strong>
                                <span className="text-gray-500 ml-1">({percentualUsado.toFixed(1)}%)</span>
                              </span>
                              <span>
                                Disponível: <strong className={disponivel > 0 ? "text-green-700" : "text-red-600"}>
                                  {disponivel.toFixed(2)}
                                </strong>
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium bg-green-200 text-green-800 rounded-full whitespace-nowrap">
                            {ajustesDestePositivo.length} uso(s)
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="text-xs font-medium text-gray-700 mb-2">
                            Usado para cobrir {ajustesDestePositivo.length} item(ns) negativo(s):
                          </div>
                          {ajustesDestePositivo.map((adj) => {
                            const negativoItem = negativos.find(
                              (n) => n.cod_item === adj.cod_negativo
                            );
                            return (
                              <div
                                key={adj.id}
                                className="flex items-center justify-between bg-white border border-gray-200 rounded p-2 hover:border-red-300 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="text-sm font-bold text-red-700 bg-red-100 px-2 py-1 rounded">
                                    {adj.cod_negativo}
                                  </span>
                                  <span className="text-xs text-gray-600 truncate">
                                    {negativoItem?.descr_item || "[Sem descrição]"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs whitespace-nowrap ml-2">
                                  <span className="text-gray-600">
                                    Qtd: <strong className="text-blue-700">{Number(adj.qtd_baixada).toFixed(2)}</strong>
                                  </span>
                                  <span className="text-gray-600">
                                    Valor: <strong className="text-gray-900">R$ {Number(adj.total_value).toFixed(2)}</strong>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de ajustes realizados - DESTACADA */}
      {adjustments.length === 0 ? (
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-semibold text-yellow-900 mb-2">
            Nenhum ajuste realizado ainda
          </h3>
          <p className="text-yellow-700">
            Os ajustes que você criar aparecerão aqui e serão salvos automaticamente no banco de dados.
          </p>
        </div>
      ) : (
        <div className="bg-white border-2 border-blue-300 rounded-lg overflow-hidden shadow-lg">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 border-b border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  📋 Ajustes Realizados e Salvos ({adjustments.length})
                </h2>
                <p className="text-sm text-blue-100 mt-1">
                  Todos os ajustes estão salvos no banco de dados e persistem mesmo após fechar a aba ou mudar de mês
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      if (adjustments.length === 0) {
                        setError("Não há ajustes para exportar. Clique em 'Atualizar' primeiro.");
                        return;
                      }

                      setError(null);
                      const response = await fetch("/api/adjustments/export-xls", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          adjustments: adjustments,
                          spedFileId: spedFileId,
                          periodId: activePeriodId,
                        }),
                      });

                      if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || "Erro ao exportar");
                      }

                      const blob = await response.blob();
                      const downloadUrl = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = downloadUrl;

                      // Extrair nome do arquivo do header Content-Disposition se disponível
                      const contentDisposition = response.headers.get("Content-Disposition");
                      let fileName = "correcoes_periodo.xlsx";
                      if (contentDisposition) {
                        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
                        if (fileNameMatch) {
                          fileName = fileNameMatch[1];
                        }
                      }

                      a.download = fileName;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(downloadUrl);
                      document.body.removeChild(a);
                      setSuccess(`✅ Arquivo Excel exportado com ${adjustments.length} ajuste(s)!`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erro ao exportar em Excel");
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
                  title="Exportar ajustes em formato Excel (XLS)"
                >
                  📊 Exportar XLS
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (adjustments.length === 0) {
                        setError("Não há ajustes para exportar. Clique em 'Atualizar' primeiro.");
                        return;
                      }

                      setError(null);
                      const response = await fetch("/api/adjustments/export-word", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          adjustments: adjustments,
                          spedFileId: spedFileId,
                          periodId: activePeriodId,
                        }),
                      });

                      if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || "Erro ao exportar");
                      }

                      const blob = await response.blob();
                      const downloadUrl = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = downloadUrl;

                      // Extrair nome do arquivo do header Content-Disposition se disponível
                      const contentDisposition = response.headers.get("Content-Disposition");
                      let fileName = "correcoes_periodo.docx";
                      if (contentDisposition) {
                        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/);
                        if (fileNameMatch) {
                          fileName = fileNameMatch[1];
                        }
                      }

                      a.download = fileName;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(downloadUrl);
                      document.body.removeChild(a);
                      setSuccess(`✅ Arquivo Word exportado com ${adjustments.length} ajuste(s)!`);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erro ao exportar em Word");
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
                  title="Exportar ajustes em formato Word (DOCX)"
                >
                  📄 Exportar Word
                </button>
                <button
                  onClick={async () => {
                    console.log("[AdjustmentsTable] Botão Atualizar clicado");
                    await loadAdjustments();
                    await loadInventoryData();
                    // Se houver função de refresh do componente pai, chamá-la também
                    if (onRefresh) {
                      onRefresh();
                    }
                  }}
                  className="px-4 py-2 bg-white text-blue-600 rounded-md hover:bg-blue-50 font-medium text-sm transition-colors shadow-sm"
                  title="Atualizar lista de ajustes e dados do inventário"
                >
                  🔄 Atualizar
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Transferência
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Quantidade Baixada
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Custo Unit.
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Valor Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adjustments.map((adj, index) => (
                  <tr
                    key={adj.id}
                    className={`${index === 0 ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'} transition-colors`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="font-medium">
                        {new Date(adj.created_at).toLocaleDateString("pt-BR")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(adj.created_at).toLocaleTimeString("pt-BR")}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <div className="text-xs text-gray-500 mb-1">De (Positivo):</div>
                          <span className="text-sm font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                            {adj.cod_positivo}
                          </span>
                        </div>
                        <div className="text-blue-600 font-bold text-lg">→</div>
                        <div className="flex flex-col">
                          <div className="text-xs text-gray-500 mb-1">Para (Negativo):</div>
                          <span className="text-sm font-bold text-red-700 bg-red-100 px-2 py-1 rounded">
                            {adj.cod_negativo}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className="font-bold text-blue-900 text-lg">
                        {Number(adj.qtd_baixada).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                      R$ {Number(adj.unit_cost).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className="font-bold text-gray-900 text-lg">
                        R$ {Number(adj.total_value).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        type="button"
                        onClick={() => {
                          alert(`Clicou no ajuste: ${adj.id}`);
                          handleDeleteAdjustment(adj.id, adj.cod_positivo, adj.cod_negativo, adj.qtd_baixada, adj.total_value);
                        }}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium text-sm transition-colors shadow-sm"
                        title="Excluir este ajuste"
                      >
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-50 border-t-2 border-blue-300">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-right text-sm font-bold text-blue-900">
                    TOTAL GERAL:
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xl font-bold text-blue-900">
                      R$ {totalAjustes.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

