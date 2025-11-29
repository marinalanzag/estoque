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
      // SEMPRE buscar período ativo da API primeiro (fonte de verdade)
      const res = await fetch(`/api/periods/active?t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      const data = await res.json();
      
      if (data.ok && data.period) {
        const activeFromServer = data.period;
        
        // Verificar se o query param corresponde ao período ativo
        const periodParam = searchParams.get("period");
        const expectedParam = `${activeFromServer.year}-${activeFromServer.month}`;
        
        // Se o query param não corresponder, atualizar URL
        if (periodParam !== expectedParam) {
          console.log(`[PeriodSelector] Query param (${periodParam}) não corresponde ao período ativo (${expectedParam}). Atualizando URL...`);
          const params = new URLSearchParams(searchParams.toString());
          params.set("period", expectedParam);
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
        
        // Definir período ativo
        setActivePeriod(activeFromServer);
        
        // Sempre garantir que o período ativo está na lista
        setPeriods(prev => {
          const exists = prev.find(p => p.id === activeFromServer.id);
          if (!exists) {
            const newList = [activeFromServer, ...prev].sort((a, b) => {
              if (b.year !== a.year) return b.year - a.year;
              return b.month - a.month;
            });
            setRefreshKey(prev => prev + 1);
            return newList;
          }
          // Atualizar período existente se houver mudanças (especialmente is_active)
          const updated = prev.map(p => p.id === activeFromServer.id ? activeFromServer : p);
          if (JSON.stringify(prev) !== JSON.stringify(updated)) {
            setRefreshKey(prev => prev + 1);
          }
          return updated;
        });
        
        setRefreshKey(prev => prev + 1);
      } else if (data.ok && !data.period) {
        // Nenhum período ativo - remover query param se existir
        if (searchParams.get("period")) {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("period");
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
        setActivePeriod(null);
        setRefreshKey(prev => prev + 1);
      }
    } catch (err) {
      console.error("[PeriodSelector] Erro ao carregar período ativo:", err);
      setActivePeriod(null);
    }
  };

  const handleActivatePeriod = async (periodId: string) => {
    try {
      const res = await fetch("/api/periods/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
        cache: "no-store",
      });
      const data = await res.json();
      if (data.ok && data.period) {
        setActivePeriod(data.period);
        setRefreshKey(prev => prev + 1);
        
        // Atualizar URL com query param ?period=YYYY-MM
        const periodParam = `${data.period.year}-${data.period.month}`;
        const params = new URLSearchParams(searchParams.toString());
        params.set("period", periodParam);
        
        const newUrl = `${pathname}?${params.toString()}`;
        
        // Recarregar períodos do servidor primeiro
        await loadPeriods();
        
        // Atualizar URL e forçar revalidação das páginas server-side
        router.replace(newUrl, { scroll: false });
        router.refresh();
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
        
        // Atualizar URL e forçar revalidação das páginas server-side
        const periodParam = `${newPeriodData.year}-${newPeriodData.month}`;
        
        // Construir nova URL com query params
        const params = new URLSearchParams();
        if (searchParams) {
          searchParams.forEach((value, key) => {
            if (key !== 'period') {
              params.set(key, value);
            }
          });
        }
        params.set("period", periodParam);
        const newUrl = `${pathname}?${params.toString()}`;
        
        // RECARREGAR DO SERVIDOR PRIMEIRO antes de atualizar URL
        console.log("🔄 [PeriodSelector] Recarregando lista do servidor...");
        
        // Função para recarregar e atualizar
        const reloadAndUpdate = async (retries = 3) => {
          for (let i = 0; i < retries; i++) {
            try {
              // Aguardar um pouco para garantir que o período foi salvo no banco
              await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
              
              // Recarregar períodos do servidor
              const updatedPeriodsList = await loadPeriods();
              
              // Verificar se o período está na lista
              const foundPeriod = updatedPeriodsList?.find(p => p.id === newPeriodData.id);
              if (foundPeriod) {
                console.log(`✅ [PeriodSelector] Período confirmado no servidor após ${i + 1} tentativa(s)`);
                
                // Atualizar estado com dados do servidor
                setPeriods(updatedPeriodsList);
                setActivePeriod(foundPeriod);
                setRefreshKey(prev => prev + 1);
                
                // Agora atualizar URL e forçar refresh das páginas server-side
                console.log("🔄 [PeriodSelector] Forçando revalidação das páginas server-side...");
                
                // Usar router.replace para atualizar URL e forçar revalidação
                router.replace(newUrl, { scroll: false });
                
                // Forçar refresh do router para atualizar páginas server-side
                router.refresh();
                
                return true;
              }
              
              if (i < retries - 1) {
                console.log(`⏳ [PeriodSelector] Tentativa ${i + 1} falhou, aguardando antes de tentar novamente...`);
              }
            } catch (error) {
              console.error(`❌ [PeriodSelector] Erro na tentativa ${i + 1}:`, error);
              if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
              }
            }
          }
          return false;
        };
        
        // Iniciar recarregamento
        reloadAndUpdate().then(success => {
          if (!success) {
            console.warn("⚠️ [PeriodSelector] Não foi possível confirmar período no servidor, forçando refresh mesmo assim...");
            // Mesmo se falhar, tentar atualizar URL e forçar refresh
            router.replace(newUrl, { scroll: false });
            router.refresh();
          }
        });
        
        // Mostrar mensagem
        const message = data.message || "Período criado com sucesso!";
        alert(`✅ ${message}\n\nA página será atualizada automaticamente para refletir o novo período.`);
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

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const formatPeriodDisplay = (period: Period) => {
    const monthName = monthNames[period.month - 1] || `Mês ${period.month}`;
    const label = period.label || `${monthName} ${period.year}`;
    return label;
  };

  return (
    <>
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 mb-6 shadow-md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Status do Período Ativo */}
          <div className="flex-1 min-w-[300px]">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Período de Trabalho Atual
            </label>
            {activePeriod ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border-2 border-blue-400 shadow-sm">
                  <span className="text-2xl">📅</span>
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-blue-700">
                      {formatPeriodDisplay(activePeriod)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {activePeriod.year}/{String(activePeriod.month).padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  ATIVO
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-orange-50 border-2 border-orange-300 px-4 py-3 rounded-lg">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-orange-800">
                    Nenhum período ativo
                  </p>
                  <p className="text-xs text-orange-600">
                    Crie ou selecione um período para começar
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex gap-2 items-start flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Trocar Período
              </label>
              <select
                key={`period-select-${periods.length}-${activePeriod?.id || 'none'}-${refreshKey}`}
                value={activePeriod?.id || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    handleActivatePeriod(e.target.value);
                  }
                }}
                className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-blue-400 transition-colors min-w-[240px]"
              >
                <option value="">Selecionar período...</option>
                {periods.length === 0 ? (
                  <option value="" disabled>Nenhum período disponível</option>
                ) : (() => {
                  // Agrupar períodos por ano
                  const groupedByYear = periods.reduce((acc, period) => {
                    if (!acc[period.year]) {
                      acc[period.year] = [];
                    }
                    acc[period.year].push(period);
                    return acc;
                  }, {} as Record<number, Period[]>);

                  // Ordenar anos do mais recente para o mais antigo
                  const sortedYears = Object.keys(groupedByYear)
                    .map(Number)
                    .sort((a, b) => b - a);

                  const options: JSX.Element[] = [];
                  
                  sortedYears.forEach((year, yearIndex) => {
                    const yearPeriods = groupedByYear[year].sort((a, b) => b.month - a.month);
                    
                    // Adicionar separador de ano se houver múltiplos anos
                    if (sortedYears.length > 1 && yearIndex > 0) {
                      options.push(
                        <option key={`sep-${year}`} disabled>
                          ─────────────────────
                        </option>
                      );
                    }
                    
                    // Adicionar períodos do ano
                    yearPeriods.forEach((period) => {
                      const isActive = period.id === activePeriod?.id;
                      const displayText = formatPeriodDisplay(period);
                      options.push(
                        <option 
                          key={period.id} 
                          value={period.id}
                          style={isActive ? { fontWeight: 'bold', backgroundColor: '#dbeafe' } : {}}
                        >
                          {isActive ? "✓ " : ""}{displayText} {sortedYears.length > 1 ? `(${year})` : ''}
                        </option>
                      );
                    });
                  });
                  
                  return options;
                })()}
              </select>
            </div>
            
            <button
              onClick={() => {
                setShowCreateModal(true);
              }}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              title="Criar novo período"
            >
              <span className="text-lg">+</span>
              Novo Período
            </button>
            
            <button
              onClick={() => {
                console.log("🔄 [PeriodSelector] Botão de refresh manual clicado");
                loadPeriods().then(() => {
                  loadActivePeriod();
                });
              }}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium shadow-sm hover:shadow transition-all"
              title="Recarregar lista de períodos"
            >
              <span className="text-lg">🔄</span>
            </button>
          </div>
        </div>

        {/* Informação adicional */}
        {periods.length > 0 && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>
                Total de períodos cadastrados: <strong>{periods.length}</strong>
              </span>
              {activePeriod && (
                <span>
                  Criado em: {new Date(activePeriod.created_at).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de criação */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border-2 border-blue-200">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-3xl">📅</span>
                Criar Novo Período
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
                title="Fechar"
              >
                ×
              </button>
            </div>
            
            <form 
              onSubmit={(e) => {
                console.log("🚀🚀🚀 [PeriodSelector] FORM SUBMIT EVENT DISPARADO!");
                handleCreatePeriod(e);
              }} 
              className="space-y-5"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ano <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2030"
                  value={newPeriod.year}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, year: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Mês <span className="text-red-500">*</span>
                </label>
                <select
                  value={newPeriod.month}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, month: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium bg-white"
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Personalizado <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={newPeriod.name}
                  onChange={(e) =>
                    setNewPeriod({ ...newPeriod, name: e.target.value })
                  }
                  placeholder="Ex: Período de Abertura ou deixe em branco"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Se deixar em branco, será gerado automaticamente (ex: &quot;Janeiro 2024&quot;)
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-xs text-blue-800">
                  <strong>⚠️ Atenção:</strong> Ao criar um novo período, todos os outros períodos serão automaticamente desativados. Este período será ativado imediatamente.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Criando...
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      Criar Período
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
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

