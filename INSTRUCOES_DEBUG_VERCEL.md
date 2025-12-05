# 🔍 Instruções: Debug do Problema no Vercel

## ❌ Problema

**Vercel:** Mostra "Nenhum período ativo" e 4 períodos  
**Local:** Funciona perfeitamente com 5 períodos e Janeiro 2025 ativo

## 🔧 Passos para Diagnosticar

### 1. Acessar Endpoint de Debug no Vercel

Acesse no navegador (substitua pela URL do seu Vercel):

```
https://seu-app.vercel.app/api/periods/debug-vercel
```

Este endpoint vai mostrar:
- ✅ Se as variáveis de ambiente estão configuradas
- ✅ Se a conexão com Supabase está funcionando
- ✅ Quantos períodos estão no banco
- ✅ Quantos períodos ativos existem
- ✅ Informações de ambiente (produção, Vercel, etc.)

### 2. Comparar com o Debug Local

Acesse localmente:
```
http://localhost:3000/api/periods/debug
```

Compare os resultados:
- URL do Supabase é a mesma?
- Quantos períodos cada um mostra?
- Há erros em algum dos dois?

### 3. Verificar Variáveis de Ambiente no Vercel

1. Acesse o dashboard do Vercel
2. Vá em **Settings** → **Environment Variables**
3. Verifique se estão configuradas:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Compare os valores com o `.env.local` local

### 4. Verificar Logs do Vercel

1. No dashboard do Vercel, vá em **Deployments**
2. Clique no último deployment
3. Vá na aba **Functions** ou **Logs**
4. Procure por erros relacionados a Supabase

## 📋 O que Verificar

### Se o debug-vercel mostrar erro:

**Erro de conexão:**
- ❌ Variáveis de ambiente não configuradas no Vercel
- ❌ URL ou chave do Supabase incorretas
- ✅ Solução: Configurar corretamente no Vercel

**Erro ao buscar dados:**
- ❌ Supabase pode estar rejeitando conexão
- ❌ Chave de serviço pode estar incorreta
- ✅ Solução: Verificar credenciais

### Se o debug-vercel mostrar dados diferentes:

**Menos períodos no Vercel:**
- ❌ Vercel pode estar conectando em banco diferente
- ❌ Cache pode estar interferindo
- ✅ Solução: Verificar URL do Supabase

**Nenhum período ativo:**
- ❌ Período pode não estar marcado como ativo no banco
- ❌ Query pode estar falhando
- ✅ Solução: Verificar diretamente no Supabase

## 🚨 Ação Imediata

**Acesse AGORA:**
```
https://seu-app.vercel.app/api/periods/debug-vercel
```

**E me envie o resultado!** Assim vou saber exatamente qual é o problema.

