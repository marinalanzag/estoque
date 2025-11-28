# Análise: Origem dos Dados - Inventário Final

## Visão Geral

A aba **INVENTÁRIO FINAL** exibe o estoque consolidado após a aplicação dos ajustes de códigos. Os dados são calculados pela função `getInventoryFinalData()` em `lib/inventoryFinal.ts` e retornados pela API `/api/inventory-final/data`.

---

## Cards de Resumo

Os cards de resumo são calculados no final da função `getInventoryFinalData()`:

### 1. **Total de Itens** (`total_itens`)
- **Origem**: Contagem total de itens únicos no inventário final
- **Cálculo**: `items.length` (linha 299)
- **Observação**: Conta todos os itens que aparecem no estoque inicial, entradas, saídas ou ajustes

### 2. **Quantidade Total** (`total_quantidade`)
- **Origem**: Soma de todas as quantidades do estoque final
- **Cálculo**: `items.reduce((acc, item) => acc + item.estoque_final, 0)` (linha 300)
- **Observação**: Pode ser negativo se houver itens com saldo negativo

### 3. **Valor Total** (`total_valor`)
- **Origem**: Soma de todos os valores do estoque final
- **Cálculo**: `items.reduce((acc, item) => acc + item.valor_estoque_final, 0)` (linha 301)
- **Observação**: Calculado como `estoque_final * unit_cost` para cada item

### 4. **Itens Negativos** (`itens_negativos`)
- **Origem**: Contagem de itens com estoque final negativo
- **Cálculo**: `items.filter((item) => item.estoque_final < 0).length` (linha 302)
- **Observação**: Itens com saldo negativo são destacados em vermelho na tabela

---

## Colunas da Tabela

### 1. **Código** (`cod_item`)
- **Origem**: 
  - Tabela `stock_initial` (campo `cod_item`)
  - Tabela `document_items` (campo `cod_item`) - para entradas e saídas
  - Tabela `code_offset_adjustments` (campos `cod_negativo` e `cod_positivo`) - para ajustes
- **Processamento**: Normalizado pela função `normalizeCodItem()` (linha 125, 146, 182, 209, 210)
- **Observação**: Todos os códigos são normalizados para garantir consistência

### 2. **Descrição** (`descr_item`)
- **Origem (PRIORIDADE 1)**: Tabela `products` do SPED selecionado
  - Campo: `descr_item`
  - Filtro: `sped_file_id = spedFileId` (linhas 247-250)
- **Origem (PRIORIDADE 2)**: Tabela `product_catalog` (cadastro fixo de produtos)
  - Função: `fetchProductDescriptions()` (linhas 270-273)
  - Usado apenas para itens sem descrição no SPED
- **Fallback**: `"[Sem descrição]"` se não encontrado em nenhuma fonte
- **Processamento**: Aplicado após o cálculo do inventário (linhas 276-291)

### 3. **Unidade** (`unid`)
- **Origem (PRIORIDADE 1)**: Tabela `products` do SPED selecionado
  - Campo: `unid_inv`
  - Filtro: `sped_file_id = spedFileId` (linhas 247-250)
- **Fallback**: `"UN"` se não encontrado (definido no componente, linha 334)
- **Processamento**: Aplicado junto com a descrição (linhas 276-291)

### 4. **Estoque Inicial** (`estoque_inicial`)
- **Origem**: Tabela `stock_initial`
  - Campo: `qtd`
  - Query: `SELECT cod_item, qtd, unit_cost FROM stock_initial` (linhas 54-62)
- **Processamento**: 
  - Inicializado com o valor de `qtd` (linha 131)
  - Se o item não existe no estoque inicial, valor = 0 (linha 166)

### 5. **Entradas** (`entradas`)
- **Origem**: Tabela `document_items` com join em `documents`
  - Campos: `cod_item`, `qtd`, `vl_item`, `movement_qty`
  - Join: `document_item_adjustments(adjusted_qty)` - quantidade ajustada
  - Filtros: 
    - `documents.sped_file_id = spedFileId`
    - `movement_type = 'entrada'` (linhas 65-84)
- **Processamento**:
  - **Prioridade**: Usa `adjusted_qty` se existir ajuste (linha 148)
  - **Fallback**: Usa `Math.abs(movement_qty ?? qtd)` se não houver ajuste (linha 150)
  - Acumulado por `cod_item` (linha 156)
  - Atualiza o custo médio ponderado (linhas 159-162)

### 6. **Saídas** (`saidas`)
- **Origem**: Tabela `document_items` vinculada a `xml_sales_imports`
  - Campos: `cod_item`, `qtd`, `vl_item`, `movement_qty`
  - Filtros:
    - `xml_import_id IN (ids dos xml_sales_imports do sped_file_id)`
    - `movement_type = 'saida'` (linhas 86-112)
- **Processamento**:
  - Busca primeiro os `xml_sales_imports` vinculados ao `sped_file_id` (linhas 87-90)
  - Busca `document_items` em lotes de 50 imports (linhas 97-111)
  - Usa `Math.abs(movement_qty ?? qtd)` (linha 183)
  - Acumulado por `cod_item` (linha 187)

