# Solução: Problema de Cache no Período Ativo

## Problema Identificado

Você criou o período de **Abril/2023** e ele está corretamente configurado como ativo no banco de dados, mas a aplicação continuava mostrando **Outubro/2021** (um período que já foi excluído).

## Causa Raiz

O problema era **cache do Next.js e do navegador**:

1. ✅ **Banco de dados estava correto**: Abril/2023 estava ativo
2. ✅ **Outubro/2021 não existe mais no banco**
3. ❌ **O frontend tinha dados antigos em cache**

## Soluções Implementadas

### 1. Busca Direta da API no Cliente

Adicionei um `useEffect` no componente `PeriodSelectorClient.tsx` que:
- Busca o período ativo diretamente da API ao montar o componente
- Usa headers `no-cache` para evitar cache do navegador
- Atualiza automaticamente se o período for diferente do esperado

**Arquivo**: [components/periods/PeriodSelectorClient.tsx](components/periods/PeriodSelectorClient.tsx)

```typescript
// Buscar período ativo diretamente da API ao montar para evitar cache
useEffect(() => {
  const fetchActivePeriod = async () => {
    try {
      const response = await fetch("/api/periods/active", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.period) {
          // Atualizar apenas se for diferente do estado atual
          if (!activePeriod || activePeriod.id !== data.period.id) {
            console.log("[PeriodSelector] Atualizando período ativo do cache:", data.period);
            setActivePeriod(data.period);
          }
        }
      }
    } catch (error) {
      console.error("[PeriodSelector] Erro ao buscar período ativo:", error);
    }
  };

  fetchActivePeriod();
}, []); // Executar apenas uma vez ao montar
```

### 2. Headers Anti-Cache na API

Atualizei a rota `/api/periods/active` para incluir headers que impedem cache:

**Arquivo**: [app/api/periods/active/route.ts](app/api/periods/active/route.ts)

```typescript
const headers = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

return NextResponse.json(
  {
    ok: true,
    period: activePeriod,
  },
  { headers }
);
```

### 3. Script de Limpeza de Cache

Criei um script para limpar completamente o cache do Next.js quando necessário:

**Arquivo**: [scripts/clear-cache.sh](scripts/clear-cache.sh)

**Como usar**:
```bash
./scripts/clear-cache.sh
```

Ou manualmente:
```bash
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

## Como Verificar se Funcionou

1. **Limpe o cache do Next.js**:
   ```bash
   ./scripts/clear-cache.sh
   ```

2. **Limpe o cache do navegador**:
   - Abra DevTools (F12)
   - Clique com botão direito no botão de refresh
   - Escolha "Empty Cache and Hard Reload" (Chrome) ou "Limpar Cache" (outros)

3. **Reinicie o servidor**:
   ```bash
   npm run dev
   ```

4. **Abra a aplicação**:
   - O período ativo deve ser **Abril/2023**
   - Verifique no console do navegador a mensagem:
     ```
     [PeriodSelector] Atualizando período ativo do cache: {período}
     ```

## Verificação no Banco de Dados

Para confirmar que o banco está correto, execute:

```bash
npx tsx scripts/check-october-2021.ts
```

Resultado esperado:
```
✅ Nenhum período de outubro/2021 encontrado no banco
✅ 4/2023 (ID: bcd7dec1-3f89-466f-8ee1-2ee3579c0562) ATIVO
```

## Prevenção Futura

As soluções implementadas previnem esse problema no futuro porque:

1. **Sempre busca dados frescos**: O componente busca o período ativo diretamente da API em cada montagem
2. **Headers anti-cache**: A API retorna headers que impedem cache do navegador
3. **Validação automática**: O código compara o período recebido com o estado atual e atualiza se diferente

## Resumo

| Item | Status |
|------|--------|
| Banco de dados | ✅ Correto (Abril/2023 ativo) |
| Outubro/2021 existe? | ✅ Não (foi excluído) |
| Cache do cliente | ✅ Corrigido (busca direta da API) |
| Cache da API | ✅ Corrigido (headers anti-cache) |
| Script de limpeza | ✅ Criado |

**Próximo passo**: Limpe o cache e reinicie a aplicação para ver Abril/2023 corretamente!
