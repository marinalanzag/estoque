# 📋 Guia Rápido: Upload de XMLs de Venda

## 🎯 Objetivo
Importar XMLs de NF-e/NFC-e de venda para preencher as saídas que faltam no inventário fiscal teórico.

## 📝 Passo a Passo

### 1️⃣ Acessar a Página de Upload
```
http://localhost:3000/sped/upload-xml-sales
```

Ou pelo dashboard:
- Acesse `http://localhost:3000`
- Clique em "Etapa 3 – Importar XMLs de Vendas"

### 2️⃣ Selecionar o Arquivo SPED
- No dropdown "Arquivo SPED de destino", escolha o arquivo SPED que você importou anteriormente
- ⚠️ **IMPORTANTE**: O arquivo SPED deve ter sido importado primeiro!

### 3️⃣ Selecionar os XMLs
- Clique em "Arquivos XML ou ZIP"
- Selecione **todos os XMLs de uma vez** (ou múltiplos ZIPs)
- O sistema processará em lotes de 300 arquivos automaticamente

### 4️⃣ Importar
- Clique em "Importar XMLs de Venda"
- Aguarde o processamento (pode levar alguns minutos)
- Acompanhe o progresso pela barra de progresso

### 5️⃣ Verificar Resultados
Após o upload, você verá:
- ✅ **Total de XMLs**: Quantos arquivos foram recebidos
- ✅ **XMLs processados**: Quantos foram vinculados com sucesso
- ✅ **Itens inseridos**: Quantos itens foram adicionados como saídas
- ⚠️ **Pendências**: XMLs que não foram vinculados (ex: chave não encontrada no SPED)

## 🔍 Verificar se Funcionou

### Opção 1: Pela Página de Inventário
1. Acesse: `http://localhost:3000/sped`
2. Clique em "Ver inventário fiscal teórico" no arquivo SPED
3. Verifique a coluna **"Saídas"** - deve estar > 0
4. Verifique o **"Estoque teórico"** - deve estar ajustado (inicial + entradas - saídas)

### Opção 2: Pela Página de Diagnóstico
1. Na página do inventário, clique em **"🔍 Diagnosticar saídas"**
2. Verifique:
   - Quantos documentos têm `ind_oper = '1'` (saídas)
   - Quantos `document_items` têm `movement_type = 'saida'`
   - Se há itens vinculados corretamente

## ⚙️ O que o Sistema Faz

1. **Lê os XMLs** e extrai:
   - Chave de acesso da NF-e (`chNFe`)
   - Itens (`cProd`, `qCom`, `vProd`, etc.)

2. **Normaliza os códigos**:
   - Converte códigos simplificados para 6 dígitos
   - Exemplo: `"123"` → `"000123"`

3. **Vincula aos documentos**:
   - Busca na tabela `documents` pelo `chv_nfe`
   - Só vincula se encontrar o documento no SPED

4. **Insere como saídas**:
   - Cria registros em `document_items`
   - Com `movement_type = 'saida'`
   - E `movement_qty` negativo

## ❓ Problemas Comuns

### "Pendências: Chave de acesso não encontrada"
- **Causa**: O XML não tem um documento C100 correspondente no SPED
- **Solução**: Verifique se a chave do XML está no SPED importado

### "Saídas ainda zeradas"
- **Causa**: Os XMLs não foram vinculados ou os códigos não batem
- **Solução**: 
  1. Use a página de diagnóstico
  2. Verifique se os códigos dos produtos estão normalizados (6 dígitos)
  3. Reimporte os XMLs se necessário

### "Erro: Load Failed" ou timeout
- **Causa**: Muitos arquivos de uma vez
- **Solução**: 
  1. Divida em grupos menores (ex: 1000 XMLs por vez)
  2. Ou aguarde - o sistema processa em background

## 📊 Exemplo de Resultado Esperado

Após importar com sucesso:
```
✅ Total de XMLs: 6100
✅ XMLs processados: 6050
✅ Itens inseridos: 12500
⚠️ Pendências: 50
```

E no inventário:
- **Estoque inicial**: 1000 unidades
- **Entradas**: 500 unidades
- **Saídas**: 300 unidades ← **DEVE APARECER AGORA!**
- **Estoque teórico**: 1200 unidades

## 🎉 Pronto!

Agora você pode ver o inventário fiscal teórico completo com todas as saídas!

