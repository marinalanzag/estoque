# 🗑️ Guia para Excluir Todos os Períodos

## 📋 Resumo

Este guia explica como excluir **apenas** os períodos da tabela `periods`, sem afetar nenhum dado de movimentações, inventário ou outras tabelas.

## ✅ O que acontece

- ✅ **Todos os períodos serão excluídos** da tabela `periods`
- ✅ **Os dados permanecerão intactos**: movimentações, inventário, imports, etc.
- ✅ **Os vínculos serão removidos**: `period_id` será setado para `NULL` nas tabelas relacionadas
- ❌ **Nenhum dado será perdido** (apenas o vínculo com o período)

## 📁 Arquivos Disponíveis

1. **`db/delete_all_periods.sql`** - Script com verificações (DELETE comentado)
   - Use para verificar o que será excluído antes de executar
   - Mostra quantos períodos existem e lista todos eles

2. **`db/delete_all_periods_EXECUTAR.sql`** - Script pronto para executar
   - Contém o DELETE já descomentado
   - Mostra os períodos antes de excluir
   - Verifica o resultado após a exclusão

## 🚀 Como Executar

### Passo 1: Verificar Períodos (Opcional)

Se quiser ver o que será excluído antes:

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo de `db/delete_all_periods.sql`
4. Execute para ver:
   - Quantos períodos existem
   - Lista completa dos períodos
   - Quantos registros têm vínculo com períodos

### Passo 2: Executar Exclusão

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Copie e cole o conteúdo de `db/delete_all_periods_EXECUTAR.sql`
4. Execute o script

O script irá:
- Mostrar os períodos que serão excluídos
- Executar o DELETE
- Confirmar que todos foram excluídos

### Passo 3: Verificar Resultado

Após executar, o próprio script mostrará:
```
periodos_restantes | status
-------------------|----------------------------------------------------------
0                  | ✅ Todos os períodos foram excluídos com sucesso!
```

## 🔍 Verificar Dados Relacionados

Para confirmar que os dados permaneceram intactos, você pode executar:

```sql
-- Verificar que os dados ainda existem (apenas period_id será NULL)
SELECT 
  'sped_files' as tabela,
  COUNT(*) as total_registros
FROM public.sped_files
UNION ALL
SELECT 
  'stock_initial_imports',
  COUNT(*)
FROM public.stock_initial_imports
UNION ALL
SELECT 
  'xml_sales_imports',
  COUNT(*)
FROM public.xml_sales_imports;
```

Todos os registros devem continuar existindo, apenas sem vínculo com períodos.

## ⚠️ Importante

- **Não é reversível**: Após excluir, você precisará criar novos períodos
- **Não afeta dados**: Movimentações, inventários e imports permanecem intactos
- **Vínculos removidos**: Os `period_id` nas outras tabelas serão setados para `NULL`

## 🎯 Após a Exclusão

1. Você pode criar novos períodos normalmente pelo sistema
2. Os novos períodos podem ser vinculados aos dados existentes (se necessário)
3. Todos os dados de movimentações e inventário continuam disponíveis

---

**Precisa de ajuda?** Execute primeiro o script de verificação (`delete_all_periods.sql`) para ver o que será excluído antes de executar o DELETE.



