# Teste Manual de Exclusão de Ajuste

## Problema Identificado

Logs mostram:
- `[AdjustmentsPageClient] initialAdjustments atualizados: 184` ← Total de ajustes no banco
- `[AdjustmentsTable] ✅ Ajustes recarregados do banco: 2` ← Apenas 2 do período ativo

Isso significa:
- Há 184 ajustes totais no banco
- Apenas 2 ajustes pertencem ao período ativo atual
- Quando você tenta excluir, algo pode estar impedindo

## Teste 1: Verificar se o Botão Está Sendo Clicado

Abra o Console do Navegador (F12) e procure por:

```
🔴🔴🔴 BOTÃO DELETE CLICADO! 🔴🔴🔴
```

**Se aparecer**: Botão funciona, problema está na API
**Se NÃO aparecer**: Botão não está disparando o onClick

## Teste 2: Verificar Resposta da API

Após clicar em excluir, procure no console por:

```
[DELETE] Iniciando exclusão do ajuste: [id]
[DELETE] Response status: 200
[DELETE] Response ok: true
```

**Se status = 200 e ok = true**: API deletou com sucesso
**Se status = 400 ou 500**: Houve erro

## Teste 3: Verificar Diretamente no Banco

Execute no SQL Editor do Supabase:

```sql
-- Ver TODOS os ajustes do item 011141
SELECT
  id,
  cod_negativo,
  cod_positivo,
  qtd_baixada,
  period_id,
  created_at
FROM code_offset_adjustments
WHERE (cod_negativo = '011141' OR cod_negativo = '11141')
   OR (cod_positivo = '011141' OR cod_positivo = '11141')
ORDER BY created_at DESC;
```

**Antes de excluir**: Deve mostrar 2 ajustes
**Depois de excluir**: Deve mostrar 1 ajuste

## Teste 4: Excluir Manualmente via SQL

Se o botão não funcionar, você pode excluir manualmente:

```sql
-- CUIDADO: Isso vai DELETAR PERMANENTEMENTE o ajuste de 28 unidades
DELETE FROM code_offset_adjustments
WHERE cod_negativo = '011141'
  AND cod_positivo = '013671'
  AND qtd_baixada = 28;
```

Depois execute:
```sql
-- Verificar se foi deletado
SELECT COUNT(*) FROM code_offset_adjustments
WHERE cod_negativo = '011141' AND qtd_baixada = 28;
-- Deve retornar 0
```

## Teste 5: Verificar Permissões

Pode ser que o botão não tenha permissão para deletar. Execute:

```sql
-- Ver políticas RLS da tabela
SELECT * FROM pg_policies
WHERE tablename = 'code_offset_adjustments';
```

## O Que Fazer Dependendo do Resultado

### Se o botão NÃO disparar o onClick:
- Problema: Event listener não está funcionando
- Solução: Verificar se há algum elemento sobrepondo o botão

### Se a API retornar erro 400/500:
- Problema: Permissão ou validação
- Solução: Ver mensagem de erro no console

### Se a API retornar 200 mas ajuste não for deletado:
- Problema: Query SQL não encontra o registro
- Solução: Verificar se o ID está correto

### Se nada funcionar:
- Usar exclusão manual via SQL (Teste 4)
- Depois recarregar a página com F5
