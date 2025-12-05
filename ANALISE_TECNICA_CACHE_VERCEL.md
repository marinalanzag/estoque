# 🔍 Análise Técnica: Problema de Cache na Vercel

## 📋 Contexto do Problema

**Sintomas:**
- ✅ Funciona perfeitamente em desenvolvimento local
- ❌ Inconsistências graves em produção (Vercel)
- ✅ Funciona em aba anônima (tanto local quanto Vercel)
- ❌ Não funciona em aba normal na Vercel

**Conclusão preliminar:** Problema de cache do navegador + cache do Next.js/Vercel

---

## 1. 🗄️ Camadas de Cache da Vercel

### 1.1 Data Cache (Next.js)
**O que é:** Cache de dados de fetch() no servidor
**Status no projeto:** ✅ **PROTEGIDO**
- Todas as API routes têm `export const dynamic = "force-dynamic"`
- Headers `Cache-Control: no-store` nas respostas
- **Não é o problema principal**

### 1.2 Route Cache (Next.js App Router)
**O que é:** Cache de rotas renderizadas no servidor
**Status no projeto:** ⚠️ **POTENCIAL PROBLEMA**
- Páginas Server Components podem ser cacheadas
- `app/periodos/configuracao/page.tsx` tem `export const dynamic = "force-dynamic"` ✅
- Mas `app/(app)/layout.tsx` é Client Component e renderiza `PeriodSelector` (Client Component)
- **Pode estar servindo HTML antigo**

### 1.3 Edge Cache (Vercel CDN)
**O que é:** Cache de respostas HTTP na CDN da Vercel
**Status no projeto:** ⚠️ **PROVÁVEL CAUSA**
- Vercel cacheia respostas HTTP por padrão
- Mesmo com `Cache-Control: no-store`, Edge Cache pode ignorar
- **Aba anônima não tem cache → funciona**
- **Aba normal tem cache → mostra dados antigos**

### 1.4 Browser Cache (Navegador)
**O que é:** Cache de recursos no navegador
**Status no projeto:** ⚠️ **CAUSA PRINCIPAL**
- Fetch requests podem ser cacheados pelo navegador
- `PeriodSelector` faz fetch para `/api/periods/list` e `/api/periods/active`
- Mesmo com `cache: "no-store"`, navegador pode cachear
- **Aba anônima não tem cache → funciona**
- **Aba normal tem cache → mostra dados antigos**

---

## 2. 🔍 Como Confirmar Interferência de Cache

### 2.1 Verificar Edge Cache (Vercel)
```bash
# Fazer request com curl e verificar headers
curl -I https://seu-app.vercel.app/api/periods/list

# Verificar se retorna:
# - X-Vercel-Cache: HIT (cacheado)
# - X-Vercel-Cache: MISS (não cacheado)
```

### 2.2 Verificar Browser Cache
1. Abrir DevTools → Network
2. Fazer request para `/api/periods/list`
3. Verificar:
   - **Status:** 200 (from disk cache) = cacheado
   - **Status:** 200 = não cacheado
4. Comparar resposta em aba normal vs anônima

### 2.3 Verificar Route Cache
1. Verificar HTML retornado pelo servidor
2. Se HTML contém dados antigos → Route Cache
3. Se HTML está correto mas JS mostra dados antigos → Browser Cache

---

## 3. 🧩 Por Que Aba Anônima Funciona?

### 3.1 Browser Cache
- **Aba normal:** Tem cache persistente do navegador
- **Aba anônima:** Sem cache persistente
- **Resultado:** Aba anônima sempre busca dados frescos

### 3.2 Service Workers
**Status:** ✅ **NÃO ENCONTRADOS**
- Não há `sw.js`, `service-worker.js`, ou `manifest.json`
- Não é causa do problema

### 3.3 localStorage/sessionStorage
**Status:** ✅ **NÃO ENCONTRADOS**
- Não há uso de `localStorage` ou `sessionStorage` no código
- Não é causa do problema

### 3.4 PWA
**Status:** ✅ **NÃO ENCONTRADO**
- Não há configuração de PWA
- Não é causa do problema

---

## 4. 🔎 Fontes de Verdade Duplicadas

### 4.1 Análise do Código

#### ✅ **Fonte de Verdade Única (Server-Side)**
- `lib/periods.ts` → `getActivePeriodFromRequest()` → Sempre busca do banco
- `app/api/periods/list/route.ts` → Sempre busca do banco
- `app/api/periods/active/route.ts` → Sempre busca do banco

#### ⚠️ **Fonte de Verdade Duplicada (Client-Side)**
- `components/periods/PeriodSelector.tsx` → Client Component
  - Faz fetch para `/api/periods/list` e `/api/periods/active`
  - Mantém estado local (`useState`)
  - **Pode ficar desatualizado se cache do navegador servir resposta antiga**

#### ⚠️ **Server Components Usando Fonte de Verdade**
- `app/periodos/configuracao/page.tsx` → Usa `getActivePeriodFromRequest()`
- `app/movimentacoes/entradas/page.tsx` → Usa `getActivePeriodFromRequest()`
- `app/movimentacoes/saidas/page.tsx` → Usa `getActivePeriodFromRequest()`
- **Estes estão corretos, mas podem ser cacheados pelo Route Cache**

### 4.2 Risco de Dados Stale

**Alto Risco:**
1. **PeriodSelector (Client Component)**
   - Estado local pode ficar desatualizado
   - Fetch pode retornar cache do navegador
   - **Solução:** Forçar bypass de cache mais agressivo

**Médio Risco:**
2. **Server Components**
   - Podem ser cacheados pelo Route Cache
   - **Solução:** Já tem `dynamic = "force-dynamic"`, mas pode não ser suficiente

