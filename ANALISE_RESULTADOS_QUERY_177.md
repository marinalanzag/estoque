# Análise dos Resultados da Query 9 - Item 177

## 📊 Resultados Encontrados

### Ajustes onde 177 aparece como POSITIVO (fornece quantidade):
1. **Ajuste 1:**
   - ID: `e7af767d-f53f-4f3b-8749-7dd0c0906032`
   - De: `007201` (negativo) → Para: `000177` (positivo)
   - Quantidade: `10`
   - Período: `null` (ajuste antigo sem período)
   - SPED: `5bbf87f3-526f-4743-8f2d-1b2f22e71c63`

2. **Ajuste 2:**
   - ID: `ef56e54c-0bc9-459e-9d62-cb8364cde127`
   - De: `001252` (negativo) → Para: `000177` (positivo)
   - Quantidade: `4`
   - Período: `null` (ajuste antigo sem período)
   - SPED: `c22b4029-4cc1-4c74-9bf7-5a00f30daf31`

### Total Fornecido: 10 + 4 = 14 ✅ (bate com Query 7)

## 🔍 Problema Identificado

### Situação Atual:
- **Na Consolidação:** Estoque final = -1.030,95
- **Ajustes fornecidos:** 14 (177 forneceu para outros códigos)
- **Cálculo esperado:** -1.030,95 - 14 = -1.044,95 ✅
- **Na Interface:** Aparece 68.526 ❌ (DIFERENTE!)

### Causa Provável:
1. **Ajustes de outros SPEDs sendo incluídos:**
   - Os 2 ajustes encontrados são de SPEDs diferentes
   - A API pode estar incluindo ajustes de TODOS os SPEDs, não apenas o base
   - Filtro `sped_file_id` pode não estar funcionando corretamente

2. **Ajustes sem período (null) sendo incluídos:**
   - Ambos os ajustes têm `period_id = null`
   - A API inclui ajustes com `period_id IS NULL` para compatibilidade
   - Isso pode estar trazendo ajustes de outros períodos

3. **Códigos similares sendo agrupados:**
   - Pode haver códigos como "1177", "1771", "00177" que estão sendo normalizados incorretamente
   - A normalização pode estar agrupando códigos diferentes

## 🔎 Próximas Queries para Investigar

### Query A: Verificar se há ajustes onde 177 é NEGATIVO (recebe)
```sql
SELECT 
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  period_id,
  sped_file_id,
  created_at
FROM code_offset_adjustments
WHERE cod_negativo IN ('177', '000177', '0177', '00177')
ORDER BY created_at DESC;
```

### Query B: Verificar códigos similares que podem estar sendo agrupados
```sql
SELECT DISTINCT
  cod_negativo,
  cod_positivo,
  COUNT(*) as ocorrencias,
  SUM(qtd_baixada) as total_qtd
FROM code_offset_adjustments
WHERE 
  cod_negativo LIKE '%177%' 
  OR cod_positivo LIKE '%177%'
GROUP BY cod_negativo, cod_positivo
HAVING COUNT(*) > 0
ORDER BY total_qtd DESC;
```

### Query C: Verificar se os SPEDs dos ajustes são diferentes do SPED base
```sql
-- Verificar quais SPEDs têm ajustes com o código 177
SELECT 
  sf.id as sped_file_id,
  sf.name as sped_name,
  sf.period_id as sped_period_id,
  COUNT(*) as total_ajustes_177,
  SUM(CASE WHEN adj.cod_negativo IN ('177', '000177', '0177', '00177') THEN adj.qtd_baixada ELSE 0 END) as total_recebido,
  SUM(CASE WHEN adj.cod_positivo IN ('177', '000177', '0177', '00177') THEN adj.qtd_baixada ELSE 0 END) as total_fornecido
FROM code_offset_adjustments adj
INNER JOIN sped_files sf ON adj.sped_file_id = sf.id
WHERE 
  adj.cod_negativo IN ('177', '000177', '0177', '00177')
  OR adj.cod_positivo IN ('177', '000177', '0177', '00177')
GROUP BY sf.id, sf.name, sf.period_id
ORDER BY total_ajustes_177 DESC;
```

