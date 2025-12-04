# 🚀 Guia de Deploy - Alternativas ao Vercel

Este guia oferece várias opções para fazer deploy do seu sistema de estoque, caso tenha problemas com o Vercel.

---

## 📋 Opções de Deploy

### 1. 🟢 **Railway** (Recomendado - Mais Fácil)

Railway é uma plataforma muito simples e fácil de usar, similar ao Vercel mas mais flexível.

#### Vantagens:
- ✅ Interface muito simples
- ✅ Deploy automático do GitHub
- ✅ Configuração de variáveis de ambiente fácil
- ✅ Plano gratuito generoso
- ✅ Suporta Next.js perfeitamente

#### Como Fazer Deploy:

1. **Criar Conta:**
   - Acesse: https://railway.app
   - Clique em "Start a New Project"
   - Faça login com GitHub

2. **Conectar Repositório:**
   - Clique em "Deploy from GitHub repo"
   - Selecione o repositório `marinalanzag/estoque`
   - Railway detectará automaticamente que é Next.js

3. **Configurar Variáveis de Ambiente:**
   - No dashboard do projeto, clique em "Variables"
   - Adicione as variáveis:
     - `NEXT_PUBLIC_SUPABASE_URL` = sua URL do Supabase
     - `SUPABASE_SERVICE_ROLE_KEY` = sua Service Role Key

4. **Deploy Automático:**
   - Railway fará deploy automaticamente
   - Em 2-3 minutos estará no ar
   - Você receberá um link tipo: `https://seu-projeto.railway.app`

---

### 2. 🔵 **Render** (Muito Popular)

Render é similar ao Heroku mas mais moderno e fácil.

#### Vantagens:
- ✅ Interface intuitiva
- ✅ Deploy automático do GitHub
- ✅ Plano gratuito disponível
- ✅ Suporta Next.js nativamente

#### Como Fazer Deploy:

1. **Criar Conta:**
   - Acesse: https://render.com
   - Clique em "Get Started"
   - Faça login com GitHub

2. **Criar Web Service:**
   - Clique em "New +" → "Web Service"
   - Conecte seu repositório `marinalanzag/estoque`

3. **Configurar:**
   - **Name**: dê um nome ao seu projeto
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Variáveis de Ambiente:**
   - Na seção "Environment Variables", adicione:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`

5. **Deploy:**
   - Clique em "Create Web Service"
   - Aguarde o deploy (5-7 minutos na primeira vez)

---

### 3. 🟣 **Netlify** (Bom para Frontend)

Netlify é excelente para aplicações Next.js.

#### Vantagens:
- ✅ Muito fácil de usar
- ✅ Deploy automático
- ✅ CDN global
- ✅ Plano gratuito generoso

#### Como Fazer Deploy:

1. **Criar Conta:**
   - Acesse: https://app.netlify.com
   - Clique em "Sign up" e faça login com GitHub

2. **Importar Projeto:**
   - Clique em "Add new site" → "Import an existing project"
   - Selecione seu repositório

3. **Configurar Build:**
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`

