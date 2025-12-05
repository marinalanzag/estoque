# 🔍 Instruções: Teste em Modo Anônimo

## 📍 URLs para Testar

### Se estiver rodando localmente (desenvolvimento):

**URL Principal:**
```
http://localhost:3000
```

**Páginas específicas para testar:**

1. **Página principal (onde tem o seletor de períodos):**
   ```
   http://localhost:3000
   ```

2. **Página de configuração de períodos:**
   ```
   http://localhost:3000/periodos/configuracao
   ```

### Se estiver em produção (deploy Vercel/etc):

Use a URL do seu deploy (provavelmente algo como):
```
https://seu-app.vercel.app
```

---

## 🚀 Passo a Passo para Testar

### 1. Certifique-se que o servidor está rodando

**Se estiver testando localmente:**
```bash
npm run dev
```

Você deve ver algo como:
```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
```

### 2. Abrir janela anônima/privada

**Chrome/Edge:**
- Windows: `Ctrl + Shift + N`
- Mac: `Cmd + Shift + N`

**Firefox:**
- Windows: `Ctrl + Shift + P`
- Mac: `Cmd + Shift + P`

**Safari:**
- Mac: `Cmd + Shift + N`

### 3. Acessar a URL

Na janela anônima, digite na barra de endereços:

```
http://localhost:3000
```

Ou se estiver em produção, use sua URL de produção.

### 4. Verificar o seletor de períodos

Na página inicial, procure por:
- Um dropdown/seletor de períodos (geralmente no topo da página)
- Deve mostrar **5 períodos**
- Deve mostrar **Janeiro 2025** como ativo

### 5. Verificar página de configuração

Acesse:
```
http://localhost:3000/periodos/configuracao
```

Deve mostrar:
- Período ativo: **Janeiro 2025**
- Configurações do período

---

## ✅ O que verificar

### Se funcionar em modo anônimo:
- ✅ Confirma que é **cache do navegador**
- ✅ As APIs estão funcionando corretamente
- ✅ Solução: limpar cache do navegador normal

### Se NÃO funcionar em modo anônimo:
- ❌ Pode ser problema no código
- ❌ Pode ser problema no servidor
- ❌ Precisa investigar mais

---

## 🔍 Dica Extra: Verificar Network Tab

1. Na janela anônima, abra DevTools (F12)
2. Vá na aba **Network**
3. Marque a checkbox **"Disable cache"** (no topo)
4. Recarregue a página (F5)
5. Procure pela requisição `/api/periods/list`
6. Clique nela e veja:
   - **Status:** 200
   - **Response:** Deve mostrar 5 períodos
   - **Time:** Quanto tempo levou

---

## 📝 Me envie depois:

1. ✅ Funcionou em modo anônimo?
2. ✅ Quantos períodos aparecem no dropdown?
3. ✅ Qual período aparece como ativo?
4. ❌ Se não funcionou, o que aparece de errado?

