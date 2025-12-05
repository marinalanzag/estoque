# Origem dos Dados de Estoque Final

## Resumo

Os dados de **estoque final** vêm de fontes diferentes dependendo de onde são exibidos:

### 1. Tabela Consolidado (`/movimentacoes/consolidado`)
- **Fonte**: Função `buildConsolidado()` em `lib/consolidado.ts`
- **Cálculo**: `estoque_final = estoque_inicial + entradas - saidas`
- **Ajustes**: Não são aplicados diretamente no estoque final do consolidado
- **Observação**: Esta é a fonte principal e mais confiável

### 2. Tabela de Ajustes - Itens Positivos/Negativos (`/ajustes`)
- **Fonte**: API `/api/adjustments/inventory-data`
- **Cálculo**: `estoque_final = estoque_teorico + ajustes_recebidos - ajustes_fornecidos`
  - Onde `estoque_teorico = estoque_inicial + entradas - saidas`
- **Ajustes**: São aplicados diretamente no estoque final
- **Observação**: Esta tabela considera os ajustes de códigos (code_offset_adjustments)

### 3. Inventário Final (`/inventario-final`)
- **Fonte**: Função `getInventoryFinalData()` em `lib/inventoryFinal.ts`
- **Base**: Usa `buildConsolidado()` como base
- **Ajustes**: Não aplica ajustes de códigos diretamente

## Diferenças Identificadas

### Por que podem haver diferenças?

1. **Ajustes de Códigos**: A tabela de ajustes aplica os ajustes de códigos (transferências de positivo para negativo), enquanto o consolidado não mostra isso diretamente.

2. **Filtros de Período**: Dependendo do período ativo, os dados podem variar.

3. **Filtros de SPED**: Cada tabela pode estar usando um SPED diferente se não houver período ativo configurado.

## Recomendação

Para garantir consistência:
1. Sempre use um **período ativo** configurado
2. Configure o **SPED base** do período
3. Verifique se os ajustes estão sendo salvos com o `period_id` correto

## Verificação de Inconsistências

Se encontrar diferenças entre as tabelas:

1. Verifique se há período ativo configurado
2. Verifique se o SPED base está correto
3. Verifique se os ajustes foram salvos com o `period_id` correto
4. Compare os dados usando o mesmo período e SPED base

