import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  getActivePeriodFromRequest,
  getBaseStockImportForPeriod,
  getBaseSpedFileForPeriod,
  getSpedFilesForPeriod,
  getXmlImportsForPeriod,
  getStockImportsForPeriod,
  getBaseXmlImportsForPeriod,
  getUnlinkedStockImports,
} from "@/lib/periods";
import Link from "next/link";
import SetBaseButton from "@/components/periods/SetBaseButton";
import LinkPeriodButton from "@/components/periods/LinkPeriodButton";

export const dynamic = "force-dynamic";

interface ConfiguracaoPageProps {
  searchParams?: {
    success?: string;
    importId?: string;
  };
}

export default async function ConfiguracaoPage({
  searchParams,
}: ConfiguracaoPageProps) {
  const supabaseAdmin = getSupabaseAdmin();
  
  // SEMPRE buscar período ativo do banco (ignorar query params/cookies antigos)
  console.log("[configuracao/page] Buscando período ativo do banco de dados...");
  const activePeriod = await getActivePeriodFromRequest();
  
  if (activePeriod) {
    console.log(`[configuracao/page] ✅ Período ativo encontrado: ${activePeriod.year}/${activePeriod.month} - ${activePeriod.name} (ID: ${activePeriod.id.substring(0, 8)}...)`);
  } else {
    console.log("[configuracao/page] ⚠️ Nenhum período ativo encontrado no banco.");
  }

  if (!activePeriod) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Configuração do Período
        </h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Nenhum período ativo foi selecionado.
          </p>
          <p className="text-yellow-700 text-sm mt-2">
            Acesse a página de períodos para escolher um período.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800 underline"
          >
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    );
  }

  // Buscar dados do período
  const [
    baseStockId,
    baseSpedId,
    stockImports,
    unlinkedStockImports,
    spedFiles,
    xmlImports,
    baseXmlIds,
  ] = await Promise.all([
    getBaseStockImportForPeriod(activePeriod.id),
    getBaseSpedFileForPeriod(activePeriod.id),
    getStockImportsForPeriod(activePeriod.id),
    getUnlinkedStockImports(),
    getSpedFilesForPeriod(activePeriod.id),
    getXmlImportsForPeriod(activePeriod.id),
    getBaseXmlImportsForPeriod(activePeriod.id),
  ]);

  const baseStock = baseStockId
    ? stockImports.find((s) => s.id === baseStockId)
    : null;

  const baseSped = baseSpedId
    ? spedFiles.find((s) => s.id === baseSpedId)
    : null;

  const baseXmlSet = new Set(baseXmlIds);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Configuração do Período
          </h1>
          <p className="text-gray-600 mt-1">
            {activePeriod.label || `${activePeriod.month}/${activePeriod.year}`}
          </p>
        </div>
        <Link
          href="/movimentacoes/consolidado"
          className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Voltar para Movimentações
        </Link>
      </div>

      {searchParams?.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{searchParams.success}</p>
        </div>
      )}
      
      {searchParams?.importId && !baseStockId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 font-medium mb-2">
            ✅ Arquivo importado com sucesso!
          </p>
          <p className="text-blue-700 text-sm mb-3">
            {stockImports.find(s => s.id === searchParams.importId) 
              ? "O arquivo foi importado e vinculado ao período. Se não houver outro estoque base, ele foi marcado automaticamente como base."
              : "O arquivo foi importado. Verifique abaixo se precisa marcar como base."}
          </p>
        </div>
      )}

      {/* Seção: Estoque Inicial */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            📦 Estoque Inicial
          </h2>
        </div>

        {baseStock ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {baseStock.label || "Estoque inicial"}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                    ✔ Base
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(baseStock.created_at).toLocaleDateString("pt-BR")}
                  {baseStock.total_items && (
                    <> • {baseStock.total_items} itens</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <SetBaseButton
                  type="stock"
                  id={baseStock.id}
                  isBase={true}
                  label="Desmarcar como base"
                />
                <Link
                  href="/stock-initial/upload"
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Reimportar
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm">
              Nenhum estoque inicial configurado como base.
            </p>
            <div className="flex gap-2">
              <Link
                href="/stock-initial/upload"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Importar arquivo
              </Link>
            </div>
            {stockImports.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Importações vinculadas ao período:
                </p>
                {stockImports.map((stock) => (
                  <div
                    key={stock.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {stock.label || "Estoque inicial"}
                      </span>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(stock.created_at).toLocaleDateString("pt-BR")}
                        {stock.total_items && (
                          <> • {stock.total_items} itens</>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <SetBaseButton
                        type="stock"
                        id={stock.id}
                        isBase={false}
                        label="Marcar como base"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {unlinkedStockImports.length > 0 && (
              <div className="mt-4 space-y-2 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-yellow-800 mb-2">
                  ⚠️ Importações não vinculadas ao período:
                </p>
                <p className="text-xs text-yellow-700 mb-3">
                  As importações abaixo foram feitas mas não estão vinculadas ao período atual. Vincule-as para que possam ser marcadas como base.
                </p>
                {unlinkedStockImports.map((stock) => (
                  <div
                    key={stock.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-300"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {stock.label || "Estoque inicial"}
                      </span>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(stock.created_at).toLocaleDateString("pt-BR")}
                        {stock.total_items && (
                          <> • {stock.total_items} itens</>
                        )}
                      </p>
                    </div>
                    <LinkPeriodButton
                      type="stock"
                      id={stock.id}
                      label="Vincular ao Período"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Seção: SPED Fiscal */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            📄 SPED Fiscal (Entradas)
          </h2>
        </div>

        {spedFiles.length === 0 ? (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm">
              Nenhum arquivo SPED importado para este período.
            </p>
            <Link
              href="/sped/upload"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Importar SPED
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {spedFiles.map((sped) => (
              <div
                key={sped.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {sped.name}
                    </span>
                    {sped.is_base && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        ✔ Base
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(sped.uploaded_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {sped.is_base ? (
                    <SetBaseButton
                      type="sped"
                      id={sped.id}
                      isBase={true}
                      label="Desmarcar"
                    />
                  ) : (
                    <SetBaseButton
                      type="sped"
                      id={sped.id}
                      isBase={false}
                      label="Marcar como base"
                    />
                  )}
                  <Link
                    href="/sped/upload"
                    className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Reimportar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Seção: XMLs de Saída */}
      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            📤 XMLs de Saída
          </h2>
        </div>

        {xmlImports.length === 0 ? (
          <div className="space-y-3">
            <p className="text-gray-600 text-sm">
              Nenhuma importação de XML para este período.
            </p>
            <Link
              href="/sped/upload-xml-sales"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Importar XMLs
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {xmlImports.map((xml) => {
              const dateStr = new Date(xml.created_at).toLocaleDateString(
                "pt-BR"
              );
              return (
                <div
                  key={xml.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {xml.label || `Importação - ${dateStr}`}
                      </span>
                      {baseXmlSet.has(xml.id) && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                          ✔ Base
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {dateStr} • {xml.total_xmls || 0} XMLs •{" "}
                      {xml.total_items || 0} itens
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <SetBaseButton
                      type="xml"
                      id={xml.id}
                      isBase={baseXmlSet.has(xml.id)}
                      label={
                        baseXmlSet.has(xml.id)
                          ? "Desmarcar"
                          : "Usar como base"
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}


