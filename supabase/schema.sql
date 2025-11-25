create table if not exists sped_files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int,
  period text,
  uploaded_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sped_file_id uuid references sped_files(id) on delete cascade,
  cod_item text not null,
  descr_item text not null,
  unid_inv text,
  tp_item text,
  cod_ncm text,
  cod_gen text,
  cod_lst text,
  aliq_icms numeric,
  unique (sped_file_id, cod_item)
);

create table if not exists product_conversions (
  id uuid primary key default gen_random_uuid(),
  sped_file_id uuid references sped_files(id) on delete cascade,
  cod_item text not null,
  unid_conv text not null,
  fat_conv numeric not null,
  unique (sped_file_id, cod_item, unid_conv)
);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  sped_file_id uuid references sped_files(id) on delete cascade,
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

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  sped_file_id uuid references sped_files(id) on delete cascade,
  ind_oper text,
  cod_part text,
  partner_id uuid references partners(id),
  cod_mod text,
  cod_sit text,
  serie text,
  num_doc text,
  chv_nfe text,
  dt_doc date,
  dt_e_s date,
  vl_doc numeric
);

create table if not exists document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  num_item int,
  cod_item text not null,
  descr_compl text,
  qtd numeric,
  unid text,
  vl_item numeric,
  cfop text,
  movement_type text,
  movement_qty numeric
);

create table if not exists document_item_adjustments (
  id uuid primary key default gen_random_uuid(),
  document_item_id uuid references document_items(id) on delete cascade,
  adjusted_qty numeric not null,
  reason text,
  updated_at timestamptz not null default now(),
  unique (document_item_id)
);

create table if not exists inventories (
  id uuid primary key default gen_random_uuid(),
  sped_file_id uuid references sped_files(id) on delete cascade,
  dt_inv date not null,
  motive text,
  vl_inv numeric
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid references inventories(id) on delete cascade,
  cod_item text not null,
  unid text,
  qtd numeric,
  vl_unit numeric,
  vl_item numeric
);

