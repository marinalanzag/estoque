# ✅ Checklist Rápido - Deploy no Vercel

## Antes de Começar

- [ ] Tenho conta no Vercel
- [ ] Tenho conta no Supabase
- [ ] Tenho acesso ao projeto Supabase
- [ ] Código está no GitHub

## Passo 1: Credenciais do Supabase

- [ ] Acessei o Supabase (app.supabase.com)
- [ ] Copiei a **Project URL** (Settings → API)
- [ ] Copiei a **service_role key** (Settings → API)
- [ ] Anotei as credenciais em local seguro

## Passo 2: Vercel

- [ ] Acessei vercel.com e fiz login
- [ ] Cliquei em "Add New Project"
- [ ] Importei o repositório do GitHub
- [ ] Configurei as variáveis de ambiente:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` = URL do Supabase
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` = Service Role Key
- [ ] Cliquei em "Deploy"

## Passo 3: Verificação

- [ ] Build foi bem-sucedido
- [ ] Site está acessível
- [ ] Testei `/api/test-supabase` (deve retornar `{"ok": true}`)
- [ ] Testei upload de SPED
- [ ] Testei aba Entradas
- [ ] Testei aba Consolidação

## Pronto! 🎉

- [ ] Sistema está funcionando
- [ ] Deploy automático está ativo
- [ ] Anotei a URL do site

---

**URL do site**: _________________________

**Data do deploy**: _________________________