**Baixo Risco:**
3. **API Routes**
   - Já têm `dynamic = "force-dynamic"` e headers anti-cache
   - Mas Edge Cache da Vercel pode ignorar

---

## 5. 🏗️ Arquitetura Atual vs Ideal

### 5.1 Arquitetura Atual

```
┌─────────────────────────────────────────┐
│  Browser (Client)                       │
│  ┌───────────────────────────────────┐ │
│  │ PeriodSelector (Client Component) │ │
│  │ - useState (estado local)         │ │
│  │ - fetch('/api/periods/list')     │ │
│  │ - fetch('/api/periods/active')   │ │
│  └───────────────────────────────────┘ │
└──────────────┬──────────────────────────┘
               │ HTTP Request (pode ser cacheado)
               ▼
┌─────────────────────────────────────────┐
│  Vercel Edge Cache                      │
│  ⚠️ Pode cachear resposta                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Next.js API Route                      │
│  /api/periods/list                     │
│  - dynamic = "force-dynamic"            │
│  - Cache-Control: no-store              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Supabase (Fonte de Verdade)            │
└─────────────────────────────────────────┘
```

**Problemas:**
1. Edge Cache pode cachear resposta
2. Browser Cache pode cachear fetch
3. Estado local pode ficar desatualizado

### 5.2 Arquitetura Ideal (Mais Robusta)

```
┌─────────────────────────────────────────┐
│  Browser (Client)                       │
│  ┌───────────────────────────────────┐ │
│  │ PeriodSelector (Client Component) │ │
│  │ - Sem estado local                │ │
│  │ - Usa Server Component via props │ │
│  └───────────────────────────────────┘ │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Server Component (Layout)              │
│  - Busca períodos via getActivePeriod  │
│  - Passa como props para Client        │
│  - revalidatePath após mutações        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Server Actions (Mutações)             │
│  - Criar período                        │
│  - Ativar período                       │
│  - revalidatePath('/')                  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Supabase (Fonte de Verdade)            │
└─────────────────────────────────────────┘
```

**Vantagens:**
1. ✅ Sem cache do navegador (dados vêm do servidor)
2. ✅ Sem Edge Cache (Server Components não são cacheados)
3. ✅ Sincronização garantida via `revalidatePath`
4. ✅ Fonte de verdade única (Server Components)

---

## 6. 🎯 Recomendações Técnicas

### 6.1 Solução Imediata (Sem Refatoração)

**Problema:** Browser Cache + Edge Cache servindo dados antigos

**Solução:**
1. **Forçar bypass de cache mais agressivo:**
   ```typescript
   // Em PeriodSelector.tsx
   const res = await fetch(`/api/periods/list?t=${Date.now()}&r=${Math.random()}`, {
     cache: "no-store",
     headers: {
       'Cache-Control': 'no-store, no-cache, must-revalidate',
       'Pragma': 'no-cache',
       'Expires': '0',
     },
   });
   ```

2. **Adicionar headers na Vercel:**
   ```json
   // vercel.json
   {
     "headers": [
       {
         "source": "/api/periods/(.*)",
         "headers": [
           {
             "key": "Cache-Control",
             "value": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
           }
         ]
       }
     ]
   }
   ```

### 6.2 Solução Ideal (Refatoração)

**Migrar para Server Components + Server Actions:**

1. **Criar Server Component para períodos:**
   ```typescript
   // app/components/periods/PeriodSelectorServer.tsx
   export default async function PeriodSelectorServer() {
     const periods = await getAvailablePeriods();
     const activePeriod = await getActivePeriodFromRequest();
     return <PeriodSelectorClient periods={periods} activePeriod={activePeriod} />;
   }
   ```

2. **Criar Server Actions para mutações:**
   ```typescript
   // app/actions/periods.ts
   'use server'
   import { revalidatePath } from 'next/cache';
   
   export async function createPeriod(data) {
     // Criar período
     revalidatePath('/');
     revalidatePath('/periodos/configuracao');
   }
   ```

3. **Usar no Layout:**
   ```typescript
   // app/(app)/layout.tsx
   import PeriodSelectorServer from '@/components/periods/PeriodSelectorServer';
   
   export default function AppLayout({ children }) {
     return (
       <>
         <PeriodSelectorServer />
         {children}
       </>
     );
   }
   ```

**Vantagens:**
- ✅ Sem cache do navegador
- ✅ Sem Edge Cache
- ✅ Sincronização garantida
- ✅ Mais performático (menos requests)

---

## 7. 📊 Resumo da Análise

### 7.1 Causa Raiz
**Browser Cache + Edge Cache** servindo dados antigos em produção

### 7.2 Por Que Funciona em Dev?
- Dev não tem Edge Cache
- Dev não cacheia tão agressivamente
- Hot reload força atualização

### 7.3 Por Que Funciona em Aba Anônima?
- Aba anônima não tem cache persistente
- Sempre busca dados frescos

### 7.4 Fontes de Verdade
- ✅ Server-side: Única fonte de verdade (Supabase)
- ⚠️ Client-side: Pode ficar desatualizado (cache)

### 7.5 Arquitetura
- ⚠️ Atual: Client Component fazendo fetch (vulnerável a cache)
- ✅ Ideal: Server Component passando props (sem cache)

---

## 8. 🚀 Próximos Passos

### Opção 1: Solução Rápida (1-2 horas)
1. Adicionar headers anti-cache mais agressivos
2. Adicionar query params únicos em cada fetch
3. Testar em produção

### Opção 2: Solução Ideal (4-6 horas)
1. Migrar para Server Components
2. Criar Server Actions
3. Usar `revalidatePath` após mutações
4. Testar em produção

**Recomendação:** Começar com Opção 1, depois migrar para Opção 2.

