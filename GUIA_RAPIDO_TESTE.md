# 🚀 Guia Rápido: Onde e Como Testar

## 📍 Onde Testar?

### Opção 1: Servidor Local (Mais Rápido) ⚡

**URL:** `http://localhost:3000`

**Vantagens:**
- ✅ Teste imediato (sem esperar deploy)
- ✅ Mudanças já estão no código
- ✅ Mais fácil para debug

**Como:**
1. Certifique-se que está rodando: `npm run dev`
2. Acesse: `http://localhost:3000`
3. Faça hard refresh: `Cmd+Shift+R` (Mac) ou `Ctrl+Shift+F5` (Windows)

---

### Opção 2: Vercel (Produção) 🌐

**URL:** Sua URL do Vercel (ex: `https://seu-app.vercel.app`)

**Vantagens:**
- ✅ Ambiente de produção real
- ✅ Testa como usuários vão usar

**Como:**
1. Verifique se o deploy foi feito (Vercel faz automaticamente após commit)
2. Acesse a URL do Vercel
3. Faça hard refresh: `Cmd+Shift+R` (Mac) ou `Ctrl+Shift+F5` (Windows)

---

## 🎯 Recomendação

**Teste no servidor local PRIMEIRO** (mais rápido e fácil):
1. Se funcionar localmente → ✅ OK
2. Depois teste no Vercel para confirmar em produção

**Ambos vão funcionar!** O importante é fazer o **hard refresh** para limpar cache.

---

## ✅ O que Verificar Após Hard Refresh:

- [ ] Períodos aparecem corretamente (5 períodos)
- [ ] Janeiro 2025 aparece como ativo
- [ ] Não há períodos "fantasma"
- [ ] Dropdown mostra todos os períodos

---

**🚀 Teste no localhost primeiro que é mais rápido!**

