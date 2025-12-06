# Guia: Como Investigar o Item 177 com Queries SQL

## 📋 Passo a Passo

### 1. Acessar o Supabase SQL Editor

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **"SQL Editor"** (ou "Editor SQL")
4. Clique em **"New query"** para criar uma nova query

### 2. Executar as Queries de Investigação

Execute as queries **uma por vez**, na ordem sugerida abaixo. Copie e cole cada query no editor SQL e clique em **"Run"** (ou pressione Ctrl+Enter).

---

## 🔍 Ordem Recomendada de Execução

### **PASSO 1: Identificar IDs Corretos (Query 7C)**

Execute esta query primeiro para descobrir os IDs que você precisa usar:

```sql
-- Query 7C: Encontrar sped_file_id e period_id corretos
SELECT 
  'SPED Files' as tipo,
  id as sped_file_id,
  name as nome,
  uploaded_at,
  period_id
FROM sped_files
WHERE name LIKE '%jan2023%'
ORDER BY uploaded_at DESC;

SELECT 
  'Períodos Ativos' as tipo,
  id as period_id,
  year,
  month,
  is_active,
  label
FROM periods
WHERE is_active = true;
```

**O que fazer com o resultado:**
- Anote o `sped_file_id` do arquivo SPED base (geralmente o mais recente com "jan2023")
- Anote o `period_id` do período ativo

---

### **PASSO 2: Ver Todos os Ajustes do 177 (Query 1)**

Esta query mostra TODOS os ajustes onde o código 177 aparece:

```sql
-- Query 1: Todos os ajustes onde 177 aparece
SELECT 
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  unit_cost,
  total_value,
  created_at,
  period_id,
  sped_file_id,
  CASE 
    WHEN cod_negativo LIKE '%177%' THEN 'NEGATIVO'
    WHEN cod_positivo LIKE '%177%' THEN 'POSITIVO'
  END as papel_do_177
FROM code_offset_adjustments
WHERE 
  cod_negativo LIKE '%177%' 
  OR cod_positivo LIKE '%177%'
  OR cod_negativo LIKE '%000177%'
  OR cod_positivo LIKE '%000177%'
ORDER BY created_at DESC;
```

**O que observar:**
- Quantos ajustes existem?
- O código 177 aparece como negativo ou positivo?
- Quais são os `sped_file_id` e `period_id` de cada ajuste?
- Há ajustes de outros períodos/SPEDs?

---

### **PASSO 3: Resumo - 177 como Negativo (Query 2)**

```sql
-- Query 2: Resumo quando 177 é código NEGATIVO (recebe quantidade)
SELECT 
  cod_negativo,
  COUNT(*) as total_ajustes,
  SUM(qtd_baixada) as total_recebido,
  MIN(created_at) as primeiro_ajuste,
  MAX(created_at) as ultimo_ajuste,
  period_id,
  sped_file_id
FROM code_offset_adjustments
WHERE cod_negativo IN ('177', '000177', '0177', '00177')
GROUP BY cod_negativo, period_id, sped_file_id
ORDER BY total_recebido DESC;
```

**O que observar:**
- Quanto o 177 recebeu no total?
- Há ajustes em múltiplos períodos/SPEDs?

---

### **PASSO 4: Resumo - 177 como Positivo (Query 3)**

```sql
-- Query 3: Resumo quando 177 é código POSITIVO (fornece quantidade)
SELECT 
  cod_positivo,
  COUNT(*) as total_ajustes,
  SUM(qtd_baixada) as total_fornecido,
  MIN(created_at) as primeiro_ajuste,
  MAX(created_at) as ultimo_ajuste,
  period_id,
  sped_file_id
FROM code_offset_adjustments
WHERE cod_positivo IN ('177', '000177', '0177', '00177')
GROUP BY cod_positivo, period_id, sped_file_id
ORDER BY total_fornecido DESC;
```

**O que observar:**
- Quanto o 177 forneceu no total?
- Isso explica o saldo positivo?

---

### **PASSO 5: Calcular com Filtros Corretos (Query 7B)**

**IMPORTANTE:** Antes de executar, substitua os valores na query pelos IDs que você anotou no Passo 1.

Opção A - Se você tem os IDs:
```sql
-- Query 7B: Calcular com os MESMOS filtros da API
-- SUBSTITUA 'SEU_SPED_FILE_ID' e 'SEU_PERIOD_ID' pelos valores reais
WITH periodo_ativo AS (
  SELECT 'SEU_PERIOD_ID'::uuid as id
),
sped_base AS (
  SELECT 'SEU_SPED_FILE_ID'::uuid as id
)
SELECT 
  '000177' as cod_item,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_recebidos,
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_fornecidos,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as diferenca_ajustes,
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as estoque_final_calculado,
  COUNT(*) as total_ajustes_encontrados
FROM code_offset_adjustments adj
CROSS JOIN periodo_ativo pa
CROSS JOIN sped_base sb
WHERE 
  adj.sped_file_id = sb.id
  AND (adj.period_id = pa.id OR adj.period_id IS NULL)
  AND (
    adj.cod_negativo IN ('177', '000177', '0177', '00177')
    OR adj.cod_positivo IN ('177', '000177', '0177', '00177')
  );
```

