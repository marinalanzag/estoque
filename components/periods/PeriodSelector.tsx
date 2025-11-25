"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Period {
  id: string;
  year: number;
  month: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
}

export default function PeriodSelector() {
  const router = useRouter();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [activePeriod, setActivePeriod] = useState<Period | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, name: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadPeriods();
    loadActivePeriod();
  }, []);

  const loadPeriods = async () => {
    try {
      const res = await fetch("/api/periods/list");
      const data = await res.json();
      if (data.ok) {
        setPeriods(data.periods || []);
      }
    } catch (err) {
      console.error("Erro ao carregar períodos:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadActivePeriod = async () => {
    try {
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
      if (data.ok) {
        setActivePeriod(data.period);
        // Recarregar a página para atualizar todos os dados
        router.refresh();
      }
    } catch (err) {
      console.error("Erro ao ativar período:", err);
      alert("Erro ao ativar período");
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/periods/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPeriod),
      });
      const data = await res.json();
      if (data.ok) {
        setShowCreateModal(false);
        setNewPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, name: "" });
        await loadPeriods();
        await loadActivePeriod();
        router.refresh();
      } else {
        alert(data.error || "Erro ao criar período");
      }
    } catch (err) {
      console.error("Erro ao criar período:", err);
      alert("Erro ao criar período");
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
                  📅 {activePeriod.name}
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
                  {period.name} ({period.year}/{String(period.month).padStart(2, "0")})
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateModal(true)}
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
            <form onSubmit={handleCreatePeriod} className="space-y-4">
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

