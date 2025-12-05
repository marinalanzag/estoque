# Origem dos Dados - Tabela de Itens Positivos (Aba Ajustes)

## Resumo

A tabela de **Itens com Saldo Positivo** na aba de **Ajustes de Códigos** mostra todos os itens que têm **estoque final positivo**, independentemente de terem entradas ou não.

## Fonte dos Dados

**API**: `/api/adjustments/inventory-data`  
**Arquivo**: `app/api/adjustments/inventory-data/route.ts`

## Como os Dados São Calculados

### 1. Estoque Inicial
- **Fonte**: Tabela `stock_initial` do banco de dados
- **Filtro**: Todos os itens do estoque inicial importado
- **Campo usado**: `qtd` (quantidade)

### 2. Entradas
- **Fonte**: Tabela `document_items` com `movement_type = 'entrada'`
- **Filtro**: Apenas entradas do SPED selecionado (`sped_file_id`)
- **Campo usado**: 
  - Se houver ajuste manual: `document_item_adjustments.adjusted_qty`
  - Senão: `movement_qty` ou `qtd` (valor absoluto)
- **Importante**: Usa as quantidades ajustadas manualmente na aba Entradas, se existirem

### 3. Saídas
- **Fonte**: Tabela `document_items` com `movement_type = 'saida'`
- **Filtro**: Apenas saídas vinculadas aos XMLs importados do SPED selecionado
- **Campo usado**: `movement_qty` ou `qtd` (valor absoluto)

### 4. Estoque Teórico
**Cálculo**: `estoque_teorico = estoque_inicial + entradas - saidas`

### 5. Ajustes de Códigos
- **Fonte**: Tabela `code_offset_adjustments`
- **Filtro**: Ajustes do SPED selecionado e do período ativo (se houver)
- **Campos usados**:
  - `ajustes_recebidos`: Quantidade que o item recebeu de outros códigos positivos
  - `ajustes_fornecidos`: Quantidade que o item forneceu para códigos negativos

### 6. Estoque Final (Quantidade Final)
**Cálculo**: `estoque_final = estoque_teorico + ajustes_recebidos - ajustes_fornecidos`

## Filtragem para Itens Positivos

Após calcular o estoque final para todos os itens, a API filtra:

```typescript
const positivos = Array.from(inventory.values())
  .filter((item) => item.estoque_final > 0)  // ← Apenas estoque final > 0
  .sort((a, b) => b.estoque_final - a.estoque_final);
```

**Critério**: `estoque_final > 0`

## Exemplos Práticos

### Exemplo 1: Item apenas com Estoque Inicial
- Estoque inicial: 100
- Entradas: 0
- Saídas: 0
- Ajustes recebidos: 0
- Ajustes fornecidos: 0
- **Estoque final**: 100 ✅ **APARECE na tabela**

### Exemplo 2: Item com Entradas e Saídas
- Estoque inicial: 50
- Entradas: 200
- Saídas: 150
- Ajustes recebidos: 0
- Ajustes fornecidos: 0
- **Estoque final**: 100 ✅ **APARECE na tabela**

### Exemplo 3: Item que Forneceu para Negativos
- Estoque inicial: 100
- Entradas: 0
- Saídas: 0
- Ajustes recebidos: 0
- Ajustes fornecidos: 30
- **Estoque final**: 70 ✅ **APARECE na tabela**

### Exemplo 4: Item que Recebeu de Outros Positivos
- Estoque inicial: 50
- Entradas: 0
- Saídas: 0
- Ajustes recebidos: 20
- Ajustes fornecidos: 0
- **Estoque final**: 70 ✅ **APARECE na tabela**

### Exemplo 5: Item com Estoque Final Zero ou Negativo
- Estoque inicial: 50
- Entradas: 0
- Saídas: 50
- Ajustes recebidos: 0
- Ajustes fornecidos: 0
- **Estoque final**: 0 ❌ **NÃO APARECE na tabela**

## Diferença em Relação ao Consolidado

| Aspecto | Tabela de Ajustes (Positivos) | Tabela Consolidado |
|---------|-------------------------------|-------------------|
| **Fonte** | API `/api/adjustments/inventory-data` | Função `buildConsolidado()` |
| **Ajustes aplicados** | ✅ Sim (ajustes_recebidos - ajustes_fornecidos) | ❌ Não (mostra apenas teórico) |
| **Filtro** | `estoque_final > 0` | Todos os itens |
| **Uso de ajustes manuais** | ✅ Sim (usa `adjusted_qty` das entradas) | ✅ Sim |

## Campos Exibidos na Tabela

1. **Código do Item** (`cod_item`): Normalizado para 6 dígitos
2. **Descrição** (`descr_item`): 
   - Prioridade 1: Tabela `products` do SPED
   - Prioridade 2: Tabela `product_catalog` (cadastro global)
   - Fallback: "[Sem descrição]"
3. **Estoque Final** (`estoque_final`): Quantidade calculada conforme fórmula acima
4. **Unidade** (`unidade`): 
   - Prioridade 1: Tabela `products.unid_inv` do SPED
   - Prioridade 2: Tabela `stock_initial.unid`
   - Fallback: null
5. **Custo Unitário** (`unit_cost`): Custo médio ponderado calculado a partir de estoque inicial + entradas

## Observações Importantes

1. **Não depende apenas de entradas**: Um item pode aparecer na tabela mesmo sem ter entradas, se tiver estoque inicial positivo.

2. **Considera ajustes manuais**: Se você ajustou uma quantidade na aba Entradas, esse ajuste é usado no cálculo.

3. **Considera ajustes de códigos**: Se o item forneceu quantidade para códigos negativos, isso reduz seu estoque final. Se recebeu de outros positivos, aumenta.

4. **Filtro por período**: Se houver período ativo, apenas ajustes desse período são considerados (ou ajustes sem período para compatibilidade).

5. **Filtro por SPED**: Todos os dados vêm do SPED selecionado (`sped_file_id`).

## Resumo em Uma Frase

**A quantidade final vem de: Estoque Inicial + Entradas (ajustadas) - Saídas + Ajustes Recebidos - Ajustes Fornecidos, e só aparecem itens com resultado maior que zero.**

