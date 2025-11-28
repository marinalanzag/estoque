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

  useEffect(() => {
    loadPeriods();
    loadActivePeriod();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPeriods = async () => {
    try {
      // Adicionar timestamp para evitar cache
      const res = await fetch(`/api/periods/list?t=${Date.now()}`, {
        cache: "no-store",
      });
      
      if (!res.ok) {
        console.error("[PeriodSelector] Resposta não OK:", res.status, res.statusText);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (data.ok) {
        const periodsList = (data.periods || []) as Period[];
        console.log(`[PeriodSelector] Carregados ${periodsList.length} períodos:`, periodsList.map((p: Period) => `${p.year}/${p.month} - ${p.name || p.label || 'sem nome'}`));
        setPeriods(periodsList);
      } else {
        console.error("[PeriodSelector] Erro ao carregar períodos:", data.error);
      }
    } catch (err) {
      console.error("[PeriodSelector] Erro ao carregar períodos:", err);
    } finally {
      setLoading(false);
    }
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
          const period = periods.find(p => p.year === year && p.month === month);
          if (period) {
            setActivePeriod(period);
            return;
          }
        }
      }
      
      // Fallback: buscar período ativo da API
      const res = await fetch("/api/periods/active");
      const data = await res.json();
      if (data.ok) {
        setActivePeriod(data.period);
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
        
        // Adicionar o período criado diretamente à lista
        const newPeriodData = data.period;
        setPeriods(prev => {
          // Verificar se já não está na lista
          const exists = prev.find(p => p.id === newPeriodData.id);
          if (exists) {
            console.log("⚠️ [PeriodSelector] Período já estava na lista, atualizando...");
            return prev.map(p => p.id === newPeriodData.id ? newPeriodData : p);
          }
          console.log("➕ [PeriodSelector] Adicionando novo período à lista");
          return [newPeriodData, ...prev].sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            return b.month - a.month;
          });
        });
        
        // Setar como período ativo
        setActivePeriod(newPeriodData);
        
        setShowCreateModal(false);
        setNewPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, name: "" });
        
        // Se a resposta inclui mensagem, mostrar
        if (data.message) {
          console.log("[PeriodSelector]", data.message);
          alert(`✅ ${data.message}`);
        } else {
          alert("✅ Período criado com sucesso!");
        }
        
        // Recarregar períodos do servidor para garantir sincronização
        setTimeout(async () => {
          console.log("🔄 [PeriodSelector] Recarregando períodos do servidor...");
          await loadPeriods();
          await loadActivePeriod();
        }, 500);
        
        // Forçar refresh da página
        router.refresh();
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
          <div className="flex gap-2">
            <select
              value={activePeriod?.id || ""}
              onChange={(e) => {
                if (e.target.value) {
                  handleActivatePeriod(e.target.value);
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecionar período...</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label || period.name} ({period.year}/{String(period.month).padStart(2, "0")})
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                console.log("🚀 [PeriodSelector] Botão 'Novo Período' clicado");
                setShowCreateModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              + Novo Período
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

