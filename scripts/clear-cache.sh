#!/bin/bash

echo "🧹 Limpando cache do Next.js..."

# Parar o servidor de desenvolvimento se estiver rodando
echo "⏹️  Parando servidor de desenvolvimento..."
pkill -f "next dev" || true

# Remover diretórios de cache
echo "🗑️  Removendo .next..."
rm -rf .next

echo "🗑️  Removendo node_modules/.cache..."
rm -rf node_modules/.cache

echo "✅ Cache limpo com sucesso!"
echo ""
echo "Para iniciar o servidor novamente, execute:"
echo "  npm run dev"
