# Relatório do Sistema de Controle de Estoque

## 📋 Visão Geral

Este sistema gerencia o controle de estoque de uma empresa, calculando automaticamente as movimentações de entrada e saída de produtos, aplicando ajustes manuais quando necessário, e gerando relatórios consolidados e de inventário final.

---

## 🔄 Fluxo de Dados e Etapas do Sistema

### 1. **Importação de Dados**

#### 1.1. Estoque Inicial
- **Fonte**: Arquivo CSV com produtos e quantidades iniciais
- **Onde**: Página de Upload → "Estoque Inicial"
- **O que acontece**: 
  - O sistema importa os produtos com suas quantidades iniciais
  - Cria registros na tabela `stock_initial`
  - Vincula ao período ativo

#### 1.2. Arquivo SPED (Entradas)
- **Fonte**: Arquivo SPED Fiscal (formato texto)
- **Onde**: Página de Upload → "SPED Fiscal"
- **O que acontece**:
  - O sistema extrai documentos fiscais de entrada (notas fiscais de compra)
  - Cria registros nas tabelas:
    - `documents` (cabeçalho das notas)
    - `document_items` (itens das notas com quantidades e valores)
    - `products` (cadastro de produtos)
  - Vincula ao período ativo

#### 1.3. Arquivos XML (Saídas)
- **Fonte**: Arquivos XML de notas fiscais de venda
- **Onde**: Página de Upload → "XML de Vendas"
- **O que acontece**:
  - O sistema processa os XMLs em lotes (300 por vez)
  - Extrai as saídas (vendas) de cada XML
  - Cria registros na tabela `document_items` com `movement_type = "saida"`
  - Agrupa por data de importação para facilitar seleção

---

### 2. **Ajustes Manuais (Aba Entradas)**

#### 2.1. O que são ajustes?
Ajustes são correções manuais nas quantidades de entrada quando há divergências entre:
- A quantidade informada na nota fiscal
- A quantidade realmente recebida

**Exemplo**: A nota fiscal diz 10 unidades, mas você recebeu 20. Você ajusta para 20.

#### 2.2. Como funciona?
- **Onde**: Aba "Entradas" → Tabela de entradas
- **Processo**:
  1. O sistema mostra todas as entradas do SPED selecionado
  2. Você encontra o item que precisa ajustar
  3. Digita a quantidade correta no campo "Quantidade ajustada"
  4. Salva o ajuste
  5. O sistema grava na tabela `document_item_adjustments`

#### 2.3. Onde fica salvo?
- **Tabela**: `document_item_adjustments`
- **Campos importantes**:
  - `document_item_id`: ID do item da nota fiscal
  - `adjusted_qty`: Quantidade ajustada (ex: 20)

---

### 3. **Cálculo do Estoque Consolidado**

#### 3.1. O que é?
O estoque consolidado é a visão completa do estoque, considerando:
- Estoque inicial
- Entradas (com ajustes aplicados)
- Saídas

#### 3.2. Como é calculado?
**Função principal**: `buildConsolidado()` em `lib/consolidado.ts`

**Etapas do cálculo**:

1. **Buscar Estoque Inicial**
   - Fonte: Tabela `stock_initial`
   - Filtro: Período ativo ou importação selecionada
   - Resultado: Quantidade e valor inicial por código de item

2. **Buscar Entradas**
   - Fonte: Função `buildEntradasItems()` em `lib/entradas.ts`
   - **Importante**: Esta função:
     - Busca documentos do SPED selecionado
     - Busca itens desses documentos
     - **Busca ajustes** da tabela `document_item_adjustments`
     - **Inclui itens com ajustes** mesmo que pertençam a outros SPEDs do período ativo
     - Para cada item, usa: `adjusted_qty ?? quantidade_nf`
   - Agrega por código de item: soma quantidades e valores

3. **Buscar Saídas**
   - Fonte: Tabela `document_items` com `movement_type = "saida"`
   - Filtro: XMLs selecionados na aba "Saídas"
   - Agrega por código de item: soma quantidades e valores

4. **Calcular Custo Médio**
   - Para cada entrada, recalcula o custo médio ponderado
   - Fórmula: `(estoque_anterior × custo_anterior + entrada × custo_entrada) / (estoque_anterior + entrada)`

5. **Calcular Estoque Final**
   - Fórmula: `estoque_inicial + entradas - saídas`
   - Valor total: `estoque_final × custo_medio`

#### 3.3. Onde aparece?
- **Aba**: "Consolidação" ou "Entradas Consolidadas"
- **Página**: `app/movimentacoes/consolidado/page.tsx`

---

### 4. **Cálculo do Inventário Final**

#### 4.1. O que é?
O inventário final é o estoque consolidado menos os ajustes de baixa positiva (itens que foram dados como perdidos/avariados).

#### 4.2. Como é calculado?
**Função principal**: `getInventoryFinalData()` em `lib/inventoryFinal.ts`

**Etapas**:

1. **Buscar Estoque Consolidado**
   - Usa a função `buildConsolidado()` (fonte única de verdade)
   - Não recalcula nada, apenas reutiliza os dados

2. **Aplicar Ajustes de Baixa Positiva**
   - Fonte: Tabela `code_offset_adjustments` com tipo "baixa_positiva"
   - Fórmula: `estoque_final = estoque_consolidado - baixas_positivas`

