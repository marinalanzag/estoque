# Guia de Teste - Sistema de Inventário SPED

Este guia explica como testar o sistema completo, passo a passo.

## 📋 Pré-requisitos

1. Servidor Next.js rodando: `npm run dev`
2. Banco Supabase configurado com as tabelas criadas
3. Arquivos `.env.local` configurado com credenciais do Supabase

## 🚀 Fluxo de Teste Completo

### **Etapa 1: Importar Estoque Inicial**

1. Acesse: `http://localhost:3000/stock-initial/upload`
2. Prepare um arquivo de estoque inicial em um dos formatos:
   - **TXT (SPED H010)**: Arquivo com linhas no formato:
     ```
     |H010|COD001|UN|100,00|5,50|550,00|
     |H010|COD002|UN|50,00|10,00|500,00|
     ```
   - **CSV**: Arquivo com cabeçalho:
     ```csv
     cod_item,descr_item,qtd,unid
     COD001,Produto Teste 1,100,UN
     COD002,Produto Teste 2,50,UN
     ```
   - **XLSX**: Planilha Excel com as mesmas colunas do CSV

3. Faça upload do arquivo
4. Verifique a mensagem de sucesso: "Estoque inicial importado com sucesso! Registros: X"

**Verificação no Dashboard:**
- Acesse `http://localhost:3000/`
- O card "Etapa 1" deve mostrar status "Carregado" e o número de registros

---

### **Etapa 2: Importar SPED**

1. Acesse: `http://localhost:3000/sped/upload`
2. Prepare um arquivo SPED `.txt` com os blocos necessários:
   - **0200**: Produtos (cod_item, descr_item, etc.)
   - **C100**: Documentos (entradas e saídas)
   - **C170**: Itens de documento (vinculados ao C100 anterior)
   - **H005**: Inventários (opcional, mas não será usado como estoque inicial)
   - **H010**: Itens de inventário (opcional)

**Exemplo mínimo de SPED:**
```
|0000|001|0|...|
|0200|COD001|Produto Teste 1|UN|00|...|
|C100|0|...|SERIE|001|...|01012022|01012022|1000,00|
|C170|1|COD001|Descrição|10,00|UN|5,00|...|5101|
|C100|1|...|SERIE|002|...|01012022|01012022|500,00|
|C170|1|COD001|Descrição|5,00|UN|5,00|...|5102|
|9999|...|
```

3. Faça upload do arquivo SPED
4. Verifique o resumo exibido:
   - Produtos: X
   - Documentos: Y
   - Itens de documento: Z
   - Inventários: W

**Verificação no Dashboard:**
- O card "Etapa 2" deve mostrar "Arquivos importados: 1" (ou mais)
- Clique em "Ver todos os arquivos" para ver a lista

---

### **Etapa 3: Importar XMLs de Vendas**

1. Acesse: `http://localhost:3000/sped/upload-xml-sales`
2. Selecione o arquivo SPED de destino (o que você importou na Etapa 2)
3. Prepare arquivos XML de NF-e/NFC-e:
   - Pode ser um único arquivo `.xml`
   - Ou múltiplos arquivos `.xml`
   - Ou um arquivo `.zip` contendo vários XMLs

**Importante:**
- Os XMLs devem ter a chave de acesso (`chNFe`) que corresponda ao `chv_nfe` dos documentos C100 importados no SPED
- Os XMLs devem ser de **vendas** (saídas), não de compras

4. Faça upload dos XMLs
5. Verifique o resumo:
   - Total de XMLs: X
   - XMLs processados: Y
   - Itens inseridos: Z
   - Pendências: W (se houver)

**Verificação:**
- XMLs processados devem ser > 0 se houver documentos C100 com `ind_oper="1"` (saída)
- Itens inseridos devem ser > 0 se os XMLs tiverem itens válidos

---

### **Etapa 4: Verificar Inventário Teórico**

1. Acesse: `http://localhost:3000/sped`
2. Clique em "Ver inventário fiscal" no arquivo SPED desejado
3. A página mostrará:
   - **Estoque inicial**: Vindo da tabela `stock_initial`
   - **Entradas**: Soma de `document_items` com `movement_type="entrada"` ou `ind_oper="0"`
   - **Saídas**: Soma de `document_items` com `movement_type="saida"` ou `ind_oper="1"`
   - **Estoque teórico final**: `estoque_inicial + entradas - saidas`

