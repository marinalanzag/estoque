# 🔐 Guia Completo: Configurar Variáveis de Ambiente no Vercel

Este guia mostra passo a passo onde encontrar as credenciais do Supabase e como configurá-las no Vercel.

---

## 📋 Passo 1: Acessar o Supabase Dashboard

1. Acesse: **https://app.supabase.com**
2. Faça login na sua conta
3. Selecione o projeto do seu sistema de estoque

---

## 📍 Passo 2: Encontrar a URL do Projeto (Project URL)

1. No menu lateral esquerdo, clique em **"Settings"** (Configurações)
   - Ícone de engrenagem ⚙️

2. No submenu que aparece, clique em **"API"**

3. Na seção **"Project URL"**, você verá algo como:
   ```
   https://zpsxcdttmtfeosmmkeyn.supabase.co
   ```
   - ✅ **Esta é a variável `NEXT_PUBLIC_SUPABASE_URL`**
   - Copie essa URL completa (incluindo o `https://`)

---

## 🔑 Passo 3: Encontrar a Service Role Key

1. Ainda na mesma página de **Settings → API**

2. Role a página para baixo até encontrar a seção **"Project API keys"**

3. Você verá várias chaves. Procure por:
   - **`anon` `public`** - Esta NÃO é a que você precisa (é pública)
   - **`service_role` `secret`** - ✅ **Esta é a que você precisa!**

4. Ao lado de `service_role`, você verá:
   - Um botão de **"Reveal"** (Revelar) ou a chave já visível
   - A chave começará com `sb_` ou `eyJ...`
   - Exemplo: `sb_secret_-dZemg0VKXfOEUDc_ZS6Cw_swIxUJG2`

5. ⚠️ **IMPORTANTE**: Clique em **"Reveal"** se necessário para ver a chave completa
6. ✅ **Copie a chave completa** (ela é longa!)

---

## 🌐 Passo 4: Configurar no Vercel

1. Acesse: **https://vercel.com**
2. Faça login na sua conta
3. Selecione seu projeto (o sistema de estoque)

4. No menu superior, clique em **"Settings"**

5. No menu lateral esquerdo, clique em **"Environment Variables"**

---

## ➕ Passo 5: Adicionar a Primeira Variável

1. Clique no botão **"+ Add New"** ou **"+ Adicionar outro"**

2. Preencha:
   - **Key** (Chave): `NEXT_PUBLIC_SUPABASE_URL`
     - ⚠️ **ATENÇÃO**: Escreva exatamente assim, com letras maiúsculas e underscore
   - **Value** (Valor): Cole a URL que você copiou do Supabase
     - Exemplo: `https://zpsxcdttmtfeosmmkeyn.supabase.co`

3. Na seção **"Environments"** (Ambientes):
   - ✅ Marque **Production**
   - ✅ Marque **Preview**
   - ✅ Marque **Development**

4. Clique em **"Save"** ou **"Salvar"**

---

## ➕ Passo 6: Adicionar a Segunda Variável

1. Clique no botão **"+ Add New"** ou **"+ Adicionar outro"** novamente

2. Preencha:
   - **Key** (Chave): `SUPABASE_SERVICE_ROLE_KEY`
     - ⚠️ **ATENÇÃO**: Escreva exatamente assim, com letras maiúsculas e underscore
   - **Value** (Valor): Cole a Service Role Key que você copiou do Supabase
     - Exemplo: `sb_secret_-dZemg0VKXfOEUDc_ZS6Cw_swIxUJG2`

3. Na seção **"Environments"** (Ambientes):
   - ✅ Marque **Production**
   - ✅ Marque **Preview**
   - ✅ Marque **Development**

4. Clique em **"Save"** ou **"Salvar"**

---

## ✅ Passo 7: Verificar se Está Correto

Você deve ver no Vercel **2 variáveis** listadas:

1. ✅ `NEXT_PUBLIC_SUPABASE_URL` = `https://zpsxcdttmtfeosmmkeyn.supabase.co`
2. ✅ `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_...` (sua chave)

---

## 🚀 Passo 8: Fazer Deploy

Após adicionar as variáveis:

1. **Opção 1 - Deploy Automático:**
   - Se você já tem deploy automático configurado, o Vercel detectará as mudanças
   - Ou faça um novo commit e push para forçar deploy

2. **Opção 2 - Deploy Manual:**
   - Vá em **"Deployments"** no menu
   - Clique nos **3 pontinhos** do último deploy
   - Selecione **"Redeploy"**
   - ⚠️ **Importante**: Marque a opção **"Use existing Build Cache"** como **desmarcada**

---

## 🔍 Passo 9: Verificar se Funcionou

1. Após o deploy, acesse seu site no Vercel
2. Abra o Console do navegador (F12)
3. Verifique se há erros de conexão com Supabase
4. Tente criar ou selecionar um período
5. Se funcionar, está tudo certo! ✅

---

## ⚠️ Problemas Comuns

### Problema 1: Variáveis não aparecem
**Solução:** Verifique se você salvou as variáveis (botão "Salvar" clicado)

### Problema 2: Site ainda não conecta ao Supabase
**Solução:** 
- Verifique se o nome das variáveis está EXATAMENTE correto (maiúsculas, underscore)
- Faça um novo deploy após adicionar as variáveis
- Aguarde alguns minutos para o deploy completar

### Problema 3: Service Role Key não encontrada
**Solução:**
- Verifique se você está na seção "Project API keys"
- Procure pela chave que diz "service_role" e "secret"
- Não use a chave "anon" ou "public"

### Problema 4: Erro ao salvar variáveis
**Solução:**
- Verifique se você tem permissão de administrador no projeto Vercel
- Tente adicionar uma variável por vez
- Recarregue a página e tente novamente

---

## 📸 Onde Encontrar no Supabase (Resumo Visual)

```
Supabase Dashboard
├── Settings (⚙️)
    └── API
        ├── Project URL ← Use para NEXT_PUBLIC_SUPABASE_URL
        └── Project API keys
            └── service_role (secret) ← Use para SUPABASE_SERVICE_ROLE_KEY
```

---

## 📝 Checklist Final

Antes de considerar configurado, verifique:

- [ ] Acessei o Supabase Dashboard
- [ ] Encontrei a Project URL (começa com https://)
- [ ] Encontrei a Service Role Key (começa com sb_ ou eyJ)
- [ ] Adicionei variável `NEXT_PUBLIC_SUPABASE_URL` no Vercel
- [ ] Adicionei variável `SUPABASE_SERVICE_ROLE_KEY` no Vercel
- [ ] Selecionei todos os ambientes (Production, Preview, Development)
- [ ] Salvei as variáveis
- [ ] Fiz um novo deploy ou aguardei o deploy automático
- [ ] Testei o site e funcionou

---

## 🆘 Precisa de Ajuda?

Se tiver problemas:

1. **Verifique os logs do Vercel:**
   - Vercel Dashboard → Seu Projeto → Deployments
   - Clique no último deploy → "View Function Logs"
   - Procure por erros relacionados ao Supabase

2. **Teste a conexão:**
   - Acesse: `https://seu-site.vercel.app/api/test-supabase`
   - Deve retornar: `{"ok": true, "message": "Conexão com Supabase funcionando!"}`

3. **Verifique o console do navegador:**
   - Pressione F12
   - Vá na aba "Console"
   - Procure por erros

---

## 🎉 Pronto!

Com as variáveis configuradas corretamente, seu sistema deve funcionar perfeitamente no Vercel!

