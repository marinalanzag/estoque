# 🧪 Guia de Testes - Refatoração Arquitetural de Períodos

## 📋 Checklist de Testes

### 1. ✅ Verificação Inicial (Antes de Testar)

#### 1.1 Verificar se o código compila
```bash
npm run build
```

**O que verificar:**
- ✅ Sem erros de TypeScript
- ✅ Sem erros de lint
- ✅ Build completa com sucesso

#### 1.2 Verificar se o servidor inicia
```bash
npm run dev
```

**O que verificar:**
- ✅ Servidor inicia sem erros
- ✅ Nenhum erro no console do servidor

---

### 2. 🧪 Testes Locais (Desenvolvimento)

#### 2.1 Teste: Carregamento Inicial de Períodos

**Passos:**
1. Acesse `http://localhost:3000`
2. Observe o componente de seleção de períodos no topo

**O que verificar:**
- ✅ Períodos aparecem no dropdown
- ✅ Período ativo é exibido corretamente
- ✅ Não há mensagens de erro no console do navegador
- ✅ Não há requisições para `/api/periods/list` ou `/api/periods/active` no Network tab

**Resultado esperado:**
- Dados vêm no HTML inicial (não em fetch separado)
- Console do navegador não mostra erros

---

#### 2.2 Teste: Criar Novo Período

**Passos:**
1. Clique em "+ Novo Período"
2. Preencha ano e mês (ex: 2025, Janeiro)
3. Clique em "Criar Período"

**O que verificar:**
- ✅ Modal fecha após criação
- ✅ Novo período aparece no dropdown
- ✅ Novo período é automaticamente ativado
- ✅ Período ativo é atualizado na UI
- ✅ URL é atualizada com `?period=2025-1`
- ✅ Não há mensagens de erro

**Resultado esperado:**
- Período criado e ativado
- UI atualizada sem reload completo da página
- Dados sincronizados corretamente

---

#### 2.3 Teste: Trocar Período Ativo

**Passos:**
1. Selecione um período diferente no dropdown
2. Observe a mudança

**O que verificar:**
- ✅ Período selecionado é ativado
- ✅ Período ativo é atualizado na UI
- ✅ URL é atualizada com o novo período
- ✅ Não há mensagens de erro

**Resultado esperado:**
- Período trocado com sucesso
- UI atualizada corretamente

---

#### 2.4 Teste: Upload de SPED com Período Ativo

**Passos:**
1. Certifique-se de que há um período ativo
2. Acesse `/sped/upload` ou use o formulário de upload
3. Faça upload de um arquivo SPED

**O que verificar:**
- ✅ Upload funciona normalmente
- ✅ Arquivo SPED é vinculado ao período ativo
- ✅ Não há erros relacionados a período

**Resultado esperado:**
- Upload funciona como antes
- Período é vinculado corretamente

---

#### 2.5 Teste: Upload de Estoque Inicial com Período Ativo

**Passos:**
1. Certifique-se de que há um período ativo
2. Acesse `/stock-initial/upload` ou use o formulário
3. Faça upload de um arquivo de estoque inicial

**O que verificar:**
- ✅ Upload funciona normalmente
- ✅ Arquivo é vinculado ao período ativo
- ✅ Não há erros relacionados a período

**Resultado esperado:**
- Upload funciona como antes
- Período é vinculado corretamente

---

#### 2.6 Teste: Página de Ajustes

**Passos:**
1. Certifique-se de que há um período ativo com SPED base
2. Acesse `/ajustes`

**O que verificar:**
- ✅ Página carrega normalmente
- ✅ SPED base é identificado corretamente
- ✅ Ajustes são filtrados pelo período ativo
- ✅ Não há erros no console

**Resultado esperado:**
- Página funciona como antes
- Período ativo é usado corretamente

---

#### 2.7 Teste: Relatório de Ajustes

**Passos:**
1. Certifique-se de que há um período ativo com SPED base
2. Acesse `/ajustes/relatorio`

**O que verificar:**
- ✅ Página carrega normalmente
- ✅ Relatório é gerado corretamente
- ✅ Dados são filtrados pelo período ativo
- ✅ Não há erros no console

**Resultado esperado:**
- Relatório funciona como antes
- Período ativo é usado corretamente

---

#### 2.8 Teste: Vincular Estoque Inicial ao Período

**Passos:**
1. Acesse `/periodos/configuracao`
2. Se houver estoque inicial não vinculado, clique em "Vincular ao Período"

**O que verificar:**
- ✅ Vinculação funciona
- ✅ Página atualiza após vinculação
- ✅ Não há erros

**Resultado esperado:**
- Vinculação funciona normalmente

---

### 3. 🔍 Verificações Técnicas

#### 3.1 Verificar Network Tab (DevTools)

**O que verificar:**
- ❌ **NÃO deve haver** requisições para `/api/periods/list` ou `/api/periods/active` após o carregamento inicial
- ✅ Dados de períodos vêm no HTML inicial (verificar no View Source)

