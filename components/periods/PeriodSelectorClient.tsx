"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createPeriodAction, setActivePeriodAction } from "@/app/periodos/configuracao/actions";
import type { Period } from "@/lib/periods";

interface PeriodSelectorClientProps {
  initialPeriods: Period[];
  initialActivePeriod: Period | null;
}

export default function PeriodSelectorClient({
  initialPeriods,
  initialActivePeriod,
}: PeriodSelectorClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Usar props como fonte de verdade e sincronizar quando mudarem
  const [periods, setPeriods] = useState<Period[]>(initialPeriods);
  const [activePeriod, setActivePeriod] = useState<Period | null>(initialActivePeriod);
  
  // Sincronizar estado com props quando mudarem (após router.refresh())
  useEffect(() => {
    setPeriods(initialPeriods);
    setActivePeriod(initialActivePeriod);
  }, [initialPeriods, initialActivePeriod]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ 
    year: new Date().getFullYear(), 
    month: new Date().getMonth() + 1, 
    name: "" 
  });
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleActivatePeriod = async (periodId: string) => {
    setActivating(true);
    try {
      const result = await setActivePeriodAction(periodId);
      
      if (result.ok && result.period) {
        setActivePeriod(result.period);
        
        // Atualizar URL com query param
        const periodParam = `${result.period.year}-${result.period.month}`;
        const params = new URLSearchParams(searchParams.toString());
        params.set("period", periodParam);
        const newUrl = `${pathname}?${params.toString()}`;
        
        router.replace(newUrl, { scroll: false });
        router.refresh();
      } else {
        alert(`❌ Erro: ${result.error || "Erro ao ativar período"}`);
      }
    } catch (err) {
      console.error("Erro ao ativar período:", err);
      alert("Erro ao ativar período");
    } finally {
      setActivating(false);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await createPeriodAction(newPeriod);
      
      if (result.ok && result.period) {
        const newPeriodData = result.period;
        
        // Fechar modal
        setShowCreateModal(false);
        setNewPeriod({ 
          year: new Date().getFullYear(), 
          month: new Date().getMonth() + 1, 
          name: "" 
        });
        
        // Atualizar período ativo localmente
        setActivePeriod(newPeriodData);
        
        // Preparar URL do novo período
        const periodParam = `${newPeriodData.year}-${newPeriodData.month}`;
        const params = new URLSearchParams(searchParams.toString());
        params.set("period", periodParam);
        const newUrl = `${pathname}?${params.toString()}`;
        
        // Atualizar URL e recarregar dados do servidor
        router.replace(newUrl, { scroll: false });
        router.refresh();
      } else {
        alert(`❌ Erro: ${result.error || "Erro ao criar período"}`);
      }
    } catch (err) {
      console.error("Erro ao criar período:", err);
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      alert(`❌ Erro ao criar período: ${errorMsg}`);
    } finally {
      setCreating(false);
    }
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const formatPeriodDisplay = (period: Period) => {
    if (period.label && period.label.trim()) {
      return period.label;
    }
    
    const name = period.name?.trim();
    if (name && name.length > 1 && !/^\d+$/.test(name)) {
      return name;
    }
    
    const monthName = monthNames[period.month - 1] || `Mês ${period.month}`;
    return `${monthName} ${period.year}`;
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
                value={activePeriod?.id || ""}
                onChange={(e) => {
                  if (e.target.value && !activating) {
                    handleActivatePeriod(e.target.value);
                  }
                }}
                disabled={activating}
                className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-blue-400 transition-colors min-w-[240px] disabled:opacity-50 disabled:cursor-not-allowed"
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
                      let displayText = formatPeriodDisplay(period);
                      
                      if (!displayText || displayText.trim() === '') {
                        displayText = `${period.year}/${String(period.month).padStart(2, '0')}`;
                      }
                      
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
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              title="Criar novo período"
            >
              <span className="text-lg">+</span>
              Novo Período
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
            
            <form onSubmit={handleCreatePeriod} className="space-y-5">
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
                    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
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

