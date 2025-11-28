"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Erro Crítico
            </h2>
            <p className="text-gray-700 mb-4">
              Ocorreu um erro crítico no sistema. Por favor, recarregue a página.
            </p>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Tentar novamente
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
              >
                Voltar ao início
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}



