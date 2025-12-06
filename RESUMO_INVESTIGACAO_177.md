# Resumo da Investigação - Item 177 com Saldo Irreal

## 📊 Resultados Encontrados Até Agora

### Ajustes Encontrados (Query 9):
1. **Ajuste 1:** `007201` → `000177`, qtd: 10, SPED: `5bbf87f3...`, período: null
2. **Ajuste 2:** `001252` → `000177`, qtd: 4, SPED: `c22b4029...`, período: null

**Total fornecido:** 14 (177 forneceu para outros códigos)

### Cálculo Esperado:
- Estoque teórico: -1.030,95
- Ajustes recebidos: 0
- Ajustes fornecidos: 14
- **Estoque final esperado: -1.030,95 - 14 = -1.044,95** ✅

### Problema:
- **Na interface aparece: 68.526** ❌
- **Diferença:** 68.526 - (-1.044,95) = **69.570,95**

## 🔍 Próximas Queries para Executar

Execute estas queries na ordem para identificar a causa:

### 1. Query G: Verificar se 177 RECEBE ajustes (é negativo)
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

**O que procurar:** Se houver ajustes onde 177 é negativo, some as quantidades. Se a soma for próxima de 69.570,95, esse é o problema!

### 2. Query A: Verificar qual é o SPED base
```sql
WITH periodo_ativo AS (
  SELECT id, year, month, label
  FROM periods 
  WHERE is_active = true 
  LIMIT 1
)
SELECT 
  pa.id as period_id,
  pa.label,
  sf.id as sped_file_id,
  sf.name as sped_name,
  sf.is_base
FROM periodo_ativo pa
LEFT JOIN sped_files sf ON sf.period_id = pa.id AND sf.is_base = true;
```

**O que procurar:** Qual é o `sped_file_id` do SPED base? Os ajustes encontrados são deste SPED?

### 3. Query E: Calcular com filtros da API
Execute a Query E do arquivo `investigacao_item_177_continuacao.sql` - ela usa os mesmos filtros da API.

**O que procurar:** O resultado deve ser igual ao que aparece na interface (68.526).

## 💡 Hipóteses Principais

### Hipótese 1: 177 está recebendo ajustes como negativo
- Se a Query G mostrar ajustes onde 177 é negativo
- E a soma desses ajustes for ~69.570,95
- **Causa:** Ajustes sendo somados incorretamente

### Hipótese 2: Ajustes de outros SPEDs sendo incluídos
- Se os ajustes encontrados são de SPEDs diferentes do base
- E a API não está filtrando corretamente
- **Causa:** Filtro `sped_file_id` não está funcionando

### Hipótese 3: Códigos similares sendo agrupados
- Se a Query H mostrar códigos como "1177", "1771" sendo agrupados
- **Causa:** Normalização incorreta

## 🎯 Ação Imediata

**Execute a Query G primeiro** - ela vai mostrar se há ajustes onde 177 RECEBE quantidade. Se houver e a soma for próxima de 69.570,95, encontramos a causa!

