# 📋 Diferenças Principais - Refatoração Arquitetural de Períodos

## 🔄 Fluxo de Dados: Antes vs Depois

### Antes (Client Components + Fetch)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ Fetch /api/periods/list
       ▼
┌─────────────────────┐     ┌─────────────────┐
│   Edge Cache        │────▶│  Browser Cache  │
│   (Vercel CDN)      │     │                 │
└──────┬──────────────┘     └────────┬────────┘
       │                             │
       │ Dados stale                 │ Dados stale
       ▼                             ▼
┌─────────────────────┐     ┌─────────────────┐
│   Estado Local      │     │  UI Desatualizada│
│   (useState)        │     │                 │
└─────────────────────┘     └─────────────────┘
```

### Depois (Server Components + Server Actions)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ Request HTML
       ▼
┌─────────────────────┐
│  Server Component   │
│  (getAllPeriods)    │
│  (getActivePeriod)  │
└──────┬──────────────┘
       │
       │ Dados frescos do banco
       ▼
┌─────────────────────┐
│   HTML com dados    │
│   (sem cache)       │
└─────────────────────┘
```

## 📝 Diferenças Principais nos Arquivos

### 1. lib/periods.ts

**Adicionado:**
```typescript
export async function getAllPeriods(): Promise<Period[]> {
  return getAvailablePeriods();
}

export async function getActivePeriod(): Promise<Period | null> {
  // Busca direto do banco, sem query params
}
```

### 2. app/periodos/configuracao/actions.ts (NOVO)

**Server Actions criadas:**
```typescript
"use server";

export async function createPeriodAction(payload) {
  // Lógica de criação mantida
  // ...
  revalidatePath("/periodos/configuracao");
  revalidatePath("/");
}

export async function setActivePeriodAction(periodId) {
  // Lógica de ativação mantida
  // ...
  revalidatePath("/periodos/configuracao");
}
```

### 3. components/periods/PeriodSelectorServer.tsx (NOVO)

**Server Component wrapper:**
```typescript
export default async function PeriodSelectorServer() {
  const [periods, activePeriod] = await Promise.all([
    getAllPeriods(),
    getActivePeriod(),
  ]);

  return (
    <PeriodSelectorClient
      initialPeriods={periods}
      initialActivePeriod={activePeriod}
    />
  );
}
```

### 4. components/periods/PeriodSelectorClient.tsx (NOVO)

**Client Component refatorado - Principais mudanças:**

**ANTES:**
```typescript
// ❌ Fetch no cliente
const loadPeriods = async () => {
  const res = await fetch("/api/periods/list", { ... });
  // ...
};

// ❌ Eventos customizados
window.addEventListener('period:created', handlePeriodUpdated);

// ❌ window.location
window.location.href = newUrl;
```

**DEPOIS:**
```typescript
// ✅ Recebe dados via props
interface PeriodSelectorClientProps {
  initialPeriods: Period[];
  initialActivePeriod: Period | null;
}

// ✅ Usa Server Actions
const result = await createPeriodAction(newPeriod);
router.refresh(); // Revalida Server Components

// ✅ Sem eventos customizados
// ✅ Sem window.location
```

### 5. app/(app)/layout.tsx

**ANTES:**
```typescript
import PeriodSelector from "@/components/periods/PeriodSelector";
<PeriodSelector />
```

**DEPOIS:**
```typescript
import PeriodSelectorServer from "@/components/periods/PeriodSelectorServer";
<PeriodSelectorServer />
```

### 6. Componentes que Faziam Fetch

**Exemplo: SpedUploadForm.tsx**

**ANTES:**
```typescript
useEffect(() => {
  const loadActivePeriod = async () => {
    const res = await fetch("/api/periods/active");
    // ...
  };
  loadActivePeriod();
}, []);
```

**DEPOIS:**
```typescript
interface SpedUploadFormProps {
  activePeriodId?: string | null;
}

export default function SpedUploadForm({
  activePeriodId: initialActivePeriodId = null,
}: SpedUploadFormProps) {
  const [activePeriodId] = useState(initialActivePeriodId);
  // Sem fetch!
}
```

## ✅ Confirmando Requisitos

### ✅ Nenhuma Regra de Negócio Alterada
- Validações mantidas
- Lógicas de criação/ativação mantidas
- Estrutura de dados mantida

### ✅ Nenhuma Consulta de Outros Domínios Alterada
- SPED não alterado
- Movimentações não alteradas
- Upload não alterado (apenas forma de obter período)
- Ajustes não alterados (apenas forma de obter período)

### ✅ Formato dos Dados Mantido
- Mesmas interfaces
- Mesmos contratos
- Mesmas estruturas

## 🎯 Resultado Final

**Fluxo de dados DOS PERÍODOS:**

1. **Leitura:** Server Components buscam diretamente no banco
2. **Mutação:** Server Actions fazem mutação + `revalidatePath()`
3. **Sincronização:** `router.refresh()` após mutações

**Elimina:**
- ✅ Browser Cache
- ✅ Edge Cache
- ✅ Estado local desatualizado
- ✅ Eventos customizados frágeis
- ✅ Diferenças entre dev e produção

