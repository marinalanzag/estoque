# ⚡ Deploy Rápido no Railway

Guia passo a passo simplificado para fazer deploy no Railway em 5 minutos.

---

## 🎯 Passo 1: Criar Conta no Railway

1. Acesse: **https://railway.app**
2. Clique em **"Start a New Project"**
3. Escolha **"Login with GitHub"**
4. Autorize o Railway a acessar seus repositórios

---

## 📦 Passo 2: Conectar Repositório

1. Na tela inicial, clique em **"Deploy from GitHub repo"**
2. Se necessário, autorize acesso aos repositórios
3. Procure e selecione: **`marinalanzag/estoque`**
4. Railway detectará automaticamente que é Next.js e configurará tudo

---

## ⚙️ Passo 3: Configurar Variáveis de Ambiente

**IMPORTANTE**: Você precisa das credenciais do Supabase!

### Obter Credenciais do Supabase:

1. Acesse: **https://app.supabase.com**
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **service_role key** (a chave secreta, não a anon key!)

### Adicionar no Railway:

1. No dashboard do Railway, clique no seu projeto
2. Vá na aba **"Variables"**
3. Clique em **"+ New Variable"**
4. Adicione as duas variáveis:

**Variável 1:**
```
Key: NEXT_PUBLIC_SUPABASE_URL
Value: https://seu-projeto.supabase.co
```

**Variável 2:**
```
Key: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (sua chave completa)
```

---

## 🚀 Passo 4: Aguardar Deploy

1. Railway iniciará o deploy automaticamente
2. Você verá os logs em tempo real
3. Leva cerca de 2-3 minutos
4. Quando terminar, você verá um link tipo:
   - `https://seu-projeto-production.up.railway.app`

---

## ✅ Passo 5: Testar

1. Clique no link fornecido
2. Teste criar um período novo
3. Verifique se aparece no dropdown

---

## 🔧 Configuração Avançada (Opcional)

### Personalizar Domínio:

1. No Railway, vá em **Settings**
2. Clique em **"Domains"**
3. Adicione seu domínio personalizado (se tiver)

### Configurar Branch:

1. Por padrão, Railway faz deploy da branch `main`
2. Se quiser mudar, vá em **Settings** → **Source**

---

## 🐛 Resolver Problemas

### Build Falha:
- Verifique os logs no Railway
- Confirme que as variáveis de ambiente estão corretas
- Teste localmente: `npm run build`

### Erro de Conexão:
- Verifique se as credenciais do Supabase estão corretas
- Confirme que não há espaços extras nas variáveis
- Teste a URL do Supabase no navegador

### Página em Branco:
- Abra o console do navegador (F12)
- Verifique os logs do Railway
- Confirme que o deploy foi bem-sucedido

---

## 💡 Dicas

- ✅ Railway faz deploy automático toda vez que você faz push no GitHub
- ✅ Você pode ver logs em tempo real no dashboard
- ✅ O plano gratuito é muito generoso para começar
- ✅ Você pode pausar o projeto quando não estiver usando

---

## 🎉 Pronto!

Seu sistema está no ar! 

Toda vez que você fizer `git push`, o Railway fará deploy automático.

**URL do seu site**: Veja no dashboard do Railway → seu projeto → Settings → Domains

---

## 📞 Precisa de Ajuda?

- **Documentação Railway**: https://docs.railway.app
- **Logs do Projeto**: Dashboard → seu projeto → Deployments → View Logs
- **Status do Serviço**: https://status.railway.app

