"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PeriodSelector from "@/components/periods/PeriodSelector";

export default function AppLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 fixed h-full overflow-y-auto">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">
            Inventário SPED
          </h1>
          <nav className="space-y-1">
            <Link
              href="/"
              className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Dashboard
            </Link>
            <div className="pt-4">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Importações
              </p>
              <Link
                href="/stock-initial/upload"
                className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/stock-initial")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Estoque inicial
              </Link>
              <Link
                href="/sped/upload"
                className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/sped/upload")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                SPED
              </Link>
              <Link
                href="/sped/upload-xml-sales"
                className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/sped/upload-xml-sales")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                XMLs de vendas
              </Link>
              <Link
                href="/cadastro-produtos/upload"
                className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive("/cadastro-produtos")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Cadastro de Produtos
              </Link>
            </div>
          <div className="pt-6">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Movimentações
            </p>
            <Link
              href="/movimentacoes/entradas"
              className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/movimentacoes/entradas")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Entradas
            </Link>
            <Link
              href="/movimentacoes/saidas"
              className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/movimentacoes/saidas")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Saídas
            </Link>
            <Link
              href="/movimentacoes/consolidado"
              className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/movimentacoes/consolidado")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Consolidação
            </Link>
          </div>
          <div className="pt-6">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Ajustes
            </p>
            <Link
              href="/ajustes"
              className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/ajustes")
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Ajustes de Códigos
            </Link>
            <Link
              href="/ajustes/relatorio"
              className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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

      {/* Main content */}
      <div className="flex-1 ml-64">
        <main className="max-w-6xl mx-auto p-6">
          <PeriodSelector />
          {children}
        </main>
      </div>
    </div>
  );
}

