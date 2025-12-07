# 📝 Logs Adicionados na API de Ajustes

## 🎯 Objetivo
Identificar exatamente quais XMLs estão sendo usados e quantas saídas estão sendo contadas para o item 011141.

## 📊 Logs Implementados

### 1. Detecção de Período
- ✅ Log quando período é recebido via query param
- ✅ Log quando período ativo é encontrado no banco (com label)
- ✅ Log quando nenhum período ativo é encontrado

### 2. Busca de XMLs Base
- ✅ Log dos XMLs base retornados pela função `getBaseXmlImportsForPeriod`
- ✅ Log dos XMLs base encontrados no banco (com detalhes: id, label, is_base, period_id)
- ✅ **Validação crítica**: Log de erro se XMLs não-base forem encontrados na lista de base
- ✅ Log quando não há período ativo (busca todos os XMLs do SPED)

### 3. Busca de Saídas
- ✅ Log dos XMLs que serão usados na busca de saídas
- ✅ Log do processamento por lotes
- ✅ **Log específico para item 011141** em cada lote:
  - Quantidade de itens encontrados
  - Total de quantidade
  - IDs dos XMLs usados
- ✅ Log do total de saídas encontradas
- ✅ **Resumo final para item 011141**:
  - Total de registros
  - Total de quantidade
  - Detalhes dos XMLs utilizados (id, label, is_base, period_id)
  - Quantidade de XMLs base vs não-base

### 4. Processamento de Dados
- ✅ Log do estoque inicial processado (total e específico para 011141)
- ✅ Log das entradas processadas (total e específico para 011141)
- ✅ Log das saídas processadas (total e específico para 011141)

### 5. Cálculo Final
- ✅ **Log detalhado para item 011141** com:
  - Estoque inicial
  - Entradas
  - Saídas
  - Estoque teórico
  - Ajustes recebidos
  - Ajustes fornecidos
  - Estoque final calculado
  - Fórmula usada
  - Período usado
  - Quantidade de XMLs base usados
- ✅ Log do resultado final (se está em negativos ou positivos)

## 🔍 Como Usar

1. **Acesse a aba de Ajustes** no sistema
2. **Abra o console do servidor** (logs do Next.js/Vercel)
3. **Procure pelos logs** com prefixo `[inventory-data]`
4. **Foque nos logs** com emoji 🎯 que são específicos para o item 011141

## 📋 Logs Esperados

Quando acessar a aba de Ajustes, você verá logs como:

```
[inventory-data] 🔍 Período recebido via query param: 6d4abba3-fc54-4946-a248-5e5370693a92
[inventory-data] 🔍 Buscando XMLs base para período: 6d4abba3-fc54-4946-a248-5e5370693a92
[inventory-data] 📊 XMLs base retornados pela função: { total: 22, ids: [...] }
[inventory-data] ✅ XMLs base encontrados no banco: { total: 22, detalhes: [...] }
[inventory-data] 🔍 Buscando saídas de XMLs: { total_xmls: 22, xml_ids: [...] }
[inventory-data] 🎯 Item 011141 - RESUMO FINAL DE SAÍDAS: { total_qtd: 12.00, xmls_base: 22, xmls_nao_base: 0 }
[inventory-data] 🎯 DEBUG ITEM 011141 - Cálculo final do estoque: { estoque_final_calculado: -28.00, ... }
```

## ⚠️ O que Procurar

1. **Se `xmls_nao_base > 0`**: Isso indica que XMLs não-base estão sendo contados
2. **Se `total_qtd` de saídas for > 12**: Indica que mais saídas estão sendo contadas do que deveria
3. **Se `period_id` for "null"** nos XMLs: Indica que XMLs sem período estão sendo usados

## 🎯 Próximo Passo

Após acessar a aba de Ajustes, verifique os logs do servidor e identifique:
- Quantos XMLs base estão sendo usados
- Se há XMLs não-base na lista
- Quantas saídas estão sendo contadas para o item 011141