### 7. **Estoque Teórico** (`estoque_teorico`)
- **Origem**: **Cálculo** (não vem diretamente do banco)
- **Fórmula**: `estoque_inicial + entradas - saidas`
- **Processamento**:
  - Inicializado com `estoque_inicial` (linha 134)
  - Incrementado com cada entrada (linha 157)
  - Decrementado com cada saída (linha 188)
  - Não considera ajustes ainda (ajustes são aplicados depois)

### 8. **Ajustes** (coluna exibida como líquido)
- **Origem**: Tabela `code_offset_adjustments`
  - Campos: `cod_negativo`, `cod_positivo`, `qtd_baixada`, `unit_cost`, `total_value`
  - Filtro: `sped_file_id = spedFileId` (linhas 115-118)
- **Processamento**:
  - **Ajustes Recebidos** (`ajustes_recebidos`): 
    - Acumulado no `cod_negativo` (linha 216)
    - Representa quantidade recebida de outro código
  - **Ajustes Fornecidos** (`ajustes_fornecidos`):
    - Acumulado no `cod_positivo` (linha 236)
    - Representa quantidade fornecida para outro código
  - **Exibição**: Mostra o líquido `ajustes_recebidos - ajustes_fornecidos` (linha 319 do componente)
  - Se o item não existe no inventário, cria novo registro (linhas 218-230)

### 9. **Estoque Final** (`estoque_final`)
- **Origem**: **Cálculo** (não vem diretamente do banco)
- **Fórmula**: `estoque_teorico + ajustes_recebidos - ajustes_fornecidos` (linha 242)
- **Processamento**: Calculado após processar todos os ajustes (linhas 241-244)
- **Observação**: Pode ser negativo, indicando inconsistências no estoque

### 10. **Custo Unit.** (`unit_cost`)
- **Origem**: 
  - **Inicial**: Tabela `stock_initial` (campo `unit_cost`) (linha 127)
  - **Atualizado**: Custo médio ponderado calculado durante o processamento
- **Cálculo do Custo Médio Ponderado**:
  - Para entradas: `(valor_estoque_atual + vl_item) / (quantidade_atual + qtd_entrada)` (linhas 159-161)
  - Mantido constante durante saídas (linha 189)
  - Para ajustes: Usa `unit_cost` do ajuste se o item não existe (linha 224)
- **Processamento**: Atualizado a cada entrada processada (linhas 158-162)

### 11. **Valor Total** (`valor_estoque_final`)
- **Origem**: **Cálculo** (não vem diretamente do banco)
- **Fórmula**: `estoque_final * unit_cost` (linha 243)
- **Processamento**: Calculado após calcular o estoque final (linha 243)
- **Observação**: Representa o valor monetário total do estoque final

---

## Fluxo de Processamento

1. **Busca Estoque Inicial** (linhas 54-62)
   - Carrega todos os itens da tabela `stock_initial`
   - Inicializa o inventário com esses dados

2. **Busca Entradas** (linhas 65-84)
   - Carrega `document_items` do tipo "entrada" do SPED selecionado
   - Considera ajustes de quantidade (`adjusted_qty`)
   - Atualiza custo médio ponderado

3. **Busca Saídas** (linhas 86-112)
   - Carrega `document_items` vinculados a `xml_sales_imports` do SPED
   - Processa em lotes de 50 imports

4. **Busca Ajustes** (linhas 115-118)
   - Carrega `code_offset_adjustments` do SPED selecionado

5. **Consolidação** (linhas 123-244)
   - Processa estoque inicial
   - Processa entradas (acumula e atualiza custo)
   - Processa saídas (decrementa)
   - Processa ajustes (recebidos e fornecidos)
   - Calcula estoque final e valor final

6. **Busca Descrições** (linhas 246-291)
   - Busca descrições e unidades do SPED
   - Busca descrições faltantes no cadastro fixo
   - Aplica com prioridade: SPED > Cadastro > "[Sem descrição]"

7. **Cálculo de Totais** (linhas 298-304)
   - Calcula estatísticas para os cards de resumo

---

## Observações Importantes

1. **Normalização de Códigos**: Todos os códigos são normalizados pela função `normalizeCodItem()` para garantir consistência na consolidação.

2. **Custo Médio Ponderado**: O custo unitário é recalculado a cada entrada, considerando o valor total do estoque anterior mais o valor da entrada.

3. **Ajustes**: Os ajustes podem criar novos itens no inventário se o código não existir previamente.

4. **Itens Negativos**: Itens com estoque final negativo são destacados visualmente na tabela (fundo vermelho).

5. **Performance**: A busca de saídas é feita em lotes de 50 imports para evitar problemas de performance com muitos XMLs.

6. **Prioridade de Descrições**: 
   - 1º: SPED (`products` do arquivo)
   - 2º: Cadastro fixo (`product_catalog`)
   - 3º: "[Sem descrição]"



