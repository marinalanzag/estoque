# 📋 Guia de Migração no Supabase

## ⚠️ Problema Identificado

O diagnóstico mostrou que a coluna `is_base` não existe na tabela `stock_initial_imports`, o que impede:
- Marcar estoques iniciais como base
- O botão "Marcar como base" não funciona
- O sistema não consegue identificar qual estoque é base

## ✅ Solução

Execute o arquivo SQL consolidado no Supabase para adicionar todas as colunas necessárias.

---

## 📄 Arquivos SQL para Executar

### 1. **EXECUTAR_NO_SUPABASE.sql** ⭐ (PRINCIPAL)

Este é o arquivo **MAIS IMPORTANTE** que você precisa executar agora. Ele contém:

- ✅ Adiciona coluna `is_base` em `stock_initial_imports` (resolve o problema principal)
- ✅ Adiciona coluna `is_base` em `sped_files`
- ✅ Adiciona coluna `is_base` em `xml_sales_imports`
- ✅ Adiciona coluna `label` em `periods`
- ✅ Cria todos os índices necessários

**Este arquivo é seguro** - usa `IF NOT EXISTS`, então não vai duplicar nada se já existir.

---

### 2. **db/schema_periods.sql** (Opcional - só se ainda não executou)

Execute apenas se ainda não criou a estrutura básica de períodos. Este arquivo contém:
- Criação da tabela `periods`
- Adição de `period_id` nas tabelas relacionadas
- Triggers e índices básicos

**⚠️ ATENÇÃO:** Este arquivo também usa `IF NOT EXISTS`, então é seguro executar mesmo se já tiver parte da estrutura.

---

## 🚀 Como Executar

### Passo 1: Acesse o Supabase Dashboard

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. No menu lateral, clique em **"SQL Editor"**

### Passo 2: Execute o Arquivo Principal

1. Abra o arquivo **`EXECUTAR_NO_SUPABASE.sql`** no seu editor
2. Copie **TODO o conteúdo** do arquivo
3. Cole no SQL Editor do Supabase
4. Clique em **"Run"** ou pressione `Ctrl+Enter` (ou `Cmd+Enter` no Mac)

### Passo 3: Verificar Sucesso

Você deve ver uma mensagem de sucesso como:
```
Success. No rows returned
```

Ou várias mensagens de sucesso indicando que cada comando foi executado.

---

## ✅ Verificação Pós-Migração

Após executar a migração, você pode verificar executando:

```bash
npm run diagnostico:periodos
```

O diagnóstico deve mostrar:
- ✅ Coluna `is_base` existe
- ✅ Estoques podem ser marcados como base
- ✅ Sistema funcionando corretamente

---

## 📝 Ordem Recomendada de Execução

1. **Primeiro:** Execute `EXECUTAR_NO_SUPABASE.sql` (resolve o problema imediato)
2. **Depois (se necessário):** Execute `db/schema_periods.sql` (garante estrutura completa)

---

## ⚠️ Importante

- ✅ Os arquivos usam `IF NOT EXISTS`, então são **seguros** para executar múltiplas vezes
- ✅ Não vão deletar ou modificar dados existentes
- ✅ Apenas adicionam colunas e índices que faltam
- ✅ Execute em um ambiente de desenvolvimento primeiro, se possível

---

## 🆘 Problemas Comuns

### Erro: "column already exists"
- **Causa:** A coluna já existe no banco
- **Solução:** Ignore o erro, está tudo certo. O `IF NOT EXISTS` deve prevenir isso, mas se acontecer, não é problema.

### Erro: "table does not exist"
- **Causa:** Alguma tabela ainda não foi criada
- **Solução:** Execute primeiro `db/schema_periods.sql` ou verifique se as tabelas base do sistema existem.

### Erro de permissão
- **Causa:** Sua conta não tem permissão para alterar o schema
- **Solução:** Certifique-se de estar logado como administrador do projeto no Supabase.

---

## 📞 Precisa de Ajuda?

Se encontrar algum problema:

1. Copie a mensagem de erro completa
2. Execute o diagnóstico: `npm run diagnostico:periodos`
3. Verifique os logs no Supabase Dashboard

---

## ✨ Após a Migração

Depois de executar com sucesso:

1. ✅ O botão "Marcar como base" deve funcionar para estoques iniciais
2. ✅ Você poderá marcar um estoque como base na página de configuração
3. ✅ O sistema poderá identificar qual estoque é base automaticamente
4. ✅ Todos os recursos do sistema de períodos estarão funcionando