**Verificação:**
- Se você importou estoque inicial, deve aparecer valores > 0
- Se você importou SPED com C100 de entrada (`ind_oper="0"`), deve aparecer entradas > 0
- Se você importou XMLs de vendas, deve aparecer saídas > 0
- O estoque teórico deve ser calculado corretamente

---

## 🧪 Dados de Teste Mínimos

### **Estoque Inicial (stock_initial.txt)**
```
|H010|COD001|UN|100,00|5,50|550,00|
|H010|COD002|UN|50,00|10,00|500,00|
```

### **SPED Mínimo (sped-teste.txt)**
```
|0000|001|0|...|
|0200|COD001|Produto Teste 1|UN|00|...|
|0200|COD002|Produto Teste 2|UN|00|...|
|C100|0|0||65|00|001|001|...|01012022|01012022|1000,00|
|C170|1|COD001|Descrição|10,00|UN|5,00|...|5101|
|C100|1|0||65|00|001|002|31220121899992000100650920000044989154612168|01012022|01012022|500,00|
|C170|1|COD001|Descrição|5,00|UN|5,00|...|5102|
|9999|...|
```

### **XML de Venda Mínimo**
Um XML de NF-e/NFC-e com:
- Chave de acesso: `31220121899992000100650920000044989154612168` (deve bater com o C100 acima)
- Itens (`<det>`) com `cProd`, `qCom`, `vProd`, etc.

---

## 🔍 Verificações no Banco de Dados

Você pode verificar diretamente no Supabase:

1. **stock_initial**: Deve ter registros após Etapa 1
2. **sped_files**: Deve ter registros após Etapa 2
3. **products**: Deve ter produtos após Etapa 2
4. **documents**: Deve ter documentos C100 após Etapa 2
5. **document_items**: Deve ter itens C170 após Etapa 2, e itens de XML após Etapa 3
6. **inventories**: Deve ter inventários H005 após Etapa 2 (se o SPED tiver)

---

## ⚠️ Problemas Comuns

### "Nenhum arquivo SPED importado ainda"
- Importe um arquivo SPED primeiro na Etapa 2

### "Estoque inicial: 0" no inventário
- Verifique se importou o estoque inicial na Etapa 1
- Verifique se os `cod_item` do estoque inicial batem com os do SPED

### "Saídas: 0" no inventário
- Verifique se importou XMLs de vendas na Etapa 3
- Verifique se as chaves de acesso dos XMLs batem com os `chv_nfe` dos documentos C100
- Verifique se os documentos C100 têm `ind_oper="1"` (saída)

### "Erro ao parsear XML"
- Verifique se o XML está bem formado
- Verifique se a chave de acesso tem 44 dígitos
- Verifique os logs do servidor para mais detalhes

---

## 📊 Ordem Recomendada de Teste

1. ✅ Importar estoque inicial (Etapa 1)
2. ✅ Verificar no dashboard que está "Carregado"
3. ✅ Importar SPED (Etapa 2)
4. ✅ Verificar no dashboard que arquivos aparecem
5. ✅ Verificar inventário teórico (deve mostrar estoque inicial + entradas)
6. ✅ Importar XMLs de vendas (Etapa 3)
7. ✅ Verificar inventário teórico novamente (deve mostrar saídas também)

---

## 🎯 Teste Rápido (1 minuto)

Se você já tem dados no banco:

1. Acesse `http://localhost:3000/`
2. Verifique os cards do dashboard
3. Clique em "Ver todos os arquivos" no card SPED
4. Clique em "Ver inventário fiscal" em qualquer arquivo
5. Verifique se os cálculos estão corretos

---

## 📝 Logs do Servidor

Durante os testes, monitore o terminal onde está rodando `npm run dev`:

- `[api/sped/import] Arquivo processado: ...` - Confirma importação do SPED
- `[api/sped/import-xml-sales] XMLs recebidos=X, ...` - Confirma importação de XMLs
- Erros aparecerão em vermelho com detalhes

---

## 🆘 Precisa de Ajuda?

Se algo não funcionar:
1. Verifique os logs do servidor
2. Verifique o console do navegador (F12)
3. Verifique se as tabelas no Supabase têm dados
4. Verifique se os `cod_item` estão consistentes entre estoque inicial, SPED e XMLs

