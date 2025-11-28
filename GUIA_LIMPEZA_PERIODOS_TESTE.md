# Guia de Limpeza de Períodos de Teste

## 📋 Visão Geral

Este guia ajuda você a limpar os períodos de teste antes de iniciar o uso real do sistema. O script SQL fornece diferentes opções de limpeza, desde a mais conservadora até a mais completa.

## ⚠️ Importante

- **Faça backup do banco antes de executar qualquer limpeza!**
- As foreign keys estão configuradas com `on delete set null`, então deletar períodos **não deleta** os dados vinculados, apenas remove a referência.
- Se você quiser deletar **tudo** (períodos + dados), use a Parte 3 do script.

## 🔍 Opções de Limpeza

### Opção 1: Limpeza Conservadora (Recomendada)
**Deleta apenas os períodos, mantendo todos os dados**

- ✅ Mantém todos os SPEDs, estoques, XMLs e ajustes
- ✅ Apenas remove a referência ao período (`period_id` fica `null`)
- ✅ Útil se você quiser manter os dados de teste para referência
- ⚠️ Os dados ficarão "órfãos" (sem período vinculado)

**Quando usar:** Se você quer manter os dados de teste mas limpar apenas a estrutura de períodos.

### Opção 2: Limpeza Completa
**Deleta períodos + todos os dados vinculados**

- ⚠️ **DELETA TUDO**: SPEDs, estoques, XMLs, ajustes, produtos, documentos, etc.
- ✅ Banco completamente limpo para começar do zero
- ⚠️ **Irreversível** - certifique-se de que realmente quer deletar tudo

**Quando usar:** Se você tem certeza de que todos os dados são de teste e quer começar completamente do zero.

### Opção 3: Limpeza Seletiva
**Deleta apenas períodos específicos**

- ✅ Permite escolher quais períodos deletar
- ✅ Pode deletar por ID, ano, ou outros critérios
- ✅ Útil se você quer manter alguns períodos e deletar outros

**Quando usar:** Se você quer manter alguns dados de teste e deletar outros.

## 📝 Passo a Passo

### 1. Visualizar o que será deletado

Primeiro, execute a **Parte 1** do script `db/cleanup_test_periods.sql`:

```sql
-- Ver todos os períodos existentes
SELECT 
  id,
  year,
  month,
  name,
  label,
  is_active,
  created_at,
  (SELECT COUNT(*) FROM sped_files WHERE period_id = periods.id) as total_sped_files,
  (SELECT COUNT(*) FROM stock_initial_imports WHERE period_id = periods.id) as total_stock_imports,
  (SELECT COUNT(*) FROM xml_sales_imports WHERE period_id = periods.id) as total_xml_imports,
  (SELECT COUNT(*) FROM code_offset_adjustments WHERE period_id = periods.id) as total_adjustments,
  (SELECT COUNT(*) FROM product_catalog_imports WHERE period_id = periods.id) as total_catalog_imports
FROM periods
ORDER BY year DESC, month DESC;
```

Isso mostrará todos os períodos e quantos dados estão vinculados a cada um.

### 2. Escolher a opção de limpeza

Decida qual opção usar baseado nas suas necessidades:

- **Opção 1 (Conservadora):** Se quer manter os dados mas limpar apenas os períodos
- **Opção 2 (Completa):** Se quer deletar tudo e começar do zero
- **Opção 3 (Seletiva):** Se quer deletar apenas alguns períodos específicos

### 3. Executar a limpeza

No Supabase SQL Editor:

1. Abra o arquivo `db/cleanup_test_periods.sql`
2. Descomente a seção correspondente à opção escolhida
3. Revise o código cuidadosamente
4. Execute o script

### 4. Verificar a limpeza

Execute a **Parte 4** (Verificação Final) do script para confirmar que tudo foi limpo corretamente.

## 🎯 Recomendação

Para iniciar o saneamento real, recomendo a **Opção 2 (Limpeza Completa)** porque:

1. ✅ Garante que não há dados de teste misturados com dados reais
2. ✅ Evita confusão futura sobre quais dados são de teste
3. ✅ Permite começar com um banco limpo e organizado
4. ✅ Facilita a identificação de problemas (tudo será novo)

**Mas certifique-se de:**
- Fazer backup antes
- Confirmar que realmente todos os dados são de teste
- Ter certeza de que não precisa de nenhum dado de teste para referência

## 🔄 Após a Limpeza

1. **Criar o primeiro período real:**
   - Acesse a plataforma
   - Clique em "+ Novo Período"
   - Selecione o ano e mês do primeiro período real
   - O período será criado e ativado automaticamente

2. **Importar dados reais:**
   - Importe o SPED base do período
   - Importe o estoque inicial base
   - Importe os XMLs de venda base
   - Configure tudo como "base" na página de configuração do período

3. **Iniciar o trabalho:**
   - Agora você está pronto para começar o saneamento real!

## ❓ Dúvidas Frequentes

**P: Posso recuperar os dados depois?**
R: Não, a menos que você tenha feito backup. A limpeza é irreversível.

**P: E se eu quiser manter alguns dados de teste?**
R: Use a Opção 3 (Limpeza Seletiva) para deletar apenas os períodos que não quer manter.

**P: Os dados órfãos (sem período) vão causar problemas?**
R: Não, mas eles não aparecerão nas consultas filtradas por período. Se você usar a Opção 1, considere deletar os dados órfãos manualmente depois.

**P: Preciso fazer backup?**
R: **SIM!** Sempre faça backup antes de executar qualquer script de limpeza.

## 📞 Suporte

Se tiver dúvidas ou problemas durante a limpeza, revise o script e certifique-se de entender o que cada parte faz antes de executar.


