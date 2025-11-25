import { getSupabaseAdmin } from "@/lib/supabaseServer";
import Link from "next/link";

interface PageProps {
  params: Promise<{
    fileId: string;
  }>;
}

export default async function DiagnosticoPage({ params }: PageProps) {
  const { fileId } = await params;
  const supabaseAdmin = getSupabaseAdmin();

  // Buscar informações do arquivo SPED
  const { data: spedFile } = await supabaseAdmin
    .from("sped_files")
    .select("id, name")
    .eq("id", fileId)
    .single();

  // Verificar documentos de saída (ind_oper = '1')
  const { data: documentsSaida } = await supabaseAdmin
    .from("documents")
    .select("id, chv_nfe, ind_oper")
    .eq("sped_file_id", fileId)
    .eq("ind_oper", "1");

  // Verificar document_items de saída
  const { data: itemsSaida } = await supabaseAdmin
    .from("document_items")
    .select(`
      id,
      cod_item,
      movement_type,
      movement_qty,
      vl_item,
      document_id,
      documents!inner (
        id,
        sped_file_id,
        ind_oper,
        chv_nfe
      )
    `)
    .eq("documents.sped_file_id", fileId)
    .eq("movement_type", "saida")
    .limit(20);

  // Verificar document_items sem movement_type mas com ind_oper = '1'
  const { data: itemsSemTipo } = await supabaseAdmin
    .from("document_items")
    .select(`
      id,
      cod_item,
      movement_type,
      movement_qty,
      vl_item,
      document_id,
      documents!inner (
        id,
        sped_file_id,
        ind_oper,
        chv_nfe
      )
    `)
    .eq("documents.sped_file_id", fileId)
    .is("movement_type", null)
    .eq("documents.ind_oper", "1")
    .limit(20);

  // Verificar entradas para comparação
  const { data: itemsEntrada } = await supabaseAdmin
    .from("document_items")
    .select(`
      id,
      cod_item,
      movement_type,
      movement_qty,
      documents!inner (
        sped_file_id,
        ind_oper
      )
    `)
    .eq("documents.sped_file_id", fileId)
    .eq("movement_type", "entrada")
    .limit(10);

  // Estatísticas
  const totalDocumentosSaida = documentsSaida?.length || 0;
  const totalItemsSaida = itemsSaida?.length || 0;
  const totalItemsSemTipo = itemsSemTipo?.length || 0;
  const totalItemsEntrada = itemsEntrada?.length || 0;
  const totalQtdSaida = itemsSaida?.reduce((sum, item) => sum + Math.abs(item.movement_qty || 0), 0) || 0;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          🔍 Diagnóstico de Saídas
        </h1>
        <p className="text-sm text-gray-600">
          Arquivo SPED: {spedFile?.name || fileId}
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Documentos de Saída
          </h3>
          <p className="text-2xl font-bold text-gray-900">{totalDocumentosSaida}</p>
          <p className="text-xs text-gray-500 mt-1">ind_oper = '1'</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Itens com movement_type='saida'
          </h3>
          <p className="text-2xl font-bold text-blue-600">{totalItemsSaida}</p>
          <p className="text-xs text-gray-500 mt-1">Total qtd: {totalQtdSaida.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Itens sem tipo (ind_oper='1')
          </h3>
          <p className="text-2xl font-bold text-orange-600">{totalItemsSemTipo}</p>
          <p className="text-xs text-gray-500 mt-1">Precisam de movement_type</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Itens de Entrada
          </h3>
          <p className="text-2xl font-bold text-green-600">{totalItemsEntrada}</p>
          <p className="text-xs text-gray-500 mt-1">Para comparação</p>
        </div>
      </div>

      {/* Amostra de itens de saída */}
      {itemsSaida && itemsSaida.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Amostra de Itens de Saída (movement_type='saida')
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Código</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">movement_type</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">movement_qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">vl_item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Chave NFe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {itemsSaida.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-mono text-xs">{item.cod_item}</td>
                    <td className="px-3 py-2 text-red-600">{item.movement_type}</td>
                    <td className="px-3 py-2 text-right">{item.movement_qty}</td>
                    <td className="px-3 py-2 text-right">{item.vl_item?.toFixed(2) || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono">{item.documents?.chv_nfe?.substring(0, 20)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Itens sem movement_type */}
      {itemsSemTipo && itemsSemTipo.length > 0 && (
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4 mb-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">
            ⚠️ Itens sem movement_type (mas com ind_oper='1')
          </h3>
          <p className="text-sm text-orange-800 mb-3">
            Estes itens têm ind_oper='1' (saída) mas não têm movement_type definido.
            A VIEW deve usar ind_oper como fallback, mas é melhor ter movement_type explícito.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-orange-100">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-orange-700">Código</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-orange-700">movement_type</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-orange-700">movement_qty</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-orange-700">ind_oper</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-200">
                {itemsSemTipo.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-mono text-xs">{item.cod_item}</td>
                    <td className="px-3 py-2">{item.movement_type || 'NULL'}</td>
                    <td className="px-3 py-2 text-right">{item.movement_qty}</td>
                    <td className="px-3 py-2">{item.documents?.ind_oper}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Diagnóstico */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          📊 Diagnóstico
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          {totalDocumentosSaida === 0 && (
            <li>❌ <strong>Problema:</strong> Nenhum documento com ind_oper='1' encontrado. Verifique se o SPED foi importado corretamente.</li>
          )}
          {totalDocumentosSaida > 0 && totalItemsSaida === 0 && (
            <li>⚠️ <strong>Atenção:</strong> Existem {totalDocumentosSaida} documentos de saída, mas nenhum item com movement_type='saida'. Os XMLs podem não ter sido importados ou não foram vinculados corretamente.</li>
          )}
          {totalItemsSaida > 0 && (
            <li>✅ <strong>OK:</strong> {totalItemsSaida} itens de saída encontrados com movement_type='saida'.</li>
          )}
          {totalItemsSemTipo > 0 && (
            <li>⚠️ <strong>Atenção:</strong> {totalItemsSemTipo} itens têm ind_oper='1' mas não têm movement_type. A VIEW deve usar ind_oper como fallback.</li>
          )}
        </ul>
      </div>

      {/* Ações */}
      <div className="flex gap-3">
        <Link
          href={`/sped/${fileId}/inventario`}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          ← Voltar ao Inventário
        </Link>
        <Link
          href={`/sped/upload-xml-sales?fileId=${fileId}`}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
        >
          + Importar XMLs de Venda
        </Link>
      </div>
    </div>
  );
}

