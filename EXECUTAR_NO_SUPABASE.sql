-- ============================================================
-- MIGRAÇÃO COMPLETA PARA CORRIGIR SISTEMA DE PERÍODOS
-- Execute este arquivo completo no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PARTE 1: Adicionar campo label na tabela periods
-- ============================================================

alter table public.periods 
  add column if not exists label text;

-- Se label não existir mas name existir, copiar name para label
update public.periods 
set label = name 
where label is null and name is not null;

-- Criar índice para label
create index if not exists idx_periods_label 
  on public.periods(label);

-- ============================================================
-- PARTE 2: Adicionar campo is_base em sped_files
-- ============================================================

alter table public.sped_files 
  add column if not exists is_base boolean default false;

-- Criar índice para is_base
create index if not exists idx_sped_files_is_base 
  on public.sped_files(is_base);

-- Criar índice composto para period_id + is_base
create index if not exists idx_sped_files_period_base 
  on public.sped_files(period_id, is_base) 
  where is_base = true;

-- ============================================================
-- PARTE 3: Adicionar campo is_base em xml_sales_imports
-- ============================================================

alter table public.xml_sales_imports 
  add column if not exists is_base boolean default false;

-- Criar índice para is_base
create index if not exists idx_xml_sales_imports_is_base 
  on public.xml_sales_imports(is_base);

-- Criar índice composto para period_id + is_base
create index if not exists idx_xml_sales_imports_period_base 
  on public.xml_sales_imports(period_id, is_base) 
  where is_base = true;

-- ============================================================
-- PARTE 4: Adicionar campo is_base em stock_initial_imports
-- ⚠️ ESTA É A PARTE MAIS IMPORTANTE PARA RESOLVER O PROBLEMA
-- ============================================================

alter table public.stock_initial_imports 
  add column if not exists is_base boolean default false;

-- Criar índice para is_base
create index if not exists idx_stock_initial_imports_is_base 
  on public.stock_initial_imports(is_base);

-- Criar índice composto para period_id + is_base
create index if not exists idx_stock_initial_imports_period_base 
  on public.stock_initial_imports(period_id, is_base) 
  where is_base = true;

-- ============================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================

comment on column public.periods.label is 'Label do período no formato "Jan/2022", "Fev/2025", etc.';
comment on column public.sped_files.is_base is 'Indica se este SPED é o arquivo base do período (usado por padrão nas consultas)';
comment on column public.xml_sales_imports.is_base is 'Indica se esta importação de XML é a base do período (usada por padrão na consolidação)';
comment on column public.stock_initial_imports.is_base is 'Indica se esta importação de estoque inicial é a base do período (usada por padrão na consolidação)';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================