**Como verificar:**
1. Abra DevTools (F12)
2. Vá em Network
3. Recarregue a página
4. Verifique se há requisições para `/api/periods/*`
5. Verifique o HTML da página (View Source) - deve conter dados dos períodos

---

#### 3.2 Verificar Console do Navegador

**O que verificar:**
- ✅ Sem erros de JavaScript
- ✅ Sem warnings relacionados a períodos
- ✅ Logs de debug (se houver) mostram dados corretos

---

#### 3.3 Verificar Console do Servidor

**O que verificar:**
- ✅ Sem erros no servidor
- ✅ Logs mostram busca de períodos no servidor
- ✅ Server Actions executam corretamente

---

### 4. 🚀 Testes em Produção (Vercel)

#### 4.1 Deploy para Vercel

**Passos:**
1. Faça commit das mudanças
2. Faça push para o repositório
3. Aguarde o deploy na Vercel

**O que verificar:**
- ✅ Deploy completa com sucesso
- ✅ Sem erros de build

---

#### 4.2 Teste: Comportamento em Produção

**Passos:**
1. Acesse a aplicação na Vercel
2. Teste todas as funcionalidades listadas na seção 2 (Testes Locais)

**O que verificar:**
- ✅ **CRÍTICO:** Períodos aparecem corretamente (não dados antigos)
- ✅ **CRÍTICO:** Criar período funciona e aparece imediatamente
- ✅ **CRÍTICO:** Trocar período funciona corretamente
- ✅ Não há diferença entre aba normal e aba anônima (ambas devem funcionar igual)

**Resultado esperado:**
- Comportamento idêntico ao desenvolvimento local
- Sem problemas de cache
- Dados sempre atualizados

---

#### 4.3 Teste: Comparar Aba Normal vs Anônima

**Passos:**
1. Abra a aplicação na Vercel em aba normal
2. Crie um novo período
3. Abra a aplicação na Vercel em aba anônima
4. Verifique se o período aparece

**O que verificar:**
- ✅ **CRÍTICO:** Ambas as abas mostram os mesmos dados
- ✅ **CRÍTICO:** Não há diferença de comportamento

**Resultado esperado:**
- Comportamento idêntico entre abas
- Problema de cache resolvido

---

### 5. 🐛 Problemas Comuns e Soluções

#### Problema: Períodos não aparecem

**Possíveis causas:**
- Erro no Server Component
- Erro na busca de períodos no servidor

**Solução:**
1. Verificar console do servidor
2. Verificar se `getAllPeriods()` está funcionando
3. Verificar se há erros no build

---

#### Problema: Período criado não aparece

**Possíveis causas:**
- Erro na Server Action
- `revalidatePath()` não está funcionando

**Solução:**
1. Verificar console do servidor
2. Verificar se `createPeriodAction()` está sendo chamada
3. Verificar se `revalidatePath()` está sendo executada
4. Tentar recarregar a página manualmente

---

#### Problema: Dados antigos aparecem em produção

**Possíveis causas:**
- Cache do Vercel ainda ativo
- Build antigo ainda em uso

**Solução:**
1. Forçar rebuild na Vercel (sem cache)
2. Limpar cache do navegador
3. Verificar se o deploy mais recente está ativo

---

### 6. ✅ Checklist Final

Antes de considerar os testes concluídos, verifique:

- [ ] Código compila sem erros
- [ ] Servidor inicia sem erros
- [ ] Períodos aparecem no dropdown
- [ ] Criar período funciona
- [ ] Trocar período funciona
- [ ] Upload de SPED funciona
- [ ] Upload de estoque inicial funciona
- [ ] Página de ajustes funciona
- [ ] Relatório de ajustes funciona
- [ ] Não há requisições desnecessárias para `/api/periods/*`
- [ ] Dados vêm no HTML inicial
- [ ] Funciona em produção (Vercel)
- [ ] Aba normal e anônima funcionam igual
- [ ] Sem problemas de cache

---

## 🎯 Prioridades de Teste

### 🔴 Crítico (Testar Primeiro)
1. Períodos aparecem corretamente
2. Criar período funciona
3. Trocar período funciona
4. Funciona em produção (Vercel)
5. Aba normal e anônima funcionam igual

### 🟡 Importante (Testar Depois)
1. Upload de arquivos funciona
2. Páginas de ajustes funcionam
3. Vincular arquivos funciona

### 🟢 Desejável (Testar por Último)
1. Performance
2. Logs e debug
3. Edge cases

---

## 📝 Notas

- **Teste local primeiro:** Sempre teste localmente antes de testar em produção
- **Teste em produção:** O problema original era em produção, então é crítico testar lá
- **Compare abas:** O problema original mostrava diferença entre aba normal e anônima - isso deve estar resolvido
- **Verifique Network:** Não deve haver fetches desnecessários para `/api/periods/*`

---

## 🆘 Se Algo Não Funcionar

1. Verifique o console do navegador (F12)
2. Verifique o console do servidor
3. Verifique o Network tab (requisições)
4. Verifique os logs da Vercel (se em produção)
5. Compare com o comportamento anterior (antes da refatoração)

