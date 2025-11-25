-- Migration: Adicionar coluna unit_cost na tabela stock_initial
-- Execute este SQL no Supabase se a tabela stock_initial já existir

alter table public.stock_initial 
  add column if not exists unit_cost numeric;

-- Comentário na coluna
comment on column public.stock_initial.unit_cost is 'Custo unitário do item no estoque inicial (usado para calcular valor_inicial)';

