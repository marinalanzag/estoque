# 🔍 Diagnóstico: Período Não Está Sendo Criado

Este documento lista todas as possíveis causas e como verificar cada uma.

---

## ✅ Checklist de Verificação

### 1. Verificar se a Tabela Existe

**Onde verificar:**
- Supabase Dashboard → Table Editor
- Procure por tabela chamada `periods`

**Se não existir:**
- Execute o arquivo `db/schema_periods.sql` no SQL Editor do Supabase

---

### 2. Verificar Variáveis de Ambiente no Vercel

**Onde verificar:**
- Vercel Dashboard → Seu Projeto → Settings → Environment Variables

**O que deve ter:**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` = `https://zpsxcdttmtfeosmmkeyn.supabase.co`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_...` (chave completa)

**Como testar:**
- Vercel → Deployments → Último deploy → Functions Logs
- Procure por erros: "Variáveis de ambiente do Supabase não configuradas"

---

### 3. Verificar Estrutura da Tabela `periods`

**No Supabase:**
- Table Editor → `periods` → Ver estrutura

**Colunas que DEVE ter:**
- ✅ `id` (uuid)
- ✅ `year` (int)
- ✅ `month` (int)
- ✅ `name` (text)
- ✅ `description` (text, nullable)
- ✅ `is_active` (boolean)
- ✅ `created_at` (timestamptz)
- ✅ `updated_at` (timestamptz)
- ⚠️ `label` (text, nullable) - **OPCIONAL** - se não existir, pode causar erro

**Se `label` não existir, adicione:**
```sql
alter table public.periods 
  add column if not exists label text;
```

---

### 4. Verificar Constraints da Tabela

**Problema identificado:**
- A tabela tem constraint: `unique (year, month, name)`
- Isso impede criar 2 períodos com mesmo ano, mês E nome

**Como verificar:**
- Supabase → Table Editor → `periods` → View Constraints
- Ou execute no SQL Editor:
```sql
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'public.periods'::regclass;
```

**Se houver períodos duplicados:**
- Verifique se já existe período com mesmo ano, mês e nome
- Se existir, o código vai atualizar ao invés de criar

---

### 5. Verificar Permissões RLS (Row Level Security)

**Onde verificar:**
- Supabase → Authentication → Policies
- Tabela: `periods`

**O que deve ter:**
- Se RLS estiver ativado, deve ter política permitindo Service Role
- **Solução:** Desativar RLS ou criar política para Service Role

**Como desativar (se necessário):**
```sql
ALTER TABLE public.periods DISABLE ROW LEVEL SECURITY;
```

**Ou criar política para Service Role:**
```sql
CREATE POLICY "Service Role pode tudo em periods"
ON public.periods
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

### 6. Verificar Logs da API no Vercel

**Onde verificar:**
- Vercel Dashboard → Deployments
- Clique no último deploy
- Aba "Functions" → Clique em uma função
- Ver logs em tempo real

**O que procurar:**
- ✅ `🚀 [periods/create] API CHAMADA - INÍCIO`
- ✅ `🚀 [periods/create] Body recebido:`
- ✅ `🚀 [periods/create] Dados extraídos:`
- ❌ `❌❌❌ [periods/create] ERRO CAPTURADO:`
- ❌ Erros de conexão com Supabase
- ❌ Erros de constraint violation
- ❌ Erros de permissão

---

### 7. Verificar Console do Navegador

**Como fazer:**
1. Abra o site no navegador
2. Pressione F12
3. Vá na aba "Console"
4. Tente criar um período
5. Procure por erros

**O que procurar:**
- ❌ Erros de rede (falha ao chamar API)
- ❌ Erros de CORS
- ❌ Erros de resposta da API
- ❌ Mensagens de erro do componente React

---

### 8. Verificar Resposta da API

**Como testar manualmente:**
1. Abra o DevTools (F12)
2. Vá na aba "Network"
3. Tente criar período
4. Procure por requisição `POST /api/periods/create`
5. Clique nela e veja:
   - **Request Payload:** Os dados enviados
   - **Response:** A resposta recebida
   - **Status Code:** Deve ser 200 ou 500

**O que deve aparecer na Response (sucesso):**
```json
{
  "ok": true,
  "period": {
    "id": "...",
    "year": 2024,
    "month": 1,
    "name": "Janeiro 2024",
    "is_active": true,
    ...
  },
  "message": "Período criado com sucesso"
}
```

**Se aparecer erro:**
- Copie a mensagem de erro completa
- Verifique o status code

---

### 9. Verificar se Período Está Sendo Criado no Banco

**Como verificar:**
- Supabase Dashboard → Table Editor → `periods`
- Veja se há períodos recentes
- Verifique se `is_active` está como `true`

**Se o período está no banco mas não aparece:**
- Problema é no frontend (lista não atualiza)
- Não é problema de criação

---

### 10. Verificar Erro de CORS ou Network

**Sintomas:**
- Erro no console: "CORS policy" ou "Network Error"
- Requisição não aparece no Network tab

**Causa:**
- API não está respondendo
- Erro antes de chegar na API

**Solução:**
- Verificar logs do Vercel
- Verificar se o deploy está funcionando

---

## 🔧 Soluções Rápidas

### Solução 1: Adicionar Coluna `label` (se não existir)

Execute no Supabase SQL Editor:
```sql
ALTER TABLE public.periods 
  ADD COLUMN IF NOT EXISTS label text;
```

---

### Solução 2: Desativar RLS Temporariamente (para teste)

Execute no Supabase SQL Editor:
```sql
ALTER TABLE public.periods DISABLE ROW LEVEL SECURITY;
```

---

### Solução 3: Verificar e Corrigir Constraint

Se quiser permitir múltiplos períodos com mesmo ano/mês mas nomes diferentes, remova a constraint:
```sql
ALTER TABLE public.periods 
  DROP CONSTRAINT IF EXISTS periods_year_month_name_key;
```

---

### Solução 4: Verificar Se Service Role Key Está Correta

**No Supabase:**
- Settings → API
- Copie a Service Role Key (não a anon key)

**No Vercel:**
- Verifique se a variável `SUPABASE_SERVICE_ROLE_KEY` está correta
- Deve começar com `sb_` ou `eyJ`

---

## 🧪 Teste Manual da API

Você pode testar a API diretamente usando curl ou Postman:

```bash
curl -X POST https://seu-site.vercel.app/api/periods/create \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2024,
    "month": 1,
    "name": "Janeiro 2024"
  }'
```

Substitua `https://seu-site.vercel.app` pela URL do seu site Vercel.

---

## 📋 Checklist Rápido

Use este checklist para diagnosticar rapidamente:

- [ ] Tabela `periods` existe no Supabase
- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] Coluna `label` existe na tabela (ou foi adicionada)
- [ ] RLS está desativado ou tem política para Service Role
- [ ] Service Role Key está correta no Vercel
- [ ] Não há períodos duplicados (mesmo year/month/name)
- [ ] Logs do Vercel não mostram erros
- [ ] Console do navegador não mostra erros
- [ ] Período aparece na tabela do banco após tentar criar
- [ ] API retorna resposta 200 com `ok: true`

---

## 🆘 Próximos Passos

1. **Faça todas as verificações acima**
2. **Copie os erros encontrados** (se houver)
3. **Verifique os logs do Vercel** no momento exato da tentativa
4. **Verifique a resposta da API** no Network tab

Com essas informações, poderemos identificar exatamente o que está impedindo a criação do período.




