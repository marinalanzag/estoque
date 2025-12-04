# 🔍 Guia de Diagnóstico de Períodos

Este guia explica como usar o script de diagnóstico para verificar o estado dos períodos no banco de dados.

## 📋 O que o script verifica

O script `diagnostico-periodos.js` realiza uma análise completa do sistema de períodos:

1. **Períodos no Banco de Dados**
   - Total de períodos existentes
   - Lista completa de períodos

2. **Períodos Ativos**
   - Quantos períodos estão ativos (deve ser apenas 1)
   - Identificação do período ativo

3. **Validação de Dados**
   - Verifica se todos os períodos têm dados válidos
   - Identifica períodos com anos/meses inválidos
   - Verifica campos obrigatórios

4. **Períodos Duplicados**
   - Identifica períodos com mesmo ano/mês
   - Lista todos os duplicados encontrados

5. **Vinculações de Arquivos**
   - SPEDs vinculados a períodos
   - Estoques iniciais vinculados
   - XMLs vinculados
   - Arquivos marcados como "base"

6. **Resumo e Recomendações**
   - Lista todos os problemas encontrados
   - Sugere correções quando necessário

## 🚀 Como usar

### Pré-requisitos

Certifique-se de que o arquivo `.env.local` está configurado com:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-chave-aqui
```

### Executar o diagnóstico

```bash
npm run diagnostico:periodos
```

Ou diretamente:

```bash
node diagnostico-periodos.js
```

## 📊 Interpretando os resultados

### ✅ Sem problemas

Se você ver mensagens verdes como:
```
✅ Período ativo: 2023/01 - Janeiro 2023
✅ Todos os períodos têm dados válidos
✅ Nenhum período duplicado encontrado
```

O sistema está funcionando corretamente!

### ⚠️ Avisos

Avisos aparecem em amarelo e indicam situações que podem causar problemas:

- **Nenhum período ativo**: Você precisa ativar um período antes de trabalhar
- **Arquivos não vinculados**: Alguns arquivos podem não estar vinculados ao período atual
- **Nenhum arquivo base**: O período ativo pode não ter um SPED ou estoque marcado como base

### ❌ Erros

Erros aparecem em vermelho e indicam problemas críticos:

- **Múltiplos períodos ativos**: Mais de um período está marcado como ativo (deve ser apenas 1)
- **Dados inválidos**: Períodos com anos/meses fora do esperado
- **Períodos duplicados**: Múltiplos períodos com mesmo ano/mês

## 🔧 Correções comuns

### Múltiplos períodos ativos

Se o diagnóstico mostrar múltiplos períodos ativos, você pode corrigir:

1. **Pela interface**:
   - Acesse a página de períodos
   - Ative apenas o período desejado (os outros serão desativados automaticamente)

2. **Diretamente no Supabase**:
   - Acesse o SQL Editor no Supabase Dashboard
   - Execute:
   ```sql
   -- Desativar todos os períodos
   UPDATE periods SET is_active = false;
   
   -- Ativar apenas o período desejado (substitua o ID)
   UPDATE periods SET is_active = true WHERE id = 'id-do-periodo';
   ```

### Períodos duplicados

1. Identifique qual período manter (geralmente o mais recente)
2. Delete ou marque os outros como inativos
3. Execute o diagnóstico novamente para verificar

### Dados inválidos

1. Verifique cada período com problema
2. Corrija manualmente no Supabase ou pela interface
3. Ou delete períodos inválidos se não forem necessários

## 📝 Exemplo de saída

```
============================================================
🔍 DIAGNÓSTICO DE PERÍODOS
============================================================
✅ Variáveis de ambiente encontradas
ℹ️  URL: https://xxxxx.supabase.co...

============================================================
1. PERÍODOS NO BANCO DE DADOS
============================================================
ℹ️  Total de períodos encontrados: 3

============================================================
2. PERÍODOS ATIVOS
============================================================
ℹ️  Períodos ativos encontrados: 1
✅ Período ativo: 2023/01 - Janeiro 2023
ℹ️    ID: abc123def456...
ℹ️    Label: Jan/2023
ℹ️    Criado em: 15/01/2023 10:30:00

============================================================
3. VALIDAÇÃO DE DADOS
============================================================
✅ Todos os períodos têm dados válidos

============================================================
4. PERÍODOS DUPLICADOS
============================================================
✅ Nenhum período duplicado encontrado

...
```

## 🆘 Precisa de ajuda?

Se encontrar problemas que não consegue resolver:

1. Execute o diagnóstico novamente para confirmar
2. Copie a saída completa do diagnóstico
3. Verifique os logs do servidor (se aplicável)
4. Consulte a documentação do Supabase

## 📌 Dicas

- Execute o diagnóstico sempre que houver problemas com períodos
- Execute após criar ou ativar um período para verificar
- Execute antes de fazer mudanças importantes
- Mantenha apenas um período ativo por vez

