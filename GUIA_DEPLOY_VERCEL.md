# 🚀 Guia de Deploy no Vercel - Sistema de Estoque

Este guia vai te ajudar a colocar o sistema de controle de estoque no ar usando o Vercel.

---

## 📋 Pré-requisitos

Antes de começar, você precisa ter:

1. ✅ Conta no **Vercel** (gratuita): [vercel.com](https://vercel.com)
2. ✅ Conta no **Supabase** (gratuita): [supabase.com](https://supabase.com)
3. ✅ Repositório no **GitHub** (já temos!)
4. ✅ As credenciais do Supabase:
   - URL do projeto Supabase
   - Service Role Key (chave de serviço)

---

## 🔑 Passo 1: Obter Credenciais do Supabase

### 1.1. Acesse seu projeto no Supabase

1. Vá para [app.supabase.com](https://app.supabase.com)
2. Faça login e selecione seu projeto

### 1.2. Obter a URL do Projeto

1. No menu lateral, clique em **Settings** (Configurações)
2. Clique em **API**
3. Copie a **Project URL** (algo como: `https://xxxxx.supabase.co`)
   - Esta é a variável `NEXT_PUBLIC_SUPABASE_URL`

### 1.3. Obter a Service Role Key

1. Na mesma página de **API**
2. Role até a seção **Project API keys**
3. Copie a **service_role** key (⚠️ **CUIDADO**: Esta chave tem acesso total ao banco!)
   - Esta é a variável `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ **NUNCA** compartilhe esta chave publicamente!

---

## 🌐 Passo 2: Conectar Repositório ao Vercel

### 2.1. Criar Conta no Vercel (se ainda não tiver)

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **Sign Up**
3. Escolha **Continue with GitHub**
4. Autorize o Vercel a acessar seus repositórios

### 2.2. Importar Projeto

1. No dashboard do Vercel, clique em **Add New...** → **Project**
2. Você verá uma lista dos seus repositórios do GitHub
3. Encontre o repositório `estoque` (ou o nome que você deu)
4. Clique em **Import**

### 2.3. Configurar o Projeto

O Vercel vai detectar automaticamente que é um projeto Next.js. Você verá:

- **Framework Preset**: Next.js (já detectado)
- **Root Directory**: `./` (deixe como está)
- **Build Command**: `next build` (já preenchido)
- **Output Directory**: `.next` (já preenchido)

**Não precisa alterar nada aqui!** Clique em **Deploy** (mas **NÃO** clique ainda - vamos configurar as variáveis primeiro).

---

## 🔐 Passo 3: Configurar Variáveis de Ambiente

### 3.1. Adicionar Variáveis no Vercel

**ANTES de clicar em Deploy**, vamos configurar as variáveis de ambiente:

1. Na tela de configuração do projeto, role até a seção **Environment Variables**
2. Clique em **Add** para adicionar cada variável:

#### Variável 1: NEXT_PUBLIC_SUPABASE_URL
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: Cole a URL do Supabase que você copiou (ex: `https://xxxxx.supabase.co`)
- **Environment**: Selecione todas as opções:
  - ✅ Production
  - ✅ Preview
  - ✅ Development
- Clique em **Save**

#### Variável 2: SUPABASE_SERVICE_ROLE_KEY
- **Name**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: Cole a Service Role Key que você copiou
- **Environment**: Selecione todas as opções:
  - ✅ Production
  - ✅ Preview
  - ✅ Development
- Clique em **Save**

### 3.2. Verificar Variáveis

Você deve ver duas variáveis listadas:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

---

## 🚀 Passo 4: Fazer o Deploy

### 4.1. Iniciar Deploy

1. Agora sim, clique em **Deploy**
2. O Vercel vai:
   - Clonar seu repositório
   - Instalar dependências (`npm install`)
   - Fazer o build (`next build`)
   - Fazer o deploy

### 4.2. Aguardar Build

O processo leva cerca de 2-5 minutos. Você verá os logs em tempo real.

**O que está acontecendo:**
- 📦 Instalando dependências
- 🔨 Compilando TypeScript
- 🏗️ Fazendo build do Next.js
- 🚀 Fazendo deploy

### 4.3. Verificar se Deu Certo

Se tudo der certo, você verá:
- ✅ **Build Successful**
- Um link para acessar seu site (ex: `https://estoque.vercel.app`)

---

## ✅ Passo 5: Testar o Sistema

### 5.1. Acessar o Site

1. Clique no link fornecido pelo Vercel
2. Ou acesse pelo dashboard do Vercel → seu projeto → **Visit**

### 5.2. Testar Conexão com Supabase

1. Acesse: `https://seu-site.vercel.app/api/test-supabase`
2. Deve retornar: `{"ok": true, "message": "Conexão com Supabase funcionando!"}`

Se retornar erro, verifique:
- ✅ As variáveis de ambiente estão configuradas?
- ✅ As credenciais do Supabase estão corretas?
- ✅ O banco de dados Supabase está acessível?

### 5.3. Testar Funcionalidades

1. **Página inicial**: Deve carregar normalmente
2. **Upload de SPED**: Teste fazer upload de um arquivo SPED
3. **Aba Entradas**: Deve mostrar as entradas do SPED
4. **Aba Consolidação**: Deve calcular corretamente

---

## 🔄 Passo 6: Configurar Deploy Automático (Opcional mas Recomendado)

### 6.1. Deploy Automático já está Ativo!

Por padrão, o Vercel faz deploy automático sempre que você:
- Faz push para a branch `main`
- Cria um Pull Request

### 6.2. Verificar Configuração

1. No dashboard do Vercel → seu projeto → **Settings**
2. Vá em **Git**
3. Verifique que está conectado ao repositório correto
4. A branch padrão deve ser `main`

---

## 🛠️ Passo 7: Resolver Problemas Comuns

### Problema 1: Build Falha

**Erro**: `Error: Variáveis de ambiente do Supabase não configuradas`

**Solução**:
1. Vá em **Settings** → **Environment Variables**
2. Verifique se as duas variáveis estão configuradas
3. Certifique-se de que selecionou todos os ambientes (Production, Preview, Development)
4. Faça um novo deploy

### Problema 2: Erro de Conexão com Supabase

**Erro**: `Error ao criar cliente Supabase`

**Solução**:
1. Verifique se a URL do Supabase está correta (deve começar com `https://`)
2. Verifique se a Service Role Key está correta
3. Teste a conexão no Supabase (Settings → API → Test connection)

### Problema 3: Página em Branco

**Possíveis causas**:
1. Erro no build (verifique os logs)
2. Variáveis de ambiente não configuradas
3. Erro no código (verifique o console do navegador)

**Solução**:
1. Vá em **Deployments** → clique no último deploy → **View Function Logs**
2. Procure por erros
3. Verifique o console do navegador (F12)

### Problema 4: Erro 500 nas APIs

**Solução**:
1. Verifique os logs do Vercel (Deployments → View Function Logs)
2. Verifique se o banco de dados Supabase está acessível
3. Teste a rota `/api/test-supabase`

---

## 📊 Passo 8: Monitorar o Sistema

### 8.1. Logs do Vercel

1. No dashboard → seu projeto → **Deployments**
2. Clique em um deploy → **View Function Logs**
3. Veja logs em tempo real

### 8.2. Analytics (Opcional)

1. Vá em **Analytics** no dashboard
2. Veja estatísticas de uso (requer plano pago)

---

## 🔒 Passo 9: Segurança

### 9.1. Proteger Service Role Key

⚠️ **IMPORTANTE**: A `SUPABASE_SERVICE_ROLE_KEY` tem acesso total ao banco!

**Boas práticas**:
- ✅ Nunca compartilhe a chave publicamente
- ✅ Use apenas no Vercel (variáveis de ambiente)
- ✅ Não commite no GitHub (já está no `.gitignore`)
- ✅ Se suspeitar que foi exposta, gere uma nova no Supabase

### 9.2. Gerar Nova Service Role Key (se necessário)

1. No Supabase → Settings → API
2. Role até **Project API keys**
3. Clique em **Reset** na service_role key
4. Copie a nova chave
5. Atualize no Vercel (Settings → Environment Variables)

---

## 📝 Resumo das Variáveis de Ambiente

| Variável | Onde Obter | Onde Configurar |
|----------|------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Vercel → Settings → Environment Variables |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | Vercel → Settings → Environment Variables |

---

## 🎯 Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] Repositório conectado ao Vercel
- [ ] Variável `NEXT_PUBLIC_SUPABASE_URL` configurada
- [ ] Variável `SUPABASE_SERVICE_ROLE_KEY` configurada
- [ ] Build bem-sucedido
- [ ] Site acessível
- [ ] Rota `/api/test-supabase` funcionando
- [ ] Upload de SPED funcionando
- [ ] Cálculos de estoque corretos

---

## 🆘 Precisa de Ajuda?

### Recursos Úteis

- **Documentação Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Documentação Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Logs do Vercel**: Dashboard → Deployments → View Function Logs

### Comandos Úteis (Local)

Se quiser testar localmente antes de fazer deploy:

```bash
# Criar arquivo .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co" > .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui" >> .env.local

# Instalar dependências
npm install

# Rodar localmente
npm run dev

# Testar build
npm run build
```

---

## 🎉 Pronto!

Seu sistema está no ar! 🚀

Toda vez que você fizer `git push` para a branch `main`, o Vercel vai fazer deploy automático.

**URL do seu site**: Você pode ver no dashboard do Vercel, ou configurar um domínio personalizado em **Settings** → **Domains**.



