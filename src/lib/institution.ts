/** Identificador padrão do estabelecimento usado nas guias e remessas. */
export const CNES = "2594277";

export type EsferaGestao = "E" | "M";

export interface InstitutionConfig {
  razaoSocial: string;
  nomeFantasia: string;
  sigla: string;
  cnpj: string;
  cnpjMantenedora: string;
  cnes: string;
  ibgeMunicipio: string;
  esferaGestao: EsferaGestao;
  orgaoGestor: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  telefone: string;
  email: string;
  diretorClinico: {
    nome: string;
    crm: string;
    uf: string;
    cns: string;
    cpf: string;
    cbo: string;
  };
  faturista: {
    nome: string;
    cns: string;
    cpf: string;
    cbo: string;
  };
}

export const DEFAULT_INSTITUTION: InstitutionConfig = {
  razaoSocial: "IDEAS - INSTITUTO DE DESENVOLVIMENTO, ENSINO E ASSISTENCIA A SAUDE",
  nomeFantasia: "HOSPITAL MATERNO-INFANTIL SANTA CATARINA - HMISC",
  sigla: "HMISC",
  cnpj: "47.708.771/0026-50",
  cnpjMantenedora: "",
  cnes: CNES,
  ibgeMunicipio: "420460",
  esferaGestao: "E",
  orgaoGestor: "SECRETARIA DE ESTADO DA SAUDE DE SANTA CATARINA",
  logradouro: "Rua Wenceslau Braz",
  numero: "1015",
  complemento: "",
  bairro: "Operária Nova",
  cep: "88809-020",
  municipio: "Criciúma",
  uf: "SC",
  telefone: "",
  email: "",
  diretorClinico: {
    nome: "MANOEL ROBSON DAMIN MONTEIRO",
    crm: "14279",
    uf: "SC",
    cns: "708006369271128",
    cpf: "018.790.629-76",
    cbo: "225125",
  },
  faturista: {
    nome: "",
    cns: "",
    cpf: "",
    cbo: "",
  },
};

export function normalizeInstitution(raw?: Partial<InstitutionConfig> | null): InstitutionConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_INSTITUTION;
  return {
    ...DEFAULT_INSTITUTION,
    ...raw,
    esferaGestao: raw.esferaGestao === "M" ? "M" : "E",
    diretorClinico: { ...DEFAULT_INSTITUTION.diretorClinico, ...(raw.diretorClinico ?? {}) },
    faturista: { ...DEFAULT_INSTITUTION.faturista, ...(raw.faturista ?? {}) },
  };
}