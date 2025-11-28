export interface ConsolidatedRow {
  cod_item: string;
  descr_item: string;
  unidade?: string | null;
  qtd_inicial: number;
  valor_inicial: number;
  entradas: number;
  valor_entradas: number;
  saidas: number;
  qtd_final: number;
  custo_medio: number | null;
  valor_total: number;
}

export interface ConsolidadoPorCodigo extends ConsolidatedRow {
  valor_saidas: number;
}


