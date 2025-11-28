-- ============================================
-- SCRIPT COMPLETO: VIEW inventory_theoretical (VERSÃO CORRIGIDA)
-- Execute este script completo no Supabase SQL Editor
-- ============================================
-- 
-- CORREÇÃO: Esta versão consolida ANTES de fazer JOINs, evitando multiplicação de linhas
-- Cada CTE já está agregado com GROUP BY, garantindo uma linha única por (sped_file_id, cod_item)

-- PASSO 1: Adicionar coluna unit_cost na tabela stock_initial (se não existir)
alter table public.stock_initial 
  add column if not exists unit_cost numeric;

-- Comentário na coluna
comment on column public.stock_initial.unit_cost is 'Custo unitário do item no estoque inicial (usado para calcular valor_inicial)';

-- PASSO 2: Criar/Atualizar VIEW inventory_theoretical (VERSÃO CORRIGIDA)
-- VIEW para calcular inventário teórico com custos
-- Esta VIEW consolida estoque inicial, entradas, saídas e calcula custos médios
-- CONVENÇÃO DE SINAL: movement_qty das saídas é NEGATIVA, então usamos ABS() para obter quantidade positiva
-- 
-- ESTRATÉGIA: Usar CTEs para consolidar ANTES de fazer JOINs, evitando multiplicação de linhas

create table if not exists public.stock_initial_imports (
  id uuid primary key default gen_random_uuid(),
  label text,
  total_items integer,
  total_value numeric,
  created_at timestamptz not null default now()
);

alter table public.stock_initial
  add column if not exists import_id uuid references public.stock_initial_imports(id);

do $$
declare legacy_id uuid;
begin
  if exists (select 1 from public.stock_initial where import_id is null) then
    insert into public.stock_initial_imports (label, total_items, total_value)
    values (
      'Importação legado',
      (select count(*) from public.stock_initial where import_id is null),
      (select coalesce(sum(qtd * coalesce(unit_cost, 0)), 0) from public.stock_initial where import_id is null)
    )
    returning id into legacy_id;

    update public.stock_initial
    set import_id = legacy_id
    where import_id is null;
  end if;
end $$;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  sped_file_id uuid references public.sped_files(id) on delete cascade,
  cod_part text not null,
  name text,
  cnpj text,
  cpf text,
  ie text,
  uf text,
  cod_mun text,
  suframa text,
  endereco text,
  numero text,
  compl text,
  bairro text,
  cep text,
  telefone text,
  email text,
  unique (sped_file_id, cod_part)
);

alter table public.documents
  add column if not exists cod_part text;

alter table public.documents
  add column if not exists partner_id uuid references public.partners(id);

create table if not exists public.document_item_adjustments (
  id uuid primary key default gen_random_uuid(),
  document_item_id uuid references public.document_items(id) on delete cascade,
  adjusted_qty numeric not null,
  reason text,
  updated_at timestamptz not null default now(),
  unique (document_item_id)
);

