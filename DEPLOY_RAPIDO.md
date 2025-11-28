# 🚀 Deploy Rápido

Script criado para facilitar o processo de commit e push para o GitHub (que aciona o deploy automático no Vercel).

## 📋 Como Usar

### Opção 1: Script Bash (Recomendado)

```bash
# Com mensagem personalizada
./deploy.sh "Correção no cálculo de estoque"

# Sem mensagem (usa data/hora automática)
./deploy.sh
```

### Opção 2: Comandos Manuais

```bash
# 1. Adicionar alterações
git add -A

# 2. Fazer commit
git commit -m "Sua mensagem aqui"

# 3. Fazer push
git push origin main
```

## ⚡ O que o script faz

1. ✅ Verifica se há alterações
2. ✅ Adiciona todas as alterações (`git add -A`)
3. ✅ Faz commit com sua mensagem (ou data/hora automática)
4. ✅ Faz push para o GitHub
5. ✅ O Vercel detecta automaticamente e inicia o deploy

## 📊 Acompanhar o Deploy

Após o push, acesse:
- **Dashboard Vercel**: https://vercel.com
- O deploy será iniciado automaticamente em alguns segundos
- Leva cerca de 2-5 minutos para completar

## 💡 Dicas

- Use mensagens descritivas nos commits
- O script verifica se há alterações antes de tentar fazer commit
- Se houver erro, o script para e mostra a mensagem de erro

