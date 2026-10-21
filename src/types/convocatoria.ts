export interface ConvocatoriaItem {
  id?: number | string;
  idConvocatoria?: number | string;
  codigo?: string;
  numeroConvocatoria?: string;
  cargo?: string;
  puesto?: string;
  descripcion?: string;
  rubro?: string;
  odpe?: string;
  departamento?: string;
  remuneracion?: number | string;
  fechaPublicacion?: string;
  fechaInicioPostulacion?: string;
  fechaFinPostulacion?: string;
  urlBases?: string;
  [key: string]: unknown;
}

export interface ConvocatoriasPageResponse {
  rows: ConvocatoriaItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export interface OnpeApiResponse {
  success: boolean;
  message: string;
  messageInterno?: string | null;
  titulo?: string | null;
  tipoIcono?: string | null;
  data?: {
    convocatoriasPage?: ConvocatoriasPageResponse;
  };
}

export interface ConvocatoriaFilterPayload {
  tipoConvocatoria: number;
  idRubro: number;
  idDepartamento: number;
  idLugarEjecucion: number;
  idOdp: number;
  fechaPublicacion: {
    start: string | null;
    end: string | null;
  };
  page: number;
  pageSize: number;
  palabraClave: string | null;
  verConcluidas: boolean;
}
