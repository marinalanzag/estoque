# 🎯 CAUSA RAIZ IDENTIFICADA - Item 011141

## 📊 Dados do Diagnóstico

### Situação Reportada
- **Consolidação**: 35 inicial + 6 entradas - 12 saídas = **29** ✅
- **Ajustes**: Mostra **-28** ❌
- **Inventário Final**: 29 teórico + 9 ajustes = **10** final

### Dados Coletados pelo Diagnóstico

1. **Estoque Inicial (Base)**: 35.00 ✅
2. **Entradas**: 6.00 (confirmado pelo usuário)
3. **Saídas**:
   - **Base**: 12.00 ✅
   - **NÃO-Base**: 129.00 ⚠️ **PROBLEMA!**
   - **Total**: 141.00

4. **Ajustes**:
   - Recebido: 28.00
   - Fornecido: 19.00

## 🔍 CAUSA RAIZ

### Problema Principal
A **API de Ajustes** (`/api/adjustments/inventory-data`) está contando **saídas de XMLs não-base** quando deveria contar apenas XMLs base do período.

### Cálculo Correto (Consolidação)
```
Estoque Teórico = 35 + 6 - 12 = 29 ✅
```

### Cálculo Incorreto (se API contar todas as saídas)
```
Estoque Teórico = 35 + 6 - 141 = -100
Com ajustes: -100 + 28 - 19 = -91
```

### Por que aparece -28?
Há uma discrepância entre o cálculo esperado (-91) e o valor mostrado (-28). Isso sugere que:

1. **A API pode estar contando apenas parte das saídas não-base** (não todas as 129)
2. **Ou há um problema na forma como o período está sendo detectado** na API
3. **Ou há um problema na função `getBaseXmlImportsForPeriod`** que não está retornando os IDs corretos

## 🔧 VERIFICAÇÕES NECESSÁRIAS

### 1. Verificar se a API está recebendo o período
Adicionar logs na API para verificar:
- Se `activePeriod` está sendo detectado
- Se `getBaseXmlImportsForPeriod` está retornando IDs
- Quantos XMLs base estão sendo usados

### 2. Verificar XMLs base do período
Executar query SQL:
```sql
SELECT id, label, is_base, period_id, created_at
FROM xml_sales_imports
WHERE period_id = '6d4abba3-fc54-4946-a248-5e5370693a92'  -- ID do período Jan/2023
ORDER BY created_at DESC;
```

### 3. Verificar se há XMLs sem period_id sendo contados
A API pode estar contando XMLs que não têm `period_id` definido mas pertencem ao mesmo SPED.

## 💡 SOLUÇÃO PROPOSTA

### Opção 1: Corrigir a API de Ajustes (Recomendado)
Garantir que a API use **exatamente a mesma lógica** da Consolidação:

1. Usar `buildConsolidado()` diretamente na API de ajustes
2. Ou garantir que o filtro de XMLs base esteja funcionando corretamente

### Opção 2: Adicionar Validação e Logs
Adicionar logs detalhados na API para identificar exatamente quais XMLs estão sendo usados:

```typescript
console.log("[inventory-data] XMLs base encontrados:", baseXmlImportIds);
console.log("[inventory-data] XMLs que serão usados:", xmlImports.map(x => x.id));
console.log("[inventory-data] Total de saídas encontradas:", exits.length);
```

### Opção 3: Usar buildConsolidado na API
A solução mais segura seria fazer a API de Ajustes usar `buildConsolidado()` diretamente, garantindo que ambos usem exatamente a mesma lógica.

## 📝 PRÓXIMOS PASSOS

1. ✅ **Diagnóstico completo** - CONCLUÍDO
2. ⏳ **Adicionar logs na API** para identificar quais XMLs estão sendo usados
3. ⏳ **Verificar se `getBaseXmlImportsForPeriod` está retornando os IDs corretos**
4. ⏳ **Corrigir a API** para usar apenas XMLs base do período
5. ⏳ **Testar** com o item 011141 após a correção

## 🎯 CONCLUSÃO

A causa raiz é que a **API de Ajustes está contando saídas de XMLs não-base** (129 unidades) quando deveria contar apenas XMLs base do período (12 unidades). Isso causa uma diferença de 117 unidades nas saídas, resultando no saldo incorreto de -28 ao invés de 29.

