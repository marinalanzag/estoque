# 📋 Instruções Simples: Diagnosticar Vercel

## 🎯 Objetivo

Descobrir por que o Vercel mostra 4 períodos e "Nenhum período ativo" enquanto o local mostra 5 e Janeiro 2025 ativo.

## 🔍 Passo 1: Acessar Debug no Vercel

Abra no navegador (substitua pela URL do seu Vercel):

```
https://seu-app.vercel.app/api/periods/debug
```

## 📊 Passo 2: Comparar com Local

Abra localmente:

```
http://localhost:3000/api/periods/debug
```

## 🔍 Passo 3: Verificar Diferenças

Compare os dois resultados:

### Vercel:
- Quantos períodos mostra? (deve mostrar 5)
- Quantos períodos ativos? (deve mostrar 1)
- Qual a URL do Supabase?

### Local:
- Quantos períodos mostra? (mostra 5)
- Quantos períodos ativos? (mostra 1)
- Qual a URL do Supabase?

## ⚠️ Possíveis Problemas

### 1. URL do Supabase DIFERENTE
**Problema:** Vercel conectando em banco diferente  
**Solução:** Verificar variáveis de ambiente no Vercel

### 2. Menos períodos no Vercel
**Problema:** Banco diferente ou cache  
**Solução:** Verificar qual banco o Vercel está usando

### 3. Nenhum período ativo no Vercel
**Problema:** Período não está ativo no banco que Vercel usa  
**Solução:** Verificar diretamente no Supabase

## ✅ Ação Imediata

**Acesse AGORA:**
```
https://seu-app.vercel.app/api/periods/debug
```

**E me envie o resultado completo!** Assim vou saber exatamente qual é o problema.

