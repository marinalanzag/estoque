create extension if not exists "uuid-ossp";

create table if not exists public.stock_initial (
  id uuid primary key default uuid_generate_v4(),
  cod_item text not null,
  descr_item text,
  qtd numeric not null,
  unid text,
  unit_cost numeric, -- Custo unitário do item no estoque inicial
  created_at timestamptz not null default now()
);

-- Adicionar coluna unit_cost se a tabela já existir
alter table public.stock_initial 
  add column if not exists unit_cost numeric;
