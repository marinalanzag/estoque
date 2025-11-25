-- Tabela de períodos (meses/anos) para organizar o trabalho
create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month >= 1 and month <= 12),
  name text not null, -- ex: "Janeiro 2022"
  description text,
  is_active boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month, name)
);

-- Índices
create index if not exists idx_periods_year_month 
  on public.periods(year, month);
create index if not exists idx_periods_is_active 
  on public.periods(is_active);

-- Comentários
comment on table public.periods is 'Períodos (meses/anos) para organizar o trabalho de inventário';
comment on column public.periods.year is 'Ano do período';
comment on column public.periods.month is 'Mês do período (1-12)';
comment on column public.periods.name is 'Nome do período (ex: "Janeiro 2022")';
comment on column public.periods.is_active is 'Indica se este é o período ativo no momento';

-- Trigger para atualizar updated_at
create or replace function update_periods_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_periods_updated_at
  before update on public.periods
  for each row
  execute function update_periods_updated_at();

-- Adicionar period_id nas tabelas relacionadas
alter table public.sped_files 
  add column if not exists period_id uuid references public.periods(id) on delete set null;

alter table public.stock_initial_imports 
  add column if not exists period_id uuid references public.periods(id) on delete set null;

alter table public.xml_sales_imports 
  add column if not exists period_id uuid references public.periods(id) on delete set null;

alter table public.code_offset_adjustments 
  add column if not exists period_id uuid references public.periods(id) on delete set null;

-- Índices para period_id
create index if not exists idx_sped_files_period_id 
  on public.sped_files(period_id);
create index if not exists idx_stock_initial_imports_period_id 
  on public.stock_initial_imports(period_id);
create index if not exists idx_xml_sales_imports_period_id 
  on public.xml_sales_imports(period_id);
create index if not exists idx_code_offset_adjustments_period_id 
  on public.code_offset_adjustments(period_id);

