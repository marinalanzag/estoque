# 🐛 BUG: Exclusão de Ajustes Não Aparece no Inventário Final

## Problema Identificado

Quando você exclui um ajuste:
1. ✅ O ajuste é REMOVIDO do banco de dados com sucesso
2. ✅ O ajuste DESAPARECE da tabela de ajustes
3. ❌ O inventário final **NÃO atualiza** e continua mostrando o ajuste excluído nos cálculos
4. ❌ **Cache não é limpo** para a rota `/api/adjustments/inventory-data`

---

## Causa Raiz

### Localização
[app/api/adjustments/delete/route.ts:36-38](app/api/adjustments/delete/route.ts:36-38)

### Código Problemático

```typescript
// Revalidar as rotas afetadas
revalidatePath("/inventario-final");
revalidatePath("/api/inventory-final/data");
revalidatePath("/movimentacoes/consolidado");
```

**PROBLEMA**: Faltam revalidações críticas!

A API está revalidando:
- ✅ `/inventario-final` (página do inventário final)
- ✅ `/api/inventory-final/data` (API do inventário final)
- ✅ `/movimentacoes/consolidado` (página de movimentações)

Mas **NÃO está revalidando**:
- ❌ `/api/adjustments/inventory-data` ← **API principal de ajustes**
- ❌ `/api/adjustments/list` ← API de listagem de ajustes
- ❌ `/ajustes` ← Página de ajustes

### Por Que Isso Causa o Problema

1. Você clica no botão "🗑️ Excluir"
2. Frontend chama `DELETE /api/adjustments/delete?id=xxx`
3. API deleta o ajuste do banco ✅
4. API revalida apenas 3 rotas (não incluindo `/api/adjustments/inventory-data`)
5. Frontend recarrega dados chamando `/api/adjustments/inventory-data`
6. **Cache retorna dados ANTIGOS** (com o ajuste ainda lá)
7. Inventário final continua mostrando o ajuste excluído

---

## Evidência do Bug no Código Frontend

Veja linha 1472-1482 em [AdjustmentsTable.tsx](components/adjustments/AdjustmentsTable.tsx:1472-1482):

```typescript
// Recarregar dados do inventário para refletir a exclusão
console.log("[DELETE] Recarregando inventário...");
await loadInventoryData();  // ← Chama /api/adjustments/inventory-data

// Revalidar a página no servidor
console.log("[DELETE] Revalidando página...");
if (onRefresh) {
  onRefresh();
}
await new Promise(resolve => setTimeout(resolve, 300));
router.refresh();  // ← Tenta forçar revalidação, mas não funciona porque API está cacheada!
```

O frontend está fazendo tudo certo:
1. Remove ajuste do estado local ✅
2. Recarrega dados do inventário ✅
3. Chama `router.refresh()` ✅

Mas o **cache do servidor não foi limpo**, então `/api/adjustments/inventory-data` retorna dados antigos!

---

## Correção

### Opção 1: Adicionar Revalidações Faltantes (RECOMENDADO)

Modificar [app/api/adjustments/delete/route.ts:35-39](app/api/adjustments/delete/route.ts:35-39):

```typescript
// Revalidar TODAS as rotas afetadas
revalidatePath("/inventario-final");
revalidatePath("/api/inventory-final/data");
revalidatePath("/movimentacoes/consolidado");

// ADICIONAR estas revalidações:
revalidatePath("/ajustes");
revalidatePath("/api/adjustments/inventory-data");
revalidatePath("/api/adjustments/list");
revalidatePath("/api/consolidado/data");
```

### Opção 2: Desabilitar Cache na API de Inventory Data (JÁ FEITO)

A API `/api/adjustments/inventory-data` já tem:
```typescript
export const revalidate = 0; // Desabilita cache completamente
```

Mas isso **NÃO é suficiente** porque o `revalidatePath` não está sendo chamado para ela!

### Opção 3: Usar `revalidateTag` (MAIS AVANÇADO)

