# Guia para Rodar o Sistema Localmente

## Pré-requisitos

1. **Node.js** instalado (versão 18 ou superior)
2. **npm** ou **yarn** instalado
3. **Git** instalado (para clonar o repositório, se necessário)
4. Acesso às **variáveis de ambiente** do projeto (Supabase)

## ⚠️ IMPORTANTE: Antes de Começar

**LIMPE O CACHE DO NAVEGADOR ANTES DE RODAR LOCALMENTE!**

Isso é essencial para evitar problemas com dados antigos. Veja o arquivo `COMO_LIMPAR_CACHE.md` para instruções detalhadas.

**Resumo rápido:**
- Pressione `Ctrl + Shift + Delete` (Windows) ou `Cmd + Shift + Delete` (Mac)
- Selecione "Última hora" ou "Todo o período"
- Marque "Imagens e arquivos em cache" e "Cookies"
- Clique em "Limpar dados"

## Passos para Configuração

### 1. Obter o Código

Se você já tem o código na sua máquina, pule para o passo 2.

Se não tem:
- Peça ao responsável pelo projeto para compartilhar o código (via Git, pendrive, etc.)
- Ou clone o repositório se houver acesso

### 2. Instalar Dependências

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

Isso vai instalar todas as dependências necessárias (pode demorar alguns minutos).

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
```

**IMPORTANTE**: Peça essas informações ao responsável pelo projeto. Elas são sensíveis e não devem ser compartilhadas publicamente.

### 4. Rodar o Sistema

Execute o comando:

```bash
npm run dev
```

O sistema vai iniciar e você verá uma mensagem como:

```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000
```

### 5. Acessar o Sistema

Abra seu navegador e acesse:

```
http://localhost:3000
```

## Solução de Problemas

### Erro: "Cannot find module"
- Execute `npm install` novamente
- Verifique se está na pasta correta do projeto

### Erro: "Environment variables missing"
- Verifique se o arquivo `.env.local` existe
- Verifique se todas as variáveis estão preenchidas corretamente

### Erro de conexão com Supabase
- Verifique se as variáveis de ambiente estão corretas
- Verifique sua conexão com a internet
- Verifique se as credenciais do Supabase estão válidas

### Porta 3000 já está em uso
- Feche outros programas que possam estar usando a porta 3000
- Ou use outra porta: `npm run dev -- -p 3001`

## Diferenças entre Local e Produção

- **Local**: Os dados são os mesmos do Supabase (banco compartilhado)
- **Local**: Mudanças feitas localmente aparecem para todos (cuidado!)
- **Local**: Pode ser mais rápido para desenvolvimento
- **Produção**: Mais estável e com cache otimizado

## Dicas

1. **Sempre feche o terminal com Ctrl+C** antes de fechar a janela
2. **Não compartilhe o arquivo `.env.local`** - ele contém credenciais sensíveis
3. **Mantenha o código atualizado** - peça atualizações quando houver mudanças importantes
4. **Use o modo anônimo do navegador** para testar sem cache

## Atualizar o Código

Se houver atualizações no código:

1. Pare o servidor (Ctrl+C)
2. Execute `git pull` se estiver usando Git, ou peça o código atualizado
3. Execute `npm install` novamente (caso haja novas dependências)
4. Execute `npm run dev` novamente