create or replace view inventory_theoretical as
with 
-- 1) Consolidar estoque inicial por cod_item
-- NOTA: stock_initial não tem sped_file_id, então é global para todos os SPEDs
si as (
  select
    cod_item,
    coalesce(sum(qtd), 0) as estoque_inicial,
    coalesce(sum(qtd * coalesce(unit_cost, 0)), 0) as valor_inicial
  from stock_initial
  group by cod_item
),
-- 2) Consolidar entradas por sped_file_id e cod_item
-- IMPORTANTE: Usar quantidade ajustada quando disponível, senão usar quantidade original
entradas as (
  select
    d.sped_file_id,
    di.cod_item,
    coalesce(sum(
      coalesce(adj.adjusted_qty, abs(di.movement_qty))
    ), 0) as entradas,
    coalesce(sum(
      case
        when adj.adjusted_qty is not null and abs(di.movement_qty) > 0
        then (coalesce(di.vl_item, 0) / abs(di.movement_qty)) * adj.adjusted_qty
        else coalesce(di.vl_item, 0)
      end
    ), 0) as valor_entradas
  from document_items di
  inner join documents d on di.document_id = d.id
  left join document_item_adjustments adj on di.id = adj.document_item_id
  where (di.movement_type = 'entrada' or (di.movement_type is null and d.ind_oper = '0'))
    and di.movement_qty is not null
    and d.sped_file_id is not null
  group by d.sped_file_id, di.cod_item
),
-- 3) Consolidar saídas por sped_file_id e cod_item
-- CONVENÇÃO: movement_qty das saídas é NEGATIVA, então usamos ABS() para obter quantidade positiva
saidas as (
  select
    d.sped_file_id,
    di.cod_item,
    coalesce(sum(abs(di.movement_qty)), 0) as saidas
  from document_items di
  inner join documents d on di.document_id = d.id
  where (di.movement_type = 'saida' or (di.movement_type is null and d.ind_oper = '1'))
    and di.movement_qty is not null
    and d.sped_file_id is not null
  group by d.sped_file_id, di.cod_item
),
-- 4) Consolidar produtos por sped_file_id e cod_item (para pegar descrição)
produtos as (
  select
    sped_file_id,
    cod_item,
    max(descr_item) as descr_item  -- Se houver múltiplas descrições, pega uma
  from products
  where sped_file_id is not null
  group by sped_file_id, cod_item
),
-- 5) Lista de todos os itens únicos (sped_file_id, cod_item) que aparecem no sistema
-- UNION já remove duplicatas automaticamente, mas vamos garantir com DISTINCT
all_items as (
  select distinct sped_file_id, cod_item
  from (
    -- Itens que aparecem em products
    select sped_file_id, cod_item
    from products
    where sped_file_id is not null
    
    union
    
    -- Itens que aparecem em document_items
    select distinct d.sped_file_id, di.cod_item
    from document_items di
    inner join documents d on di.document_id = d.id
    where d.sped_file_id is not null
  ) as items_union
)
-- 6) JOIN final: unir todas as consolidações
select
  ai.sped_file_id,
  ai.cod_item,
  coalesce(p.descr_item, '[Sem descrição]') as descr_item,
  coalesce(si.estoque_inicial, 0) as estoque_inicial,
  coalesce(e.entradas, 0) as entradas,
  coalesce(s.saidas, 0) as saidas,
  -- Estoque teórico: estoque_inicial + entradas - saidas
  coalesce(si.estoque_inicial, 0) + coalesce(e.entradas, 0) - coalesce(s.saidas, 0) as estoque_teorico,
  coalesce(si.valor_inicial, 0) as valor_inicial,
  coalesce(e.valor_entradas, 0) as valor_entradas,
  -- Custo médio unitário: (valor_inicial + valor_entradas) / (estoque_inicial + entradas)
  case
    when (coalesce(si.estoque_inicial, 0) + coalesce(e.entradas, 0)) > 0
    then (coalesce(si.valor_inicial, 0) + coalesce(e.valor_entradas, 0)) / 
         nullif(coalesce(si.estoque_inicial, 0) + coalesce(e.entradas, 0), 0)
    else null
  end as custo_medio_unitario,
  -- Valor do estoque: estoque_teorico * custo_medio_unitario
  -- IMPORTANTE: Valores negativos são ignorados (retorna 0) - não podem ser usados para contagem
  case
    when (coalesce(si.estoque_inicial, 0) + coalesce(e.entradas, 0)) > 0
      and (coalesce(si.estoque_inicial, 0) + coalesce(e.entradas, 0) - coalesce(s.saidas, 0)) > 0
    then (
      coalesce(si.estoque_inicial, 0) + coalesce(e.entradas, 0) - coalesce(s.saidas, 0)
    ) * (
      (coalesce(si.valor_inicial, 0) + coalesce(e.valor_entradas, 0)) / 
      nullif(coalesce(si.estoque_inicial, 0) + coalesce(e.entradas, 0), 0)
    )
    else 0  -- Retorna 0 para estoques negativos ou sem entradas (não considerados no total)
  end as valor_estoque
from all_items ai
-- LEFT JOINs: cada CTE já está consolidado, então não há multiplicação de linhas
left join produtos p 
  on ai.sped_file_id = p.sped_file_id 
  and ai.cod_item = p.cod_item
left join si 
  on ai.cod_item = si.cod_item
left join entradas e 
  on ai.sped_file_id = e.sped_file_id 
  and ai.cod_item = e.cod_item
left join saidas s 
  on ai.sped_file_id = s.sped_file_id 
  and ai.cod_item = s.cod_item;
-- REMOVIDO filtro WHERE: TODOS os itens devem aparecer na consolidação, independente de movimentação
-- Todos os itens que aparecem em products ou document_items serão mostrados

-- Comentários para documentação
comment on view inventory_theoretical is 'View que consolida inventário teórico com cálculos de custos médios e valores totais por item e sped_file_id. Usa CTEs para consolidar antes de fazer JOINs, evitando multiplicação de linhas. CONVENÇÃO: movement_qty das saídas é NEGATIVA, então usamos ABS() para obter quantidade positiva. REGRA DE NEGÓCIO: Valores negativos são ignorados (valor_estoque = 0 quando estoque_teorico <= 0). TODOS os itens aparecem na consolidação, independente de movimentação.';
