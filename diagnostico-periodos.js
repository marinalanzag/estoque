// Script de diagnóstico para verificar estado dos períodos no Supabase
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function diagnosticarPeriodos() {
  logSection('🔍 DIAGNÓSTICO DE PERÍODOS');
  
  // Verificar variáveis de ambiente
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    logError('NEXT_PUBLIC_SUPABASE_URL não está configurada');
    return;
  }

  if (!supabaseKey) {
    logError('SUPABASE_SERVICE_ROLE_KEY não está configurada');
    return;
  }

  logSuccess('Variáveis de ambiente encontradas');
  logInfo(`URL: ${supabaseUrl.substring(0, 30)}...`);

  // Conectar ao Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // ============================================================
    // 1. VERIFICAR PERÍODOS EXISTENTES
    // ============================================================
    logSection('1. PERÍODOS NO BANCO DE DADOS');
    
    const { data: periods, error: periodsError, count } = await supabase
      .from('periods')
      .select('*', { count: 'exact' })
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (periodsError) {
      logError(`Erro ao buscar períodos: ${periodsError.message}`);
      return;
    }

    logInfo(`Total de períodos encontrados: ${count || periods?.length || 0}`);

    if (!periods || periods.length === 0) {
      logWarning('Nenhum período encontrado no banco de dados!');
      return;
    }

    // ============================================================
    // 2. VERIFICAR PERÍODOS ATIVOS
    // ============================================================
    logSection('2. PERÍODOS ATIVOS');
    
    const activePeriods = periods.filter(p => p.is_active === true);
    logInfo(`Períodos ativos encontrados: ${activePeriods.length}`);

    if (activePeriods.length === 0) {
      logWarning('Nenhum período está ativo!');
    } else if (activePeriods.length === 1) {
      const active = activePeriods[0];
      logSuccess(`Período ativo: ${active.year}/${String(active.month).padStart(2, '0')} - ${active.name || 'Sem nome'}`);
      logInfo(`  ID: ${active.id}`);
      logInfo(`  Label: ${active.label || 'N/A'}`);
      logInfo(`  Criado em: ${new Date(active.created_at).toLocaleString('pt-BR')}`);
    } else {
      logError(`PROBLEMA: Há ${activePeriods.length} períodos ativos! Deve haver apenas 1.`);
      activePeriods.forEach((p, idx) => {
        logWarning(`  ${idx + 1}. ${p.year}/${String(p.month).padStart(2, '0')} - ${p.name || 'Sem nome'} (ID: ${p.id.substring(0, 8)}...)`);
      });
    }

    // ============================================================
    // 3. VERIFICAR DADOS INVÁLIDOS
    // ============================================================
    logSection('3. VALIDAÇÃO DE DADOS');

    const problemas = [];

    periods.forEach(period => {
      if (!period.id) {
        problemas.push(`Período sem ID: ${JSON.stringify(period)}`);
      }
      if (!period.year || period.year < 2000 || period.year > 2100) {
        problemas.push(`Período com ano inválido: ${period.year}/${period.month || 'N/A'} (ID: ${period.id?.substring(0, 8) || 'N/A'}...)`);
      }
      if (!period.month || period.month < 1 || period.month > 12) {
        problemas.push(`Período com mês inválido: ${period.year || 'N/A'}/${period.month} (ID: ${period.id?.substring(0, 8) || 'N/A'}...)`);
      }
      if (typeof period.is_active !== 'boolean') {
        problemas.push(`Período com is_active inválido: ${period.year}/${period.month} (valor: ${period.is_active})`);
      }
    });

    if (problemas.length === 0) {
      logSuccess('Todos os períodos têm dados válidos');
    } else {
      logError(`Encontrados ${problemas.length} problemas:`);
      problemas.forEach(problema => {
        logError(`  - ${problema}`);
      });
    }

    // ============================================================
    // 4. VERIFICAR PERÍODOS DUPLICADOS
    // ============================================================
    logSection('4. PERÍODOS DUPLICADOS');

    const periodKeys = new Map();
    const duplicados = [];

    periods.forEach(period => {
      const key = `${period.year}-${period.month}`;
      if (periodKeys.has(key)) {
        const existente = periodKeys.get(key);
        if (!duplicados.find(d => d.key === key)) {
          duplicados.push({
            key,
            periods: [existente, period]
          });
        } else {
          duplicados.find(d => d.key === key).periods.push(period);
        }
      } else {
        periodKeys.set(key, period);
      }
    });

    if (duplicados.length === 0) {
      logSuccess('Nenhum período duplicado encontrado');
    } else {
      logWarning(`Encontrados ${duplicados.length} períodos duplicados:`);
      duplicados.forEach(dup => {
        logWarning(`  ${dup.key}:`);
        dup.periods.forEach((p, idx) => {
          logInfo(`    ${idx + 1}. ID: ${p.id.substring(0, 8)}... | Ativo: ${p.is_active} | Criado: ${new Date(p.created_at).toLocaleString('pt-BR')}`);
        });
      });
    }

    // ============================================================
    // 5. LISTAR TODOS OS PERÍODOS
    // ============================================================
    logSection('5. LISTA COMPLETA DE PERÍODOS');

    periods.forEach((period, idx) => {
      const ativo = period.is_active ? '✅ ATIVO' : '⚪ Inativo';
      const status = period.is_active ? 'green' : 'reset';
      log(`${idx + 1}. ${period.year}/${String(period.month).padStart(2, '0')} - ${period.name || 'Sem nome'} [${ativo}]`, status);
      logInfo(`    ID: ${period.id.substring(0, 16)}...`);
      if (period.label) {
        logInfo(`    Label: ${period.label}`);
      }
      if (period.description) {
        logInfo(`    Descrição: ${period.description.substring(0, 50)}${period.description.length > 50 ? '...' : ''}`);
      }
      logInfo(`    Criado em: ${new Date(period.created_at).toLocaleString('pt-BR')}`);
      if (period.updated_at && period.updated_at !== period.created_at) {
        logInfo(`    Atualizado em: ${new Date(period.updated_at).toLocaleString('pt-BR')}`);
      }
      console.log('');
    });

    // ============================================================
    // 6. VERIFICAR VINCULAÇÕES
    // ============================================================
    logSection('6. VINCULAÇÕES DE ARQUIVOS');

    // Verificar SPEDs vinculados
    const { data: spedFiles, error: spedError } = await supabase
      .from('sped_files')
      .select('id, name, period_id, is_base, uploaded_at');

    if (!spedError && spedFiles) {
      const spedVinculados = spedFiles.filter(f => f.period_id);
      const spedNaoVinculados = spedFiles.filter(f => !f.period_id);
      logInfo(`SPEDs vinculados: ${spedVinculados.length} de ${spedFiles.length}`);
      if (spedNaoVinculados.length > 0) {
        logWarning(`  ${spedNaoVinculados.length} SPEDs não vinculados a nenhum período`);
      }

      // Verificar SPEDs base por período
      if (activePeriods.length === 1) {
        const activePeriodId = activePeriods[0].id;
        const spedBaseDoPeriodo = spedFiles.filter(f => 
          f.period_id === activePeriodId && f.is_base === true
        );
        logInfo(`SPEDs base do período ativo: ${spedBaseDoPeriodo.length}`);
        if (spedBaseDoPeriodo.length === 0) {
          logWarning('  Nenhum SPED marcado como base para o período ativo!');
        }
      }
    }

    // Verificar estoques iniciais vinculados
    let hasIsBaseColumn = false;
    let stockImports = null;
    
    // Tentar buscar com is_base primeiro
    const { data: stockWithBase, error: stockErrWithBase } = await supabase
      .from('stock_initial_imports')
      .select('id, label, period_id, is_base, created_at');
    
    if (stockErrWithBase && (stockErrWithBase.code === '42703' || stockErrWithBase.message?.includes('does not exist'))) {
      // Coluna is_base não existe, buscar sem ela
      logWarning('⚠️  Coluna is_base não existe em stock_initial_imports');
      logInfo('  Execute a migração: db/migration_periods_enhancements.sql');
      
      const { data: stockWithoutBase, error: stockErrWithoutBase } = await supabase
        .from('stock_initial_imports')
        .select('id, label, period_id, created_at');
      
      if (!stockErrWithoutBase) {
        stockImports = stockWithoutBase;
        hasIsBaseColumn = false;
      }
    } else if (!stockErrWithBase) {
      stockImports = stockWithBase;
      hasIsBaseColumn = true;
    }

    if (stockImports) {
      const stockVinculados = stockImports.filter(s => s.period_id);
      const stockNaoVinculados = stockImports.filter(s => !s.period_id);
      logInfo(`Estoques iniciais vinculados: ${stockVinculados.length} de ${stockImports.length}`);
      if (stockNaoVinculados.length > 0) {
        logWarning(`  ${stockNaoVinculados.length} estoques iniciais não vinculados a nenhum período`);
      }

      // Verificar estoque base por período (apenas se a coluna existir)
      if (activePeriods.length === 1) {
        const activePeriodId = activePeriods[0].id;
        if (hasIsBaseColumn) {
          const stockBaseDoPeriodo = stockImports.filter(s => 
            s.period_id === activePeriodId && s.is_base === true
          );
          logInfo(`Estoques base do período ativo: ${stockBaseDoPeriodo.length}`);
          if (stockBaseDoPeriodo.length === 0) {
            logWarning('  Nenhum estoque inicial marcado como base para o período ativo!');
          }
        } else {
          logWarning('  ⚠️  Não foi possível verificar estoques base - coluna is_base não existe');
        }
      }
    }

    // Verificar XMLs vinculados
    const { data: xmlImports, error: xmlError } = await supabase
      .from('xml_sales_imports')
      .select('id, label, period_id, created_at');

    if (!xmlError && xmlImports) {
      const xmlVinculados = xmlImports.filter(x => x.period_id);
      const xmlNaoVinculados = xmlImports.filter(x => !x.period_id);
      logInfo(`XMLs vinculados: ${xmlVinculados.length} de ${xmlImports.length}`);
      if (xmlNaoVinculados.length > 0) {
        logWarning(`  ${xmlNaoVinculados.length} importações de XML não vinculadas a nenhum período`);
      }
    }

    // ============================================================
    // 7. RESUMO E RECOMENDAÇÕES
    // ============================================================
    logSection('7. RESUMO E RECOMENDAÇÕES');

    const problemasEncontrados = [];

    if (activePeriods.length === 0) {
      problemasEncontrados.push('Nenhum período está ativo. Ative um período para começar a trabalhar.');
    } else if (activePeriods.length > 1) {
      problemasEncontrados.push(`Há ${activePeriods.length} períodos ativos. Deve haver apenas 1. Desative os outros períodos.`);
    }

    if (problemas.length > 0) {
      problemasEncontrados.push(`${problemas.length} períodos com dados inválidos encontrados.`);
    }

    if (duplicados.length > 0) {
      problemasEncontrados.push(`${duplicados.length} períodos duplicados encontrados. Considere remover os duplicados.`);
    }

    if (problemasEncontrados.length === 0) {
      logSuccess('Nenhum problema crítico encontrado!');
      logInfo('O sistema de períodos está funcionando corretamente.');
    } else {
      logWarning('Problemas encontrados:');
      problemasEncontrados.forEach((problema, idx) => {
        console.log(`  ${idx + 1}. ${problema}`);
      });
    }

    // ============================================================
    // 8. SUGESTÕES DE CORREÇÃO
    // ============================================================
    if (activePeriods.length > 1 || problemas.length > 0 || duplicados.length > 0) {
      logSection('8. SUGESTÕES DE CORREÇÃO');
      
      if (activePeriods.length > 1) {
        logInfo('Para corrigir múltiplos períodos ativos:');
        console.log('  - Acesse a página de períodos');
        console.log('  - Ou execute no Supabase SQL Editor:');
        console.log('');
        console.log('    UPDATE periods SET is_active = false;');
        console.log(`    UPDATE periods SET is_active = true WHERE id = '${activePeriods[0].id}';`);
        console.log('');
      }

      if (duplicados.length > 0) {
        logInfo('Para corrigir períodos duplicados:');
        console.log('  - Analise cada duplicado e mantenha apenas um');
        console.log('  - Delete os outros ou marque-os como inativos');
        console.log('');
      }
    }

    logSection('✅ DIAGNÓSTICO CONCLUÍDO');

  } catch (error) {
    logError(`Erro durante diagnóstico: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

// Executar diagnóstico
diagnosticarPeriodos();

