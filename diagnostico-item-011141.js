/**
 * DIAGNÓSTICO COMPLETO DO ITEM 011141
 * 
 * Este script investiga a discrepância entre:
 * - Consolidação: mostra 29 (correto)
 * - Ajustes: mostra -28 (incorreto)
 * - Inventário Final: mostra 10 (após ajuste de 9)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Normalizar código do item
function normalizeCodItem(cod) {
  if (!cod) return '';
  return String(cod).trim().padStart(6, '0');
}

async function diagnosticoCompleto() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO COMPLETO - ITEM 011141');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const codItem = '011141';
  const codItemNormalizado = normalizeCodItem(codItem);

  // 1. ESTOQUE INICIAL
  console.log('1️⃣ ESTOQUE INICIAL:');
  console.log('─────────────────────────────────────────────────────────────');
  const { data: estoqueInicial, error: errEstoque } = await supabase
    .from('stock_initial')
    .select(`
      id,
      cod_item,
      qtd,
      unit_cost,
      unid,
      import_id,
      stock_initial_imports!inner(id, label, period_id, is_base, created_at)
    `)
    .or(`cod_item.eq.${codItem},cod_item.like.%${codItem}%`);

  if (errEstoque) {
    console.error('❌ Erro ao buscar estoque inicial:', errEstoque);
  } else {
    console.log(`   Total de registros: ${estoqueInicial?.length || 0}`);
    let totalQtd = 0;
    estoqueInicial?.forEach((item) => {
      const qtd = Number(item.qtd || 0);
      totalQtd += qtd;
      console.log(`   - Import: ${item.stock_initial_imports.label} (Base: ${item.stock_initial_imports.is_base ? 'SIM' : 'NÃO'})`);
      console.log(`     Qtd: ${qtd}, Custo: R$ ${Number(item.unit_cost || 0).toFixed(2)}`);
    });
    console.log(`   📊 TOTAL ESTOQUE INICIAL: ${totalQtd.toFixed(2)}\n`);
  }

  // 2. ENTRADAS (SPED)
  console.log('2️⃣ ENTRADAS (SPED):');
  console.log('─────────────────────────────────────────────────────────────');
  const { data: entradas, error: errEntradas } = await supabase
    .from('document_items')
    .select(`
      id,
      cod_item,
      qtd,
      movement_qty,
      movement_type,
      vl_item,
      document_item_adjustments(adjusted_qty),
      documents!inner(sped_file_id, ind_oper, num_doc, dt_doc, sped_files!inner(name))
    `)
    .or(`cod_item.eq.${codItem},cod_item.like.%${codItem}%`)
    .or('movement_type.eq.entrada,and(movement_type.is.null,documents.ind_oper.eq.0)');

  if (errEntradas) {
    console.error('❌ Erro ao buscar entradas:', errEntradas);
  } else {
    console.log(`   Total de registros: ${entradas?.length || 0}`);
    let totalQtdEntradas = 0;
    let totalQtdAjustada = 0;
    entradas?.forEach((item) => {
      const qtdOriginal = Math.abs(Number(item.movement_qty || item.qtd || 0));
      const qtdAjustada = item.document_item_adjustments?.[0]?.adjusted_qty;
      const qtdFinal = qtdAjustada !== null && qtdAjustada !== undefined 
        ? Number(qtdAjustada) 
        : qtdOriginal;
      
      totalQtdEntradas += qtdOriginal;
      totalQtdAjustada += qtdFinal;
      
      console.log(`   - Doc: ${item.documents.num_doc} (${item.documents.dt_doc})`);
      console.log(`     SPED: ${item.documents.sped_files.name}`);
      console.log(`     Qtd Original: ${qtdOriginal.toFixed(2)}`);
      if (qtdAjustada !== null && qtdAjustada !== undefined) {
        console.log(`     Qtd Ajustada: ${qtdAjustada.toFixed(2)} ⚠️`);
      }
      console.log(`     Qtd Final Usada: ${qtdFinal.toFixed(2)}`);
      console.log(`     Valor: R$ ${Number(item.vl_item || 0).toFixed(2)}`);
    });
    console.log(`   📊 TOTAL ENTRADAS (Original): ${totalQtdEntradas.toFixed(2)}`);
    console.log(`   📊 TOTAL ENTRADAS (Ajustada): ${totalQtdAjustada.toFixed(2)}\n`);
  }

  // 3. SAÍDAS (XMLs)
  console.log('3️⃣ SAÍDAS (XMLs):');
  console.log('─────────────────────────────────────────────────────────────');
  
  // Primeiro, buscar todos os XML imports
  const { data: xmlImports, error: errXmlImports } = await supabase
    .from('xml_sales_imports')
    .select('id, label, period_id, is_base, created_at, sped_file_id')
    .order('created_at', { ascending: false });

  if (errXmlImports) {
    console.error('❌ Erro ao buscar XML imports:', errXmlImports);
  } else {
    console.log(`   Total de XML imports: ${xmlImports?.length || 0}`);
    
    // Buscar saídas de TODOS os XMLs
    const { data: saidas, error: errSaidas } = await supabase
      .from('document_items')
      .select(`
        id,
        cod_item,
        qtd,
        movement_qty,
        movement_type,
        vl_item,
        xml_import_id,
        xml_sales_imports!inner(id, label, period_id, is_base, created_at)
      `)
      .or(`cod_item.eq.${codItem},cod_item.like.%${codItem}%`)
      .eq('movement_type', 'saida');

    if (errSaidas) {
      console.error('❌ Erro ao buscar saídas:', errSaidas);
    } else {
      console.log(`   Total de registros de saída: ${saidas?.length || 0}`);
      
      // Agrupar por XML import
      const saidasPorXml = {};
      let totalQtdSaidas = 0;
      
      saidas?.forEach((item) => {
        const xmlId = item.xml_import_id;
        if (!saidasPorXml[xmlId]) {
          saidasPorXml[xmlId] = {
            xml: item.xml_sales_imports,
            items: []
          };
        }
        
        const qtd = Math.abs(Number(item.movement_qty || item.qtd || 0));
        totalQtdSaidas += qtd;
        
        saidasPorXml[xmlId].items.push({
          qtd,
          valor: Number(item.vl_item || 0)
        });
      });

      // Mostrar por XML
      Object.values(saidasPorXml).forEach((grupo) => {
        const totalXml = grupo.items.reduce((sum, item) => sum + item.qtd, 0);
        console.log(`   - XML: ${grupo.xml.label}`);
        console.log(`     Base: ${grupo.xml.is_base ? 'SIM' : 'NÃO'}`);
        console.log(`     Período: ${grupo.xml.period_id || 'N/A'}`);
        console.log(`     Total Qtd: ${totalXml.toFixed(2)}`);
        console.log(`     Itens: ${grupo.items.length}`);
      });
      
      console.log(`   📊 TOTAL SAÍDAS: ${totalQtdSaidas.toFixed(2)}\n`);
    }
  }

  // 4. AJUSTES DE CÓDIGOS
  console.log('4️⃣ AJUSTES DE CÓDIGOS:');
  console.log('─────────────────────────────────────────────────────────────');
  const { data: ajustes, error: errAjustes } = await supabase
    .from('code_offset_adjustments')
    .select(`
      id,
      cod_negativo,
      cod_positivo,
      qtd_baixada,
      unit_cost,
      total_value,
      period_id,
      sped_file_id,
      created_at,
      periods(label),
      sped_files(name)
    `)
    .or(`cod_negativo.eq.${codItem},cod_negativo.like.%${codItem}%,cod_positivo.eq.${codItem},cod_positivo.like.%${codItem}%`)
    .order('created_at', { ascending: false });

  if (errAjustes) {
    console.error('❌ Erro ao buscar ajustes:', errAjustes);
  } else {
    console.log(`   Total de ajustes: ${ajustes?.length || 0}`);
    
    let totalRecebido = 0;
    let totalFornecido = 0;
    
    ajustes?.forEach((adj) => {
      const qtd = Number(adj.qtd_baixada || 0);
      const codNeg = normalizeCodItem(adj.cod_negativo);
      const codPos = normalizeCodItem(adj.cod_positivo);
      
      if (codNeg === codItemNormalizado) {
        totalRecebido += qtd;
        console.log(`   - RECEBIDO: ${qtd.toFixed(2)} de ${adj.cod_positivo}`);
      }
      if (codPos === codItemNormalizado) {
        totalFornecido += qtd;
        console.log(`   - FORNECIDO: ${qtd.toFixed(2)} para ${adj.cod_negativo}`);
      }
      console.log(`     Período: ${adj.periods?.label || adj.period_id || 'N/A'}`);
      console.log(`     Data: ${new Date(adj.created_at).toLocaleString('pt-BR')}`);
    });
    
    console.log(`   📊 TOTAL RECEBIDO: ${totalRecebido.toFixed(2)}`);
    console.log(`   📊 TOTAL FORNECIDO: ${totalFornecido.toFixed(2)}\n`);
  }

  // 5. CÁLCULO SIMULADO - CONSOLIDAÇÃO
  console.log('5️⃣ CÁLCULO SIMULADO - CONSOLIDAÇÃO:');
  console.log('─────────────────────────────────────────────────────────────');
  
  // Buscar período ativo
  const { data: periodoAtivo } = await supabase
    .from('periods')
    .select('id, label, year, month')
    .eq('is_active', true)
    .single();

  if (periodoAtivo) {
    console.log(`   Período Ativo: ${periodoAtivo.label || `${periodoAtivo.month}/${periodoAtivo.year}`}`);
    
    // Estoque inicial base
    const { data: estoqueBaseImports } = await supabase
      .from('stock_initial_imports')
      .select('id')
      .eq('period_id', periodoAtivo.id)
      .eq('is_base', true);
    
    const estoqueBaseImportIds = estoqueBaseImports?.map(imp => imp.id) || [];
    
    const { data: estoqueBase } = await supabase
      .from('stock_initial')
      .select('qtd')
      .eq('cod_item', codItem)
      .in('import_id', estoqueBaseImportIds);
    
    // XMLs base
    const { data: xmlsBase } = await supabase
      .from('xml_sales_imports')
      .select('id')
      .eq('period_id', periodoAtivo.id)
      .eq('is_base', true);
    
    const xmlBaseIds = xmlsBase?.map(x => x.id) || [];
    
    // Saídas apenas dos XMLs base
    const { data: saidasBase } = await supabase
      .from('document_items')
      .select('movement_qty, qtd')
      .or(`cod_item.eq.${codItem},cod_item.like.%${codItem}%`)
      .eq('movement_type', 'saida')
      .in('xml_import_id', xmlBaseIds);
    
    const estoqueInicialBase = estoqueInicial?.reduce((sum, item) => {
      if (item.stock_initial_imports?.is_base) {
        return sum + Number(item.qtd || 0);
      }
      return sum;
    }, 0) || 0;
    
    const entradasTotal = entradas?.reduce((sum, item) => {
      const qtdAjustada = item.document_item_adjustments?.[0]?.adjusted_qty;
      const qtdOriginal = Math.abs(Number(item.movement_qty || item.qtd || 0));
      return sum + (qtdAjustada !== null && qtdAjustada !== undefined ? Number(qtdAjustada) : qtdOriginal);
    }, 0) || 0;
    
    const saidasBaseTotal = saidasBase?.reduce((sum, item) => {
      return sum + Math.abs(Number(item.movement_qty || item.qtd || 0));
    }, 0) || 0;
    
    const estoqueTeorico = estoqueInicialBase + entradasTotal - saidasBaseTotal;
    
    console.log(`   Estoque Inicial (Base): ${estoqueInicialBase.toFixed(2)}`);
    console.log(`   Entradas: ${entradasTotal.toFixed(2)}`);
    console.log(`   Saídas (XMLs Base): ${saidasBaseTotal.toFixed(2)}`);
    console.log(`   📊 ESTOQUE TEÓRICO: ${estoqueTeorico.toFixed(2)}`);
    console.log(`   ✅ Esperado na Consolidação: 29.00\n`);
  }

  // 6. CÁLCULO SIMULADO - API DE AJUSTES
  console.log('6️⃣ CÁLCULO SIMULADO - API DE AJUSTES:');
  console.log('─────────────────────────────────────────────────────────────');
  
  // Buscar período ativo para API de ajustes
  const { data: periodoAtivoAjustes } = await supabase
    .from('periods')
    .select('id, label, year, month')
    .eq('is_active', true)
    .single();
  
  // A API de ajustes usa a mesma lógica, mas vamos verificar se há diferenças
  const estoqueInicialAjustes = estoqueInicial?.reduce((sum, item) => {
    if (item.stock_initial_imports?.is_base) {
      return sum + Number(item.qtd || 0);
    }
    return sum;
  }, 0) || 0;
  
  // Se houve erro nas entradas, tentar buscar de outra forma
  let entradasAjustes = 0;
  if (errEntradas) {
    console.log('   ⚠️ Erro ao buscar entradas, tentando método alternativo...');
    // Buscar entradas via documents
    const { data: docsEntrada } = await supabase
      .from('documents')
      .select('id, sped_file_id')
      .eq('ind_oper', '0');
    
    const docIds = docsEntrada?.map(d => d.id) || [];
    
    if (docIds.length > 0) {
      const { data: entradasAlt } = await supabase
        .from('document_items')
        .select(`
          cod_item,
          qtd,
          movement_qty,
          vl_item,
          document_item_adjustments(adjusted_qty)
        `)
        .in('document_id', docIds)
        .or(`cod_item.eq.${codItem},cod_item.like.%${codItem}%`);
      
      entradasAjustes = entradasAlt?.reduce((sum, item) => {
        const qtdAjustada = item.document_item_adjustments?.[0]?.adjusted_qty;
        const qtdOriginal = Math.abs(Number(item.movement_qty || item.qtd || 0));
        return sum + (qtdAjustada !== null && qtdAjustada !== undefined ? Number(qtdAjustada) : qtdOriginal);
      }, 0) || 0;
    }
  } else {
    entradasAjustes = entradas?.reduce((sum, item) => {
      const qtdAjustada = item.document_item_adjustments?.[0]?.adjusted_qty;
      const qtdOriginal = Math.abs(Number(item.movement_qty || item.qtd || 0));
      return sum + (qtdAjustada !== null && qtdAjustada !== undefined ? Number(qtdAjustada) : qtdOriginal);
    }, 0) || 0;
  }
  
  // Verificar se há saídas de XMLs não-base sendo contadas
  // Buscar XMLs base do período ativo
  let xmlBaseIds = [];
  if (periodoAtivoAjustes) {
    const { data: xmlsBase } = await supabase
      .from('xml_sales_imports')
      .select('id')
      .eq('period_id', periodoAtivoAjustes.id)
      .eq('is_base', true);
    xmlBaseIds = xmlsBase?.map(x => x.id) || [];
  }
  
  const { data: saidasTodosXmls } = await supabase
    .from('document_items')
    .select(`
      movement_qty,
      qtd,
      xml_import_id,
      xml_sales_imports!inner(is_base, period_id)
    `)
    .or(`cod_item.eq.${codItem},cod_item.like.%${codItem}%`)
    .eq('movement_type', 'saida');
  
  const saidasBaseAjustes = saidasTodosXmls?.reduce((sum, item) => {
    if (item.xml_sales_imports?.is_base && xmlBaseIds.includes(item.xml_import_id)) {
      return sum + Math.abs(Number(item.movement_qty || item.qtd || 0));
    }
    return sum;
  }, 0) || 0;
  
  const saidasNaoBaseAjustes = saidasTodosXmls?.reduce((sum, item) => {
    if (!item.xml_sales_imports?.is_base || !xmlBaseIds.includes(item.xml_import_id)) {
      return sum + Math.abs(Number(item.movement_qty || item.qtd || 0));
    }
    return sum;
  }, 0) || 0;
  
  const estoqueTeoricoAjustes = estoqueInicialAjustes + entradasAjustes - saidasBaseAjustes;
  const ajustesRecebidos = ajustes?.filter(adj => 
    normalizeCodItem(adj.cod_negativo) === codItemNormalizado
  ).reduce((sum, adj) => sum + Number(adj.qtd_baixada || 0), 0) || 0;
  
  const ajustesFornecidos = ajustes?.filter(adj => 
    normalizeCodItem(adj.cod_positivo) === codItemNormalizado
  ).reduce((sum, adj) => sum + Number(adj.qtd_baixada || 0), 0) || 0;
  
  const estoqueFinalAjustes = estoqueTeoricoAjustes + ajustesRecebidos - ajustesFornecidos;
  
  console.log(`   Estoque Inicial: ${estoqueInicialAjustes.toFixed(2)}`);
  console.log(`   Entradas: ${entradasAjustes.toFixed(2)}`);
  console.log(`   Saídas (Base): ${saidasBaseAjustes.toFixed(2)}`);
  if (saidasNaoBaseAjustes > 0) {
    console.log(`   ⚠️ Saídas (NÃO-Base): ${saidasNaoBaseAjustes.toFixed(2)} (PROBLEMA!)`);
    console.log(`   ⚠️ Se a API estiver contando estas saídas, isso explicaria a diferença!`);
  }
  console.log(`   Estoque Teórico: ${estoqueTeoricoAjustes.toFixed(2)}`);
  console.log(`   Ajustes Recebidos: ${ajustesRecebidos.toFixed(2)}`);
  console.log(`   Ajustes Fornecidos: ${ajustesFornecidos.toFixed(2)}`);
  console.log(`   📊 ESTOQUE FINAL: ${estoqueFinalAjustes.toFixed(2)}`);
  console.log(`   ❌ Esperado na API Ajustes: -28.00`);
  console.log(`   ✅ Esperado na Consolidação: 29.00\n`);

  // 7. RESUMO E DIAGNÓSTICO
  console.log('7️⃣ RESUMO E DIAGNÓSTICO:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`   Consolidação mostra: 29.00 ✅`);
  console.log(`   Ajustes mostra: -28.00 ❌`);
  console.log(`   Diferença: ${(29 - (-28)).toFixed(2)} unidades`);
  console.log(`\n   🔍 POSSÍVEIS CAUSAS:`);
  
  if (saidasNaoBaseAjustes > 0) {
    console.log(`   ⚠️ 1. XMLs NÃO-BASE estão sendo contados na API de Ajustes`);
    console.log(`      Total de saídas não-base: ${saidasNaoBaseAjustes.toFixed(2)}`);
    console.log(`      Se estas saídas estão sendo contadas, o estoque ficaria:`);
    const estoqueComTodasSaidas = estoqueInicialAjustes + entradasAjustes - (saidasBaseAjustes + saidasNaoBaseAjustes);
    console.log(`      ${estoqueInicialAjustes} + ${entradasAjustes} - ${(saidasBaseAjustes + saidasNaoBaseAjustes).toFixed(2)} = ${estoqueComTodasSaidas.toFixed(2)}`);
    console.log(`      Com ajustes: ${estoqueComTodasSaidas + ajustesRecebidos - ajustesFornecidos}`);
  }
  
  const diferencaSaidas = Math.abs(saidasBaseAjustes - (entradasAjustes + estoqueInicialAjustes - 29));
  if (diferencaSaidas > 0.01) {
    console.log(`   ⚠️ 2. Diferença no cálculo de saídas: ${diferencaSaidas.toFixed(2)}`);
  }
  
  // Verificar se o problema é exatamente 57 unidades (29 - (-28) = 57)
  const diferencaEsperada = 29 - (-28); // 57
  if (Math.abs(saidasNaoBaseAjustes - diferencaEsperada) < 1) {
    console.log(`   ✅ CAUSA IDENTIFICADA: As saídas não-base (${saidasNaoBaseAjustes.toFixed(2)})`);
    console.log(`      explicam a diferença de ${diferencaEsperada} unidades!`);
  }
  
  console.log(`\n   💡 RECOMENDAÇÃO:`);
  console.log(`   A API de ajustes deve usar APENAS XMLs base do período,`);
  console.log(`   da mesma forma que a consolidação faz.\n`);
}

// Executar diagnóstico
diagnosticoCompleto()
  .then(() => {
    console.log('✅ Diagnóstico concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro no diagnóstico:', error);
    process.exit(1);
  });

