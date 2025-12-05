import { Suspense } from "react";
import AppSidebar from "@/components/layout/AppSidebar";
import PeriodSelectorServer from "@/components/periods/PeriodSelectorServer";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AppSidebar />

      {/* Main content */}
      <div className="flex-1 ml-64">
        <main className="max-w-6xl mx-auto p-6">
          <Suspense
            fallback={
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600">Carregando períodos...</p>
              </div>
            }
          >
            <PeriodSelectorServer />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
