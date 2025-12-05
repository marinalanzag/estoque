# ⚡ Teste Rápido - Refatoração de Períodos

## 🚀 Passos Rápidos (5 minutos)

### 1. Verificar Build
```bash
npm run build
```
✅ Deve compilar sem erros

### 2. Iniciar Servidor
```bash
npm run dev
```
✅ Servidor deve iniciar sem erros

### 3. Testar Funcionalidades Básicas

#### 3.1 Carregar Página
- Acesse `http://localhost:3000`
- ✅ Períodos devem aparecer no dropdown
- ✅ Período ativo deve ser exibido

#### 3.2 Criar Período
- Clique em "+ Novo Período"
- Preencha ano e mês
- Clique em "Criar Período"
- ✅ Novo período deve aparecer no dropdown
- ✅ Deve ser ativado automaticamente

#### 3.3 Trocar Período
- Selecione outro período no dropdown
- ✅ Período deve ser ativado
- ✅ UI deve atualizar

### 4. Verificar Network (DevTools)
- Abra DevTools (F12) → Network
- Recarregue a página
- ❌ **NÃO deve haver** requisições para `/api/periods/list` ou `/api/periods/active`
- ✅ Dados devem vir no HTML inicial

### 5. Testar em Produção (Vercel)
- Faça deploy para Vercel
- Teste criar período
- ✅ Deve funcionar igual ao local
- ✅ Aba normal e anônima devem funcionar igual

---

## 🔍 O Que Observar

### ✅ Sinais de Sucesso
- Períodos aparecem corretamente
- Criar período funciona e aparece imediatamente
- Sem requisições desnecessárias para `/api/periods/*`
- Funciona igual em dev e produção
- Aba normal e anônima funcionam igual

### ❌ Sinais de Problema
- Períodos não aparecem
- Erros no console
- Requisições para `/api/periods/*` ainda aparecem
- Dados antigos em produção
- Diferença entre aba normal e anônima

---

## 📋 Checklist Mínimo

- [ ] Build compila
- [ ] Períodos aparecem
- [ ] Criar período funciona
- [ ] Trocar período funciona
- [ ] Sem requisições para `/api/periods/*`
- [ ] Funciona em produção
- [ ] Aba normal e anônima funcionam igual

---

## 🆘 Se Algo Não Funcionar

1. Verifique console do navegador (F12)
2. Verifique console do servidor
3. Verifique Network tab
4. Consulte `GUIA_TESTES_REFATORACAO.md` para mais detalhes