Adicionar tags nas APIs e revalidar por tag:

```typescript
// Na API de ajustes
export const revalidate = 0;
export const tags = ['adjustments'];

// Na API de delete
revalidateTag('adjustments');
```

---

## Implementação da Correção

Vou aplicar a Opção 1 (adicionar todas as revalidações):

```typescript
// app/api/adjustments/delete/route.ts
export async function DELETE(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const searchParams = req.nextUrl.searchParams;
    const adjustmentId = searchParams.get("id");

    if (!adjustmentId) {
      return NextResponse.json(
        { error: "ID do ajuste é obrigatório" },
        { status: 400 }
      );
    }

    // Deletar ajuste
    const { error } = await supabaseAdmin
      .from("code_offset_adjustments")
      .delete()
      .eq("id", adjustmentId);

    if (error) {
      console.error("Erro ao deletar ajuste:", error);
      return NextResponse.json(
        { error: `Erro ao deletar ajuste: ${error.message}` },
        { status: 500 }
      );
    }

    console.log(`[DELETE] ✅ Ajuste ${adjustmentId} deletado com sucesso`);

    // ✅ CORREÇÃO: Revalidar TODAS as rotas afetadas pela exclusão
    const rotasParaRevalidar = [
      // Páginas
      "/ajustes",
      "/inventario-final",
      "/movimentacoes/consolidado",

      // APIs de dados
      "/api/adjustments/inventory-data",
      "/api/adjustments/list",
      "/api/inventory-final/data",
      "/api/consolidado/data",
    ];

    console.log(`[DELETE] Revalidando ${rotasParaRevalidar.length} rotas...`);
    rotasParaRevalidar.forEach(rota => {
      try {
        revalidatePath(rota);
        console.log(`[DELETE] ✅ Revalidado: ${rota}`);
      } catch (err) {
        console.error(`[DELETE] ⚠️ Erro ao revalidar ${rota}:`, err);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
```

---

## Testes Após Correção

### Teste 1: Excluir Ajuste e Verificar Inventário Final
1. Criar ajuste: 011141 recebe 28 de 013671
2. Verificar que inventário final mostra estoque_final = 38
3. **Excluir ajuste**
4. Verificar que inventário final **atualiza imediatamente** para 10

### Teste 2: Excluir Ajuste e Verificar Aba Ajustes
1. Criar ajuste
2. Verificar que aparece na tabela de ajustes
3. **Excluir ajuste**
4. Verificar que **desaparece da tabela** e inventário atualiza

### Teste 3: Excluir Ajuste e Atualizar Página
1. Criar ajuste
2. **Excluir ajuste**
3. F5 (recarregar página)
4. Verificar que ajuste **não volta** (confirmação de que foi deletado do banco)

---

## Por Que o Botão "Funciona" Mas Não Atualiza?

O botão de exclusão **ESTÁ FUNCIONANDO CORRETAMENTE**:

1. ✅ onClick é disparado (linha 1418)
2. ✅ Confirmação é mostrada (linha 1422)
3. ✅ Fetch DELETE é executado (linha 1439)
4. ✅ Banco de dados é atualizado (ajuste é deletado)
5. ✅ Estado local é atualizado (linha 1463)
6. ✅ `loadInventoryData()` é chamado (linha 1474)

**O PROBLEMA está no passo 6**: `loadInventoryData()` chama `/api/adjustments/inventory-data`, mas essa rota **não foi revalidada**, então retorna dados cacheados (com o ajuste ainda lá).

---

## Resumo

**Problema**: Exclusão de ajustes não aparece no inventário final
**Causa**: API de delete não revalida `/api/adjustments/inventory-data`
**Solução**: Adicionar revalidação dessa rota

Após a correção, quando você excluir um ajuste:
1. ✅ Ajuste será removido do banco
2. ✅ Ajuste desaparecerá da tabela
3. ✅ **Inventário final atualizará imediatamente**
4. ✅ Cache será limpo automaticamente