4. **Variáveis de Ambiente:**
   - Vá em "Site settings" → "Environment variables"
   - Adicione:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`

5. **Deploy:**
   - Clique em "Deploy site"
   - Aguarde alguns minutos

**⚠️ Nota**: Netlify requer configuração especial para Next.js Server Functions. Você pode precisar usar o plugin `@netlify/plugin-nextjs`.

---

### 4. 🔴 **Fly.io** (Mais Controle)

Fly.io oferece mais controle e flexibilidade.

#### Vantagens:
- ✅ Controle total sobre a infraestrutura
- ✅ Deploy via CLI
- ✅ Boa performance
- ✅ Plano gratuito disponível

#### Como Fazer Deploy:

1. **Instalar CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Criar Conta:**
   ```bash
   fly auth signup
   ```

3. **Criar Arquivo `fly.toml`:**
   - Veja exemplo abaixo

4. **Fazer Deploy:**
   ```bash
   fly deploy
   ```

---

### 5. 🟠 **DigitalOcean App Platform** (Pago mas Barato)

DigitalOcean oferece uma plataforma similar ao Heroku.

#### Vantagens:
- ✅ Muito estável
- ✅ Bom suporte
- ✅ Preço justo (a partir de $5/mês)
- ✅ Interface simples

---

## 🎯 Recomendação

**Para sua situação, recomendo o Railway** porque:
- É muito fácil de configurar
- Funciona bem com Next.js
- Tem deploy automático do GitHub
- Plano gratuito generoso
- Interface simples e intuitiva

---

## 📝 Preparação do Projeto

Independente da plataforma escolhida, você precisa:

### 1. Variáveis de Ambiente

Todas as plataformas precisam dessas duas variáveis:

- `NEXT_PUBLIC_SUPABASE_URL` - URL do seu projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key do Supabase

### 2. Scripts no package.json

Seu `package.json` já tem os scripts corretos:
- ✅ `npm run build` - para fazer o build
- ✅ `npm start` - para iniciar em produção

### 3. Arquivo .gitignore

Já está configurado para não enviar arquivos sensíveis.

---

## 🚀 Deploy Rápido no Railway (Passo a Passo)

### Passo 1: Criar Conta
1. Acesse: https://railway.app
2. Clique em "Start a New Project"
3. Faça login com GitHub

### Passo 2: Conectar Repositório
1. Clique em "Deploy from GitHub repo"
2. Autorize o Railway a acessar seus repositórios
3. Selecione `marinalanzag/estoque`
4. Railway detectará automaticamente que é Next.js

### Passo 3: Configurar Variáveis
1. No dashboard do projeto, clique em "Variables" ou "Settings"
2. Clique em "New Variable"
3. Adicione:

**Variável 1:**
- Key: `NEXT_PUBLIC_SUPABASE_URL`
- Value: sua URL do Supabase
- Clique em "Add"

**Variável 2:**
- Key: `SUPABASE_SERVICE_ROLE_KEY`
- Value: sua Service Role Key
- Clique em "Add"

### Passo 4: Aguardar Deploy
1. Railway iniciará o deploy automaticamente
2. Você verá os logs em tempo real
3. Quando terminar, verá um link tipo: `https://seu-projeto.up.railway.app`

### Passo 5: Testar
1. Acesse o link fornecido
2. Teste a funcionalidade de períodos
3. Verifique se tudo está funcionando

---

## 🔧 Resolver Problemas Comuns

### Problema: Build Falha

**Solução:**
- Verifique os logs do build na plataforma
- Certifique-se de que as variáveis de ambiente estão configuradas
- Teste fazer build localmente: `npm run build`

### Problema: Erro de Conexão com Supabase

**Solução:**
- Verifique se as variáveis de ambiente estão corretas
- Confirme que não há espaços extras nas variáveis
- Teste a conexão no Supabase Dashboard

### Problema: Página em Branco

**Solução:**
- Verifique os logs da aplicação na plataforma
- Abra o console do navegador (F12) para ver erros
- Confirme que o build foi bem-sucedido

---

## 📊 Comparação Rápida

| Plataforma | Dificuldade | Plano Grátis | Deploy Automático | Recomendado |
|------------|-------------|--------------|-------------------|-------------|
| **Railway** | ⭐ Fácil | ✅ Sim | ✅ Sim | 🟢 **SIM** |
| **Render** | ⭐⭐ Médio | ✅ Sim | ✅ Sim | 🟡 Sim |
| **Netlify** | ⭐ Fácil | ✅ Sim | ✅ Sim | 🟡 Sim* |
| **Fly.io** | ⭐⭐⭐ Difícil | ✅ Sim | ✅ Sim | 🔴 Não |
| **Vercel** | ⭐ Fácil | ✅ Sim | ✅ Sim | 🟡 Se funcionar |

*Netlify pode precisar de configuração extra para Next.js

---

## 🆘 Precisa de Ajuda?

Se tiver problemas com qualquer plataforma:

1. **Verifique os logs** - sempre têm informações úteis
2. **Teste localmente** - se funciona local, funciona no deploy
3. **Verifique variáveis de ambiente** - 90% dos problemas são isso
4. **Consulte a documentação** da plataforma escolhida

---

## 🎉 Pronto!

Escolha a plataforma que prefere e siga os passos. O Railway é o mais recomendado por ser o mais simples e confiável para Next.js!




