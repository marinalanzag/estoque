"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppSidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 fixed h-full overflow-y-auto">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">
          Inventário SPED
        </h1>
        <nav className="space-y-1">
          <Link
            href="/periodos/configuracao"
            className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive("/periodos/configuracao")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Configuração do Período
          </Link>
          <div className="pt-6 space-y-1">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Movimentações
            </p>
            <Link
              href="/movimentacoes/entradas"
              className={`block w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/movimentacoes/entradas")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Entradas
            </Link>
            <Link
              href="/movimentacoes/saidas"
              className={`block w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/movimentacoes/saidas")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Saídas
            </Link>
            <Link
              href="/movimentacoes/consolidado"
              className={`block w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/movimentacoes/consolidado")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Consolidação
            </Link>
          </div>
          <div className="pt-6 space-y-1">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Ajustes
            </p>
            <Link
              href="/ajustes"
              className={`block w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/ajustes")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Ajustes de Códigos
            </Link>
            <Link
              href="/ajustes/relatorio"
              className={`block w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/ajustes/relatorio")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Relatório de Ajustes
            </Link>
          </div>
          <div className="pt-6">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Inventário
            </p>
            <Link
              href="/inventario-final"
              className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/inventario-final")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Inventário Final
            </Link>
          </div>
        </nav>
      </div>
    </aside>
  );
}

