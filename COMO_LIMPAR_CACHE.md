# Como Limpar o Cache do Navegador

## Por que limpar o cache?

O cache do navegador pode armazenar versões antigas dos dados, fazendo com que:
- Períodos antigos apareçam mesmo após serem atualizados
- Dados desatualizados sejam exibidos
- Mudanças recentes não sejam refletidas

## Métodos por Navegador

### Google Chrome

**Método 1: Limpeza rápida (recomendado)**
1. Pressione `Ctrl + Shift + Delete` (Windows/Linux) ou `Cmd + Shift + Delete` (Mac)
2. Selecione "Última hora" ou "Últimas 24 horas"
3. Marque as opções:
   - ✅ Imagens e arquivos em cache
   - ✅ Cookies e outros dados de sites
4. Clique em "Limpar dados"

**Método 2: Limpeza completa**
1. Clique no menu (três pontos) no canto superior direito
2. Vá em "Mais ferramentas" → "Limpar dados de navegação"
3. Selecione "Todo o período"
4. Marque todas as opções
5. Clique em "Limpar dados"

**Método 3: Modo anônimo (para teste rápido)**
1. Pressione `Ctrl + Shift + N` (Windows/Linux) ou `Cmd + Shift + N` (Mac)
2. Abra o sistema no modo anônimo
3. Isso ignora o cache automaticamente

### Microsoft Edge

**Método rápido:**
1. Pressione `Ctrl + Shift + Delete` (Windows) ou `Cmd + Shift + Delete` (Mac)
2. Selecione "Última hora"
3. Marque "Imagens e arquivos em cache" e "Cookies"
4. Clique em "Limpar agora"

**Modo InPrivate (anônimo):**
1. Pressione `Ctrl + Shift + N` (Windows) ou `Cmd + Shift + N` (Mac)
2. Abra o sistema no modo InPrivate

### Mozilla Firefox

**Método rápido:**
1. Pressione `Ctrl + Shift + Delete` (Windows/Linux) ou `Cmd + Shift + Delete` (Mac)
2. Selecione "Última hora"
3. Marque "Cache" e "Cookies"
4. Clique em "Limpar agora"

**Modo anônimo:**
1. Pressione `Ctrl + Shift + P` (Windows/Linux) ou `Cmd + Shift + P` (Mac)
2. Abra o sistema no modo anônimo

### Safari (Mac)

**Método rápido:**
1. Vá em "Safari" → "Limpar histórico..."
2. Selecione "Última hora"
3. Clique em "Limpar histórico"

**Modo de navegação privada:**
1. Pressione `Cmd + Shift + N`
2. Abra o sistema no modo privado

## Limpeza Específica para o Site

Se quiser limpar apenas o cache deste site específico:

### Chrome/Edge
1. Abra o site
2. Pressione `F12` para abrir as ferramentas de desenvolvedor
3. Clique com o botão direito no ícone de atualizar (ao lado da barra de endereço)
4. Selecione "Esvaziar cache e atualizar forçadamente" (ou "Empty Cache and Hard Reload")

### Firefox
1. Abra o site
2. Pressione `Ctrl + F5` (Windows/Linux) ou `Cmd + Shift + R` (Mac)
3. Isso força uma atualização sem usar o cache

## Verificação após Limpar Cache

Após limpar o cache, verifique:

1. **Recarregue a página** pressionando `F5` ou `Ctrl + R`
2. **Verifique os períodos** - devem aparecer todos os períodos do banco (9 períodos)
3. **Verifique o período ativo** - deve aparecer o período correto
4. **Teste outras funcionalidades** - entradas, ajustes, relatórios

## Dica Extra: Hard Refresh

Se ainda houver problemas após limpar o cache, faça um **Hard Refresh**:

- **Windows/Linux**: `Ctrl + Shift + R` ou `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

Isso força o navegador a buscar tudo novamente do servidor, ignorando completamente o cache.

## Se Ainda Não Funcionar

Se após limpar o cache os períodos ainda não aparecerem corretamente:

1. **Feche completamente o navegador** (não apenas a aba)
2. **Reabra o navegador**
3. **Acesse o site novamente**
4. Se persistir, tente em **modo anônimo/privado** para confirmar se é problema de cache

## Checklist Rápido

- [ ] Limpei o cache do navegador
- [ ] Fiz um Hard Refresh (`Ctrl + Shift + R`)
- [ ] Verifiquei se os períodos aparecem corretamente
- [ ] Testei em modo anônimo (se necessário)
- [ ] Fechei e reabri o navegador completamente

