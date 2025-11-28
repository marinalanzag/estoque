-- Registra metadados das importações do cadastro de produtos
create table if not exists public.product_catalog_imports (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references public.periods(id) on delete set null,
  label text,
  file_name text,
  total_items int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_catalog_imports_period_id
  on public.product_catalog_imports(period_id);

comment on table public.product_catalog_imports is 'Histórico das importações do cadastro de produtos para cada período ativo';
comment on column public.product_catalog_imports.label is 'Descrição amigável definida pelo usuário';
comment on column public.product_catalog_imports.file_name is 'Nome original do arquivo importado';
comment on column public.product_catalog_imports.total_items is 'Total de itens processados na importação';





