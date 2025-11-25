-- Tabela para cadastro fixo de produtos (usado como fallback para descrições)
-- Este cadastro é global e não está vinculado a um SPED específico
create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  cod_item text not null unique,
  descr_item text not null,
  unid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice para busca rápida por código
create index if not exists idx_product_catalog_cod_item 
  on public.product_catalog(cod_item);

-- Comentários
comment on table public.product_catalog is 'Cadastro fixo de produtos usado como fallback para descrições quando não encontradas no SPED';
comment on column public.product_catalog.cod_item is 'Código do item (normalizado para 6 dígitos)';
comment on column public.product_catalog.descr_item is 'Descrição do produto';
comment on column public.product_catalog.unid is 'Unidade de medida';

-- Trigger para atualizar updated_at
create or replace function update_product_catalog_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_product_catalog_updated_at
  before update on public.product_catalog
  for each row
  execute function update_product_catalog_updated_at();