Opção B - Versão automática (busca período ativo automaticamente):
```sql
-- Query 7B Automática: Usa período ativo e SPED base automaticamente
WITH periodo_ativo AS (
  SELECT id 
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
),
sped_base AS (
  SELECT id 
  FROM sped_files 
  WHERE name LIKE '%jan2023%' 
  ORDER BY uploaded_at DESC 
  LIMIT 1
)
SELECT 
  '000177' as cod_item,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_recebidos,
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as ajustes_fornecidos,
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as diferenca_ajustes,
  -1030.95 + 
  COALESCE(SUM(CASE WHEN cod_negativo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN cod_positivo IN ('177', '000177', '0177', '00177') THEN qtd_baixada ELSE 0 END), 0) as estoque_final_calculado,
  COUNT(*) as total_ajustes_encontrados,
  (SELECT id FROM periodo_ativo) as period_id_usado,
  (SELECT id FROM sped_base) as sped_file_id_usado
FROM code_offset_adjustments adj
CROSS JOIN periodo_ativo pa
CROSS JOIN sped_base sb
WHERE 
  adj.sped_file_id = sb.id
  AND (adj.period_id = pa.id OR adj.period_id IS NULL)
  AND (
    adj.cod_negativo IN ('177', '000177', '0177', '00177')
    OR adj.cod_positivo IN ('177', '000177', '0177', '00177')
  );
```

**O que observar:**
- O `estoque_final_calculado` deve ser igual ao que aparece na interface (68.526)
- Se não for igual, há ajustes sendo incluídos que não deveriam

---

### **PASSO 6: Verificar Variações do Código (Query 4)**

```sql
-- Query 4: Verificar normalização - todas as variações do código 177
SELECT DISTINCT
  cod_negativo as codigo,
  'NEGATIVO' as tipo,
  COUNT(*) as ocorrencias,
  SUM(qtd_baixada) as total_qtd
FROM code_offset_adjustments
WHERE cod_negativo LIKE '%177%'
GROUP BY cod_negativo

UNION ALL

SELECT DISTINCT
  cod_positivo as codigo,
  'POSITIVO' as tipo,
  COUNT(*) as ocorrencias,
  SUM(qtd_baixada) as total_qtd
FROM code_offset_adjustments
WHERE cod_positivo LIKE '%177%'
GROUP BY cod_positivo

ORDER BY codigo, tipo;
```

**O que observar:**
- Há variações do código 177 que não estão sendo normalizadas corretamente?
- Ex: "1177", "1771", "00177" que deveriam ser tratados como códigos diferentes?

---

### **PASSO 7: Verificar Ajustes Duplicados (Query 6)**

```sql
-- Query 6: Verificar se há ajustes duplicados ou inconsistentes
SELECT 
  cod_negativo,
  cod_positivo,
  COUNT(*) as vezes_repetido,
  SUM(qtd_baixada) as soma_total,
  MIN(created_at) as primeiro,
  MAX(created_at) as ultimo,
  period_id
FROM code_offset_adjustments
WHERE 
  cod_negativo IN ('177', '000177', '0177', '00177')
  OR cod_positivo IN ('177', '000177', '0177', '00177')
GROUP BY cod_negativo, cod_positivo, period_id
HAVING COUNT(*) > 1
ORDER BY vezes_repetido DESC;
```

**O que observar:**
- Há ajustes duplicados?
- Mesma combinação negativo/positivo criada múltiplas vezes?

---

## 📊 Como Interpretar os Resultados

### Cenário 1: Query 7B mostra -1.044,95 mas interface mostra 68.526
**Causa provável:** A API está incluindo ajustes de outros SPEDs/períodos
**Solução:** Verificar filtros na API `inventory-data`

### Cenário 2: Query 7B mostra 68.526 (igual à interface)
**Causa provável:** Os ajustes estão corretos no banco, mas o cálculo está errado
**Solução:** Verificar lógica de cálculo do estoque final

### Cenário 3: Query 1 mostra muitos ajustes de outros períodos
**Causa provável:** Filtro `period_id IS NULL` está incluindo ajustes antigos
**Solução:** Ajustar filtro para não incluir ajustes sem período

### Cenário 4: Query 4 mostra variações do código 177
**Causa provável:** Normalização não está funcionando corretamente
**Solução:** Verificar função `normalizeCodItem`

---

## 🎯 Próximos Passos Após Investigação

1. **Compartilhe os resultados** das queries (especialmente Query 7B)
2. **Identifique a causa raiz** baseado nos cenários acima
3. **Implemente a correção** baseada nos achados

---

## 💡 Dica

Se preferir, você pode executar todas as queries de uma vez copiando o conteúdo completo do arquivo `db/investigacao_item_177.sql` no SQL Editor. Mas recomendo executar uma por vez para entender melhor cada resultado.

