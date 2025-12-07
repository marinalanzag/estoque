# 🔍 DIAGNÓSTICO COMPLETO - Item 011141

## 📋 Situação Reportada

- **Consolidação**: 35 inicial + 6 entradas - 12 saídas = **29** ✅
- **Ajustes**: Mostra **-28** ❌ (diferença de 57 unidades!)
- **Inventário Final**: 29 teórico + 9 ajustes = **10** final

## 🔎 Análise do Código

### 1. Como a Consolidação Calcula

**Arquivo**: `lib/consolidado.ts` → `buildConsolidado()`

1. **Estoque Inicial**: Busca apenas do `import_id` base do período
2. **Entradas**: Usa `buildEntradasItems()` que:
   - Busca documentos com `ind_oper = '0'` do SPED base
   - Aplica `document_item_adjustments` (ajustes de quantidade)
   - Considera conversões de unidade (`qtd_produto`)
3. **Saídas**: Usa `fetchExitAggregates()` que:
   - Recebe `xmlImportIds` como parâmetro
   - Quando há período ativo, recebe apenas XMLs base do período
   - Busca saídas com `.in("xml_import_id", batchIds)`

**Cálculo Final**:
```typescript
qtd_final = qtd_inicial + qtd_entradas - qtd_saidas
```

### 2. Como a API de Ajustes Calcula

**Arquivo**: `app/api/adjustments/inventory-data/route.ts`

1. **Estoque Inicial**: Busca apenas do `import_id` base do período ✅
2. **Entradas**: Busca diretamente de `document_items`:
   ```typescript
   .eq("documents.sped_file_id", spedFileId)
   .eq("movement_type", "entrada")
   ```
   - Aplica `document_item_adjustments` ✅
   - **MAS**: Não usa `buildEntradasItems()`, então pode não considerar conversões de unidade
3. **Saídas**: Busca de `document_items` com `xml_import_id`:
   ```typescript
   .in("xml_import_id", batchIds)
   .eq("movement_type", "saida")
   ```
   - Usa apenas XMLs base do período quando há período ativo ✅

**Cálculo Final**:
```typescript
estoque_teorico = estoque_inicial + entradas - saidas
estoque_final = estoque_teorico + ajustes_recebidos - ajustes_fornecidos
```

## 🚨 POSSÍVEIS CAUSAS

### Causa 1: Diferença no Processamento de Entradas

**Problema Potencial**: 
- Consolidação usa `buildEntradasItems()` que processa conversões de unidade
- API de Ajustes busca diretamente de `document_items` sem passar por `buildEntradasItems()`

**Impacto**: Se houver conversões de unidade nas entradas, os valores podem divergir.

### Causa 2: Saídas Duplicadas ou XMLs Não-Base

**Problema Potencial**:
- Se houver XMLs não-base no mesmo período, podem estar sendo contados
- Ou há duplicação de registros de saída

**Verificação Necessária**: Executar query SQL para verificar se há saídas de XMLs não-base.

### Causa 3: Diferença no Filtro de Entradas

**Problema Potencial**:
- Consolidação filtra por `ind_oper = '0'` via `buildEntradasItems()`
- API de Ajustes filtra por `movement_type = 'entrada'`
- Pode haver documentos que são entradas mas não têm `movement_type = 'entrada'`

**Verificação**: Verificar se há documentos com `ind_oper = '0'` mas `movement_type IS NULL`.

### Causa 4: Ajustes Já Aplicados Incorretamente

**Problema Potencial**:
- A API de Ajustes pode estar aplicando ajustes que já foram considerados no estoque teórico
- Ou pode estar buscando ajustes de períodos diferentes

## 📊 Queries de Diagnóstico

Execute as queries em `db/diagnostico_item_011141.sql` para verificar:

1. **Estoque Inicial**: Verificar se há múltiplos imports
2. **Entradas**: Comparar quantidade original vs ajustada
3. **Saídas**: Verificar se há saídas de XMLs não-base
4. **Ajustes**: Verificar ajustes já feitos
5. **Cálculos Simulados**: Comparar consolidação vs API de ajustes

## 🛠️ Script de Diagnóstico

Execute o script Node.js `diagnostico-item-011141.js` para uma análise completa:

```bash
node diagnostico-item-011141.js
```

Este script irá:
- Buscar todos os dados do item 011141
- Comparar cálculos entre Consolidação e API de Ajustes
- Identificar diferenças nos dados usados
- Sugerir a causa raiz

## 🎯 Próximos Passos

1. **Executar o script de diagnóstico** para identificar a causa exata
2. **Verificar logs do servidor** quando acessar a aba de Ajustes
3. **Comparar os dados brutos** entre as duas abas
4. **Corrigir a API de Ajustes** para usar a mesma lógica da Consolidação

## 💡 Solução Proposta

A solução mais segura seria fazer a API de Ajustes usar `buildConsolidado()` diretamente, garantindo que ambos usem exatamente a mesma lógica de cálculo.

