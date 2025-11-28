"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Period {
  id: string;
  year: number;
  month: number;
  name: string;
  label?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

function PeriodSelectorInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, name: "" });
  const [creating, setCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar período ativo após períodos serem carregados
  useEffect(() => {
    if (periods.length > 0) {
      loadActivePeriod();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods]);


  const loadPeriods = async () => {
    try {
      // Adicionar timestamp para evitar cache
      const timestamp = Date.now();
      const res = await fetch(`/api/periods/list?t=${timestamp}`, {
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      
      if (!res.ok) {
        console.error("[PeriodSelector] Erro ao carregar períodos:", res.status, res.statusText);
        setLoading(false);
        return [];
      }
      
      const data = await res.json();
      if (data.ok) {
        const periodsList = (data.periods || []) as Period[];
        console.log(`[PeriodSelector] ✅ Carregados ${periodsList.length} períodos`);
        
        // SEMPRE atualizar a lista com os dados do servidor
        setPeriods(periodsList);
        
        // Forçar atualização do select após carregar períodos
        setRefreshKey(prev => prev + 1);
        
        return periodsList; // Retornar para uso externo
      } else {
        console.error("[PeriodSelector] Erro ao carregar períodos:", data.error);
      }
    } catch (err) {
      console.error("[PeriodSelector] Erro ao carregar períodos:", err);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const loadActivePeriod = async () => {
    try {
      // Primeiro tentar ler do query param
      const periodParam = searchParams.get("period");
      if (periodParam) {
        const match = periodParam.match(/^(\d{4})-(\d{1,2})$/);
        if (match) {
          const year = parseInt(match[1], 10);
          const month = parseInt(match[2], 10);
          // Aguardar períodos carregarem se necessário
          if (periods.length > 0) {
            const period = periods.find(p => p.year === year && p.month === month);
            if (period) {
              setActivePeriod(period);
              setRefreshKey(prev => prev + 1);
              return;
            }
          }
        }
      }
      
      // Fallback: buscar período ativo da API
      const res = await fetch(`/api/periods/active?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.ok && data.period) {
        setActivePeriod(data.period);
        
        // Sempre garantir que o período ativo está na lista
        setPeriods(prev => {
          const exists = prev.find(p => p.id === data.period.id);
          if (!exists) {
            const newList = [data.period, ...prev].sort((a, b) => {
              if (b.year !== a.year) return b.year - a.year;
              return b.month - a.month;
            });
            setRefreshKey(prev => prev + 1);
            return newList;
          }
          // Atualizar período existente se houver mudanças
          const updated = prev.map(p => p.id === data.period.id ? data.period : p);
          if (JSON.stringify(prev) !== JSON.stringify(updated)) {
            setRefreshKey(prev => prev + 1);
          }
          return updated;
        });
      } else if (data.ok && !data.period) {
        setActivePeriod(null);
      }
    } catch (err) {
      console.error("Erro ao carregar período ativo:", err);
    }
  };

  const handleActivatePeriod = async (periodId: string) => {
    try {
      const res = await fetch("/api/periods/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
      });
      const data = await res.json();
      if (data.ok && data.period) {
        setActivePeriod(data.period);
        setRefreshKey(prev => prev + 1);
        
        // Atualizar URL com query param ?period=YYYY-MM
        const periodParam = `${data.period.year}-${data.period.month}`;
        const params = new URLSearchParams(searchParams.toString());
        params.set("period", periodParam);
        
        // Redirecionar para a mesma rota com o query param
        router.push(`${pathname}?${params.toString()}`);
      }
    } catch (err) {
      console.error("Erro ao ativar período:", err);
      alert("Erro ao ativar período");
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🚀🚀🚀 [PeriodSelector] handleCreatePeriod chamado com:", newPeriod);
    console.log("🚀 [PeriodSelector] Dados do período:", JSON.stringify(newPeriod));
    setCreating(true);
    try {
      console.log("🚀 [PeriodSelector] Fazendo requisição para /api/periods/create");
      const res = await fetch("/api/periods/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPeriod),
        cache: "no-store", // Forçar não usar cache
      });
      
      console.log("🚀 [PeriodSelector] Resposta recebida, status:", res.status);
      const data = await res.json();
      
      console.log("🚀 [PeriodSelector] Resposta da criação:", data);
      
      if (data.ok && data.period) {
        console.log("✅ [PeriodSelector] Período criado com sucesso:", data.period);
        const newPeriodData = data.period;
        
        // Fechar modal PRIMEIRO
        setShowCreateModal(false);
        setNewPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, name: "" });
        
        // ADICIONAR PERÍODO À LISTA LOCALMENTE PRIMEIRO (otimistic update)
        setPeriods(prev => {
          const exists = prev.find(p => p.id === newPeriodData.id);
          if (!exists) {
            const newList = [newPeriodData, ...prev].sort((a, b) => {
              if (b.year !== a.year) return b.year - a.year;
              return b.month - a.month;
            });
            console.log(`[PeriodSelector] Período adicionado à lista local: ${newPeriodData.year}/${newPeriodData.month}`);
            return newList;
          }
          return prev;
        });
        
        // DEFINIR COMO ATIVO IMEDIATAMENTE
        setActivePeriod(newPeriodData);
        setRefreshKey(prev => prev + 1);
        
        // Atualizar URL SEM fazer replace que pode remontar componente em produção
        const periodParam = `${newPeriodData.year}-${newPeriodData.month}`;
        
        // Verificar se estamos no cliente antes de usar window
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          params.set("period", periodParam);
          
          // Usar history.pushState ao invés de router.replace para não remontar
          const newUrl = `${window.location.pathname}?${params.toString()}`;
          window.history.pushState({}, '', newUrl);
        } else {
          // Fallback: usar router se window não estiver disponível
          const params = new URLSearchParams();
          if (searchParams) {
            searchParams.forEach((value, key) => {
              if (key !== 'period') {
                params.set(key, value);
              }
            });
          }
          params.set("period", periodParam);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
        
        // RECARREGAR DO SERVIDOR EM BACKGROUND para garantir sincronização
        console.log("🔄 [PeriodSelector] Recarregando lista do servidor em background...");
        
        // Usar múltiplas tentativas para garantir que funcione em produção
        const reloadWithRetry = async (retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              const updatedPeriodsList = await loadPeriods();
              
              // Verificar se o período está na lista
              const foundPeriod = updatedPeriodsList?.find(p => p.id === newPeriodData.id);
              if (foundPeriod) {
                console.log(`✅ [PeriodSelector] Período confirmado no servidor após ${i + 1} tentativa(s)`);
                
                // Atualizar estado com dados do servidor
                setPeriods(updatedPeriodsList);
                setActivePeriod(foundPeriod);
                setRefreshKey(prev => prev + 1);
                
                return true;
              }
              
              if (i < retries - 1) {
                console.log(`⏳ [PeriodSelector] Tentativa ${i + 1} falhou, aguardando antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Backoff exponencial
              }
            } catch (error) {
              console.error(`❌ [PeriodSelector] Erro na tentativa ${i + 1}:`, error);
              if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
              }
            }
          }
          return false;
        };
        
        // Iniciar recarregamento em background
        reloadWithRetry().then(success => {
          if (!success) {
            console.warn("⚠️ [PeriodSelector] Não foi possível confirmar período no servidor, mas ele está na lista local");
            // Mesmo se falhar, o período já está na lista local e funcionando
          }
        });
        
        // Mostrar mensagem
        const message = data.message || "Período criado com sucesso!";
        alert(`✅ ${message}\n\nO período foi criado e deve aparecer no dropdown. Se não aparecer, use o botão de refresh.`);
      } else {
        const errorMsg = data.error || "Erro ao criar período";
        console.error("[PeriodSelector] Erro na API:", errorMsg);
        alert(`Erro ao criar período: ${errorMsg}`);
      }
    } catch (err) {
      console.error("[PeriodSelector] Erro ao criar período:", err);
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      alert(`Erro ao criar período: ${errorMsg}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">Carregando períodos...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período Ativo
            </label>
            {activePeriod ? (
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-blue-600">
                  📅 {activePeriod.label || activePeriod.name}
                </span>
                <span className="text-xs text-gray-500">
                  ({activePeriod.year}/{String(activePeriod.month).padStart(2, "0")})
                </span>
              </div>
            ) : (
              <p className="text-sm text-orange-600 font-medium">
                ⚠️ Nenhum período ativo. Crie ou selecione um período para começar.
              </p>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
            <select
              key={`period-select-${periods.length}-${activePeriod?.id || 'none'}-${refreshKey}`}
              value={activePeriod?.id || ""}
              onChange={(e) => {
                if (e.target.value) {
                  handleActivatePeriod(e.target.value);
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="">Selecionar período...</option>
                {periods.length === 0 ? (
                  <option value="" disabled>Nenhum período disponível</option>
                ) : (
                  periods.map((period) => {
                    const displayText = `${period.label || period.name || `${period.year}/${String(period.month).padStart(2, "0")}`} (${period.year}/${String(period.month).padStart(2, "0")})`;
                    return (
                      <option key={period.id} value={period.id}>
                        {displayText}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              + Novo Período
            </button>
            <button
              onClick={() => {
                console.log("🔄 [PeriodSelector] Botão de refresh manual clicado");
                loadPeriods();
              }}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
              title="Recarregar lista de períodos"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

      {/* Modal de criação */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Criar Novo Período
            </h2>
            <form 
              onSubmit={(e) => {
                console.log("🚀🚀🚀 [PeriodSelector] FORM SUBMIT EVENT DISPARADO!");
                handleCreatePeriod(e);
              }} 
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ano *
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2030"
                  value={newPeriod.year}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, year: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mês *
                </label>
                <select
                  value={newPeriod.month}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, month: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {[
                    "Janeiro",
                    "Fevereiro",
                    "Março",
                    "Abril",
                    "Maio",
                    "Junho",
                    "Julho",
                    "Agosto",
                    "Setembro",
                    "Outubro",
                    "Novembro",
                    "Dezembro",
                  ].map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome (opcional)
                </label>
                <input
                  type="text"
                  value={newPeriod.name}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, name: e.target.value })
                  }
                  placeholder="Deixe em branco para nome automático"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                >
                  {creating ? "Criando..." : "Criar Período"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function PeriodSelector() {
  try {
    return (
      <Suspense 
        fallback={
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Carregando períodos...</p>
          </div>
        }
      >
        <PeriodSelectorInner />
      </Suspense>
    );
  } catch (error) {
    console.error("Erro no PeriodSelector:", error);
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-600">Erro ao carregar seletor de período. Recarregue a página.</p>
      </div>
    );
  }
}