3. **Calcular Valor Final**
   - Usa o custo médio do consolidado
   - Fórmula: `valor_final = estoque_final × custo_medio`

#### 4.3. Onde aparece?
- **Aba**: "Inventário Final"
- **Página**: `app/inventario-final/page.tsx`

---

## 🔑 Pontos Importantes do Sistema

### 1. **Fonte Única de Verdade**
- **Consolidação** é a fonte única de verdade para cálculos de estoque
- **Inventário Final** depende 100% da Consolidação
- Não há lógica duplicada

### 2. **Ajustes de Entrada**
- Os ajustes são aplicados automaticamente na Consolidação
- Se um item tem ajuste em outro SPED do período ativo, ele é incluído automaticamente
- Prioridade: `adjusted_qty ?? quantidade_nf`

### 3. **Filtro de Saídas**
- As saídas são filtradas pelos XMLs selecionados na aba "Saídas"
- A seleção é persistida em cookies para manter consistência
- Todas as abas usam a mesma seleção de XMLs

### 4. **Cálculo de Custo Médio**
- Recalculado a cada entrada
- Usa média ponderada
- Considera as quantidades ajustadas

---

## 📊 Estrutura de Dados

### Tabelas Principais

1. **`stock_initial`**
   - Estoque inicial por código de item
   - Vinculado ao período

2. **`documents`**
   - Cabeçalho das notas fiscais
   - Campos: `id`, `sped_file_id`, `ind_oper`, `serie`, `num_doc`, `dt_doc`

3. **`document_items`**
   - Itens das notas fiscais
   - Campos: `id`, `document_id`, `cod_item`, `qtd`, `vl_item`, `movement_type`

4. **`document_item_adjustments`**
   - Ajustes manuais de quantidade
   - Campos: `document_item_id`, `adjusted_qty`

5. **`xml_sales_imports`**
   - Registro das importações de XML
   - Agrupa múltiplos XMLs por data

6. **`code_offset_adjustments`**
   - Ajustes de baixa positiva e recebidos
   - Usado no Inventário Final

---

## 🔄 Fluxo Completo de um Item

### Exemplo: Código 842

1. **Importação Inicial**
   - Estoque inicial: 45 unidades

2. **Importação SPED**
   - Nota 001 1044953: 10 unidades (quantidade da NF)
   - Nota 001 1048036: 8 unidades

3. **Ajuste Manual**
   - Usuário ajusta a nota 001 1044953 de 10 para 20 unidades
   - Sistema grava: `document_item_id = faf49e7d...`, `adjusted_qty = 20`

4. **Cálculo Consolidado**
   - Estoque inicial: 45
   - Entradas: 20 (ajustado) + 8 = 28
   - Saídas: 5 (exemplo)
   - Estoque final: 45 + 28 - 5 = 68

5. **Inventário Final**
   - Usa o estoque consolidado (68)
   - Aplica baixas positivas se houver
   - Calcula valor final

---

## 🛠️ Arquivos Principais

### Cálculos
- `lib/consolidado.ts`: Função `buildConsolidado()` - cálculo principal
- `lib/entradas.ts`: Função `buildEntradasItems()` - busca entradas com ajustes
- `lib/inventoryFinal.ts`: Função `getInventoryFinalData()` - inventário final

### Páginas
- `app/movimentacoes/entradas/page.tsx`: Aba de entradas e ajustes
- `app/movimentacoes/consolidado/page.tsx`: Aba de consolidação
- `app/movimentacoes/saidas/page.tsx`: Aba de saídas
- `app/inventario-final/page.tsx`: Aba de inventário final

### Componentes
- `components/entries/EntriesTable.tsx`: Tabela de entradas com campo de ajuste
- `components/movements/ConsolidatedTable.tsx`: Tabela de consolidação
- `components/movements/SaidasFilter.tsx`: Filtro de saídas com persistência

---

## ✅ Garantias do Sistema

1. **Consistência**: Todas as abas usam a mesma fonte de dados
2. **Ajustes Automáticos**: Ajustes aparecem automaticamente em todas as abas
3. **Sem Duplicação**: Não há lógica duplicada de cálculo
4. **Rastreabilidade**: Todos os ajustes ficam registrados no banco
5. **Flexibilidade**: Permite ajustes mesmo para itens de outros SPEDs do período

---

## 📝 Notas Técnicas

- O sistema usa **Next.js 14** com **React Server Components**
- Banco de dados: **Supabase** (PostgreSQL)
- Linguagem: **TypeScript**
- A busca de dados é otimizada com paginação e chunks
- Os ajustes são buscados em lotes para melhor performance

---

## 🎯 Resumo para Leigos

**Em termos simples**: O sistema funciona como um estoque físico, mas digitalizado:

1. Você importa o estoque inicial (quantidade que tinha no início)
2. Você importa as compras (entradas) do SPED
3. Você pode ajustar as quantidades se houver divergências
4. Você importa as vendas (saídas) dos XMLs
5. O sistema calcula automaticamente:
   - Quanto você tem agora (consolidado)
   - Quanto vale seu estoque (inventário final)

**A mágica**: Quando você ajusta uma quantidade na aba Entradas, esse ajuste aparece automaticamente em todas as outras abas, sem precisar fazer nada!



