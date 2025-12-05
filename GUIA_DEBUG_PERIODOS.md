# 🔍 Guia de Debug - Endpoint de Diagnóstico de Períodos

## 📍 Endpoint Criado

`/api/periods/debug` - Retorna dados **BRUTOS** diretamente do Supabase, sem processamento.

## 🎯 Objetivo

Provar de onde vêm os dados e identificar onde está o problema de cache/desincronização.

## 📋 Como Usar

### 1. Acessar o Endpoint de Debug

Abra no navegador:
```
http://localhost:3000/api/periods/debug
```

Ou se estiver em produção:
```
https://seu-dominio.com/api/periods/debug
```

### 2. Comparar com o Dashboard do Supabase

1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor** ou **Table Editor**
3. Execute a query:
   ```sql
   SELECT * FROM periods 
   ORDER BY created_at DESC;
   ```
4. Execute também:
   ```sql
   SELECT * FROM periods 
   WHERE is_active = true
   ORDER BY created_at DESC;
   ```

### 3. Comparar Resultados

Compare linha a linha:

#### ✅ Se `/api/periods/debug` BATER com o Dashboard:
- **Banco está OK** ✅
- O problema está em `/api/periods/list` ou no frontend
- Provavelmente cache no Next.js ou processamento incorreto

#### ❌ Se `/api/periods/debug` NÃO BATER com o Dashboard:
- **Problema na conexão com Supabase** ❌
- Pode estar apontando para outro projeto/env
- Verificar variáveis de ambiente:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 4. Comparar com `/api/periods/list`

Abra também:
```
http://localhost:3000/api/periods/list
```

#### Comparação:

| Endpoint | O que retorna | Processamento |
|----------|---------------|---------------|
| `/api/periods/debug` | **DADOS BRUTOS** do banco | ❌ Nenhum |
| `/api/periods/list` | Dados processados/filtrados | ✅ Validação e filtros |

**Se `debug` mostrar dados corretos mas `list` mostrar dados incorretos:**
- O problema está no processamento/filtros de `/api/periods/list`
- Ou cache do Next.js na rota `/api/periods/list`

## 📊 Estrutura da Resposta do Debug

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "env": {
    "url": "https://xxxxx.supabase.co",
    "hasServiceKey": true,
    "urlPreview": "https://xxxxx.supabase.co..."
  },
  "query": {
    "count": 4,
    "dataLength": 4,
    "error": null
  },
  "periods": [
    {
      "id": "...",
      "year": 2027,
      "month": 5,
      "name": "Maio 2027",
      "label": "Mai/2027",
      "is_active": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "activePeriods": {
    "count": 1,
    "data": [...],
    "error": null
  }
}
```

## 🔬 Análise dos Resultados

### Cenário 1: Debug mostra dados corretos ✅

```
Debug: 4 períodos (incluindo "Maio 2027" ativo)
Dashboard: 4 períodos (incluindo "Maio 2027" ativo)
```

**Diagnóstico:** Banco OK. Problema está no processamento ou cache.

**Próximos Passos:**
1. Verificar `/api/periods/list` - compara com debug
2. Verificar frontend - ver o que está sendo recebido
3. Verificar cache do Next.js

### Cenário 2: Debug mostra dados incorretos ❌

```
Debug: 4 períodos (incluindo períodos antigos)
Dashboard: 3 períodos (sem períodos antigos)
```

**Diagnóstico:** Problema na conexão com Supabase ou ambiente errado.

**Próximos Passos:**
1. Verificar `NEXT_PUBLIC_SUPABASE_URL` no `.env.local`
2. Verificar `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`
3. Verificar se está apontando para o projeto correto

### Cenário 3: Debug OK, mas List diferente ❌

```
Debug: 4 períodos corretos
List: 2 períodos (faltando alguns)
```

**Diagnóstico:** Problema no processamento/filtros de `/api/periods/list`.

**Próximos Passos:**
1. Verificar filtros em `/api/periods/list`
2. Verificar validações que podem estar excluindo períodos válidos
3. Verificar cache específico da rota `/api/periods/list`

## 🛠️ Próximas Fases (Após Provar Origem)

### Fase 1: Se problema está em `/api/periods/list`
- Remover cache dessa rota
- Simplificar processamento
- Comparar query SQL com debug

### Fase 2: Se problema está no frontend
- Verificar Network tab do navegador
- Ver o que está sendo recebido da API
- Verificar estado React

### Fase 3: Se problema está na conexão
- Verificar variáveis de ambiente
- Verificar se está no projeto correto
- Resetar conexão do Supabase

## 📝 Notas Técnicas

- O endpoint `/api/periods/debug` usa:
  - `dynamic = "force-dynamic"` - Força execução dinâmica
  - `revalidate = 0` - Sem revalidação
  - `fetchCache = "force-no-store"` - Força sem cache
  - Headers anti-cache explícitos

- Query idêntica ao que deveria estar sendo feito, mas sem processamento/filtros

- Retorna dados brutos para comparação direta com Dashboard do Supabase

