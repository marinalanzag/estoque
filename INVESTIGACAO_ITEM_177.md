# Investigação: Item 177 com Saldo Irreal (68.526)

## Problema Reportado
- **Item:** 000177 (GRA-MILHO KG)
- **Na Consolidação:**
  - Estoque inicial: 0
  - Entradas: 0
  - Saídas: 1.030,95
  - Estoque final: -1.030,95
- **Na Aba Ajustes:**
  - Aparece com saldo de **68.526** (irreal e incompatível)

## Lógica Atual de Processamento

### 1. Processamento de Saídas (linha 260-284)
```javascript
// Item 000177 não existe no inventory
// Cria entrada:
{
  estoque_inicial: 0,
  entradas: 0,
  saidas: 1.030,95,
  estoque_teorico: -1.030,95,
  ajustes_recebidos: 0,
  ajustes_fornecidos: 0,
  estoque_final: -1.030,95
}
```

### 2. Processamento de Ajustes (linha 286-318)
```javascript
// Se 000177 recebe ajustes como código negativo:
negativo = inventory.get("000177") // ✅ Encontra o item criado pelas saídas
negativo.ajustes_recebidos += qtdBaixada // Soma todos os ajustes
```

### 3. Cálculo Final (linha 320-323)
```javascript
estoque_final = estoque_teorico + ajustes_recebidos - ajustes_fornecidos
estoque_final = -1.030,95 + ajustes_recebidos - ajustes_fornecidos
```

## Hipóteses para o Saldo de 68.526

### Hipótese 1: Múltiplos Ajustes Somados
Se `ajustes_recebidos = 68.526`:
- `estoque_final = -1.030,95 + 68.526 = 67.495,05` ❌ (não bate com 68.526)

### Hipótese 2: Item Também Aparece como Positivo
Se 000177 também fornece ajustes (é código positivo):
- `ajustes_fornecidos` seria subtraído
- Mas isso não explicaria o saldo positivo alto

### Hipótese 3: Normalização de Código Incorreta
- "000177" vs "177" vs "0177"
- A função `normalizeCodItem` normaliza todos para "000177" (6 dígitos)
- Então a normalização está funcionando corretamente

### Hipótese 4: Ajustes de Outros Períodos
- Filtro de período pode estar incluindo ajustes incorretos
- Ajustes antigos sem `period_id` podem estar sendo incluídos
- **Esta é a hipótese mais provável!**

## Queries SQL para Investigação

Execute o arquivo `db/investigacao_item_177.sql` no Supabase SQL Editor para investigar:
1. Todos os ajustes relacionados ao código 177
2. Resumo de ajustes onde 177 é negativo
3. Resumo de ajustes onde 177 é positivo
4. Verificação de normalização
5. Ajustes por período
6. Ajustes duplicados
7. Cálculo do estoque final esperado

## Logs Adicionados

Adicionei logs detalhados na API `inventory-data` que vão mostrar:
- Todos os ajustes relacionados ao 177 encontrados
- Como cada ajuste está sendo processado
- O cálculo final do estoque

**Para ver os logs:**
1. Abra o console do servidor (terminal onde o Next.js está rodando)
2. Acesse a aba "Ajustes de Códigos"
3. Os logs aparecerão com o prefixo `[inventory-data] 🔍 DEBUG ITEM 177`

## Próximos Passos

1. ✅ Execute as queries SQL no banco de dados
2. ✅ Verifique os logs no console do servidor ao acessar a aba ajustes
3. ⏳ Analise os resultados para identificar a causa raiz
4. ⏳ Implemente a correção baseada nos achados
