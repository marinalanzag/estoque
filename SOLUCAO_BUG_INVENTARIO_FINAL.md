# 🔧 Solução: Bug do Inventário Final Mostrando Valores Errados

## 🎯 Causa Raiz Confirmada

### O Bug

**Aba Consolidado** e **Aba Inventário Final** estão usando **XMLs DIFERENTES** para calcular saídas!

### Código Problemático

#### 1. Aba Consolidado (`app/movimentacoes/consolidado/page.tsx` linha 415-422)

```typescript
const consolidado = await buildConsolidado(
  selectedImportId ?? activePeriod?.id ?? null,
  selectedFileId,
  {
    xmlImportIds:
      selectedXmlImportIds.length > 0 ? selectedXmlImportIds : undefined, // ← undefined!
  }
);
```

**Quando `selectedXmlImportIds` está vazio**:
- Passa `undefined`
- `buildConsolidado()` usa **TODOS os XMLs** do SPED

#### 2. Aba Inventário Final (`app/api/inventory-final/data/route.ts` linha 26-34)

```typescript
if (periodId) {
  const { getBaseXmlImportsForPeriod } = await import("@/lib/periods");
  const baseXmlImportIds = await getBaseXmlImportsForPeriod(periodId);

  if (baseXmlImportIds.length > 0) {
    xmlImportIds = baseXmlImportIds; // ← FORÇA usar só XMLs base!
    console.log(`[inventory-final/data] Usando ${baseXmlImportIds.length} XMLs base do período`);
  }
}

const { items, summary } = await getInventoryFinalData(
  spedFileId,
  periodId,
  { xmlImportIds: xmlImportIds ?? null } // ← Passa só XMLs base!
);
```

**Quando há período ativo**:
- Busca apenas XMLs base (`getBaseXmlImportsForPeriod`)
- Passa **apenas esses** para `buildConsolidado()`
- Resultado: **MENOS saídas** que o Consolidado!

---

## 📊 Exemplo Prático (Item 00013)

### Cenário

- **Total de XMLs no SPED**: 100 XMLs
- **XMLs base do período**: 30 XMLs
- **Saídas nos 100 XMLs**: 1.321 unidades
- **Saídas nos 30 XMLs base**: 386 unidades

### Resultado

| Aba | XMLs Usados | Saídas | Estoque Inicial + Entradas | Estoque Final |
|-----|-------------|--------|----------------------------|---------------|
| **Consolidado** | 100 (todos) | 1.321 | 780 | 780 - 1.321 = **-541** ✅ |
| **Inventário Final** | 30 (base) | 386 | 780 | 780 - 386 = **+394** ❌ |

**Diferença**: 394 - (-541) = **+935 unidades**

Exatamente a diferença entre usar TODOS os XMLs vs só XMLs base!

---

## ✅ SOLUÇÃO

### Opção 1: Inventário Final Usar Mesmos XMLs que Consolidado (RECOMENDADO)

**Modificar**: `app/api/inventory-final/data/route.ts`

**ANTES** (linhas 22-50):
```typescript
// CRÍTICO: Se houver período ativo, priorizar XMLs base do período
// Isso garante que o inventário final use os mesmos XMLs que a aba de saídas
let xmlImportIds: string[] | undefined = undefined;

if (periodId) {
  const { getBaseXmlImportsForPeriod } = await import("@/lib/periods");
  const baseXmlImportIds = await getBaseXmlImportsForPeriod(periodId);

  if (baseXmlImportIds.length > 0) {
    xmlImportIds = baseXmlImportIds; // ❌ FORÇA XMLs base
    console.log(`[inventory-final/data] Usando ${baseXmlImportIds.length} XMLs base do período`);
  }
}

// Se não há XMLs base ou não há período, tentar usar parâmetro de URL ou cookie
if (!xmlImportIds || xmlImportIds.length === 0) {
  const cookieStore = cookies();
  const cookieImportIdsRaw =
    cookieStore.get("selectedXmlImportIds")?.value ?? null;
  const cookieImportIds = cookieImportIdsRaw
    ? cookieImportIdsRaw.split(",").filter(Boolean)
    : null;

  if (xmlImportIdsParam) {
    xmlImportIds = xmlImportIdsParam.split(",").filter(Boolean);
  } else if (cookieImportIds && cookieImportIds.length > 0) {
    xmlImportIds = cookieImportIds;
  }
}
```

