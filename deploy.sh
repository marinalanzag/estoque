#!/bin/bash

# Script para fazer deploy automático (commit + push)
# Uso: ./deploy.sh "mensagem do commit"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Iniciando deploy...${NC}\n"

# Verificar se há mensagem de commit
if [ -z "$1" ]; then
    echo -e "${YELLOW}📝 Nenhuma mensagem fornecida. Usando mensagem padrão.${NC}"
    MESSAGE="Atualização automática: $(date '+%Y-%m-%d %H:%M:%S')"
else
    MESSAGE="$1"
fi

# Verificar status do git
echo -e "${YELLOW}📊 Verificando status do repositório...${NC}"
git status --short

# Verificar se há alterações
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Nenhuma alteração para commitar.${NC}"
    exit 0
fi

# Adicionar todas as alterações
echo -e "\n${YELLOW}➕ Adicionando alterações...${NC}"
git add -A

# Fazer commit
echo -e "${YELLOW}💾 Fazendo commit...${NC}"
git commit -m "$MESSAGE"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao fazer commit!${NC}"
    exit 1
fi

# Fazer push
echo -e "${YELLOW}📤 Enviando para o GitHub...${NC}"
git push origin main

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Deploy concluído com sucesso!${NC}"
    echo -e "${GREEN}🔄 O Vercel iniciará o deploy automaticamente em alguns segundos.${NC}"
    echo -e "${YELLOW}📊 Acompanhe o progresso em: https://vercel.com${NC}"
else
    echo -e "\n${RED}❌ Erro ao fazer push!${NC}"
    exit 1
fi

