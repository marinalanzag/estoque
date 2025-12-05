# 🔍 Instruções: Usar Endpoint de Diagnóstico Profundo

## 🎯 Objetivo

Verificar **EXATAMENTE** qual URL do Supabase está sendo usada no Vercel vs Local.

## 📍 Endpoint Criado

### `/api/periods/check-connection`

Este endpoint mostra:
- ✅ URL **COMPLETA** do Supabase (sem truncar)
- ✅ Preview da Service Key (para comparar)
- ✅ Status da conexão
- ✅ Amostra dos períodos que está vendo
- ✅ Informações de ambiente

## 📋 Passo a Passo

### 1. Aguardar Deploy

Aguarde alguns minutos para o Vercel fazer deploy do novo endpoint.

### 2. Acessar no Vercel

```
https://seu-app.vercel.app/api/periods/check-connection
```

### 3. Acessar Localmente

```
http://localhost:3000/api/periods/check-connection
```

### 4. Comparar Resultados

Compare especialmente:
- **`supabase.url`** - URL completa (devem ser EXATAMENTE iguais)
- **`supabase.serviceKeyPreview`** - Preview da chave (devem ser iguais)
- **`periods.total`** - Quantos períodos cada um vê
- **`periods.activePeriod`** - Qual período está ativo

## 🔍 O que Procurar

### Se as URLs forem DIFERENTES:
- ❌ Vercel está usando banco diferente
- ✅ Copiar URL do local e atualizar no Vercel

### Se as URLs forem IGUAIS:
- ⚠️ Pode haver outro problema
- ✅ Verificar se há cache
- ✅ Verificar logs do Vercel

---

**Aguardar deploy e acessar o endpoint `/api/periods/check-connection` no Vercel e local!**

