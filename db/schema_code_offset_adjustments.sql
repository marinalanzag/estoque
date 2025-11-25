-- Tabela para registrar ajustes de códigos (transferência de saldo positivo para negativo)
create table if not exists public.code_offset_adjustments (
  id uuid primary key default gen_random_uuid(),
  sped_file_id uuid not null references sped_files(id) on delete cascade,
  cod_negativo text not null,
  cod_positivo text not null,
  qtd_baixada numeric not null,
  unit_cost numeric not null,
  total_value numeric not null,
  created_at timestamptz not null default now(),
  created_by text,
  constraint qtd_baixada_positive check (qtd_baixada > 0),
  constraint unit_cost_positive check (unit_cost >= 0),
  constraint total_value_positive check (total_value >= 0)
);

-- Índices para melhor performance
create index if not exists idx_code_offset_adjustments_sped_file_id 
  on public.code_offset_adjustments(sped_file_id);
create index if not exists idx_code_offset_adjustments_cod_negativo 
  on public.code_offset_adjustments(cod_negativo);
create index if not exists idx_code_offset_adjustments_cod_positivo 
  on public.code_offset_adjustments(cod_positivo);

-- Comentários
comment on table public.code_offset_adjustments is 'Registra ajustes de transferência de saldo de códigos positivos para negativos';
comment on column public.code_offset_adjustments.cod_negativo is 'Código do item que estava com saldo negativo';
comment on column public.code_offset_adjustments.cod_positivo is 'Código do item usado para cobrir o negativo';
comment on column public.code_offset_adjustments.qtd_baixada is 'Quantidade transferida do positivo para o negativo';
comment on column public.code_offset_adjustments.unit_cost is 'Custo unitário usado na baixa (puxado do código positivo)';
comment on column public.code_offset_adjustments.total_value is 'Valor total da baixa (qtd_baixada * unit_cost)';