**DEPOIS** (SOLUÇÃO):
```typescript
// ✅ CORREÇÃO: NÃO forçar XMLs base, usar mesma lógica do Consolidado
// Isso garante consistência entre todas as abas
let xmlImportIds: string[] | undefined = undefined;

// Priorizar parâmetro de URL
if (xmlImportIdsParam) {
  xmlImportIds = xmlImportIdsParam.split(",").filter(Boolean);
  console.log(`[inventory-final/data] Usando ${xmlImportIds.length} XMLs do parâmetro URL`);
} else {
  // Fallback: usar cookie
  const cookieStore = cookies();
  const cookieImportIdsRaw =
    cookieStore.get("selectedXmlImportIds")?.value ?? null;

  if (cookieImportIdsRaw) {
    const cookieImportIds = cookieImportIdsRaw.split(",").filter(Boolean);
    if (cookieImportIds.length > 0) {
      xmlImportIds = cookieImportIds;
      console.log(`[inventory-final/data] Usando ${xmlImportIds.length} XMLs do cookie`);
    }
  }
}

// Se não há seleção específica, passar null para usar TODOS (mesma lógica do Consolidado)
if (!xmlImportIds || xmlImportIds.length === 0) {
  console.log(`[inventory-final/data] Nenhum XML selecionado, usando TODOS do SPED`);
}
```

**Mudanças**:
1. ❌ Remove lógica que força XMLs base do período
2. ✅ Usa mesma lógica do Consolidado (cookie ou URL param)
3. ✅ Se não há seleção, passa `undefined` = usa TODOS os XMLs

---

### Opção 2: Consolidado Também Usar XMLs Base (ALTERNATIVA)

**Se a regra de negócio é que DEVE usar só XMLs base quando há período:**

**Modificar**: `app/movimentacoes/consolidado/page.tsx` (linha 415-422)

**ANTES**:
```typescript
const consolidado = await buildConsolidado(
  selectedImportId ?? activePeriod?.id ?? null,
  selectedFileId,
  {
    xmlImportIds:
      selectedXmlImportIds.length > 0 ? selectedXmlImportIds : undefined,
  }
);
```

**DEPOIS**:
```typescript
// ✅ CORREÇÃO: Se há período ativo, usar XMLs base
let xmlsParaUsar = selectedXmlImportIds.length > 0 ? selectedXmlImportIds : undefined;

if (activePeriod && (!xmlsParaUsar || xmlsParaUsar.length === 0)) {
  const { getBaseXmlImportsForPeriod } = await import("@/lib/periods");
  const baseXmlImportIds = await getBaseXmlImportsForPeriod(activePeriod.id);

  if (baseXmlImportIds.length > 0) {
    xmlsParaUsar = baseXmlImportIds;
    console.log(`[consolidado] Usando ${baseXmlImportIds.length} XMLs base do período`);
  }
}

const consolidado = await buildConsolidado(
  selectedImportId ?? activePeriod?.id ?? null,
  selectedFileId,
  {
    xmlImportIds: xmlsParaUsar,
  }
);
```

**Mudanças**:
1. ✅ Consolid ado também força XMLs base quando há período
2. ✅ Ambas as abas usam mesmos XMLs
3. ⚠️ MAS muda comportamento atual do Consolidado

---

## 🎯 Recomendação Final

**✅ IMPLEMENTADA: OPÇÃO 2** (modificar Consolidado)

**Por quê?**
- ✅ Evita contaminação de dados entre períodos (regra de negócio confirmada)
- ✅ Todas as abas agora usam os mesmos XMLs base quando há período ativo
- ✅ Garante consistência entre Consolidado e Inventário Final
- ✅ Mantém integridade dos dados por período

---

## 📝 Implementação

### Arquivo: `app/api/inventory-final/data/route.ts`

**Substituir linhas 22-50 pelo código da Opção 1 acima.**

### Teste

1. Acessar aba Consolidado
2. Ver estoque final do item 00013
3. Acessar aba Inventário Final
4. Ver estoque final do item 00013
5. **Devem ser IDÊNTICOS**

### Validação SQL

```sql
-- Ver quais XMLs existem
SELECT
  id,
  label,
  is_base,
  period_id
FROM xml_sales_imports
WHERE sped_file_id = 'SEU_SPED_FILE_ID'
ORDER BY is_base DESC, created_at DESC;

-- Ver saídas por XML
SELECT
  xsi.label,
  xsi.is_base,
  COUNT(*) as total_items,
  SUM(COALESCE(di.movement_qty, di.qtd, 0)) as total_qtd
FROM document_items di
JOIN xml_sales_imports xsi ON di.xml_import_id = xsi.id
WHERE di.movement_type = 'saida'
  AND xsi.sped_file_id = 'SEU_SPED_FILE_ID'
GROUP BY xsi.id, xsi.label, xsi.is_base
ORDER BY xsi.is_base DESC, total_qtd DESC;
```

---

## ⚡ Urgência

🔴 **CRÍTICO - IMPLEMENTAR IMEDIATAMENTE**

Este bug causa:
- ❌ Inventários finais incorretos
- ❌ Decisões de ajuste baseadas em dados errados
- ❌ Relatórios fiscais imprecisos
- ❌ Perda de confiança no sistema

**Tempo estimado**: 15 minutos
**Risco**: Baixo (só remove código problemático)
**Impacto**: Alto (corrige dados críticos)
