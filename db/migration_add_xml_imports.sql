-- Tabela para versionar importações de XMLs de venda
create table if not exists xml_sales_imports (
  id uuid primary key default gen_random_uuid(),
  sped_file_id uuid references sped_files(id) on delete cascade,
  label text,
  total_xmls int not null default 0,
  total_items int not null default 0,
  created_at timestamptz not null default now()
);

-- Adicionar coluna xml_import_id na tabela document_items
-- Isso permite vincular cada item de saída à importação que o criou
alter table document_items 
  add column if not exists xml_import_id uuid references xml_sales_imports(id) on delete set null;

-- Índice para melhorar performance nas consultas
create index if not exists idx_document_items_xml_import_id 
  on document_items(xml_import_id);

create index if not exists idx_document_items_movement_type 
  on document_items(movement_type);

