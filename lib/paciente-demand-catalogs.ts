
export type MunicipalityOption = {
  id: string
  ibge: string
  name: string
  uf: string
}

export type SpecialtyOption = {
  name: string
  subSpecialties: string[]
}

export type ProcedureCatalogItem = {
  sigtapCode: string
  description: string
  specialty: string
  subSpecialty: string
}

export type CidCatalogItem = {
  code: string
  description: string
}

export type ProcedureSituation = "determinado" | "cumprido" | "encerrado"

export const MUNICIPALITY_OPTIONS: MunicipalityOption[] = [
  { id: "mun_cg", ibge: "5002704", name: "Campo Grande", uf: "MS" },
  { id: "mun_dou", ibge: "5003702", name: "Dourados", uf: "MS" },
  { id: "mun_tres", ibge: "5008305", name: "Três Lagoas", uf: "MS" },
  { id: "mun_corumba", ibge: "5003207", name: "Corumbá", uf: "MS" },
  { id: "mun_paranaiba", ibge: "5006309", name: "Paranaíba", uf: "MS" },
  { id: "mun_pontapora", ibge: "5006606", name: "Ponta Porã", uf: "MS" },
  { id: "mun_coxim", ibge: "5003306", name: "Coxim", uf: "MS" },
  { id: "mun_navirai", ibge: "5005707", name: "Naviraí", uf: "MS" },
]

export const SPECIALTY_OPTIONS: SpecialtyOption[] = [
  { name: "Cardiologia", subSpecialties: ["Arritmologia", "Hemodinâmica", "Cardiologia Clínica"] },
  { name: "Ortopedia", subSpecialties: ["Joelho", "Quadril", "Coluna", "Ombro"] },
  { name: "Neurologia", subSpecialties: ["Epilepsia", "AVC", "Neurovascular", "Cefaleia"] },
  { name: "Nefrologia", subSpecialties: ["Dialise", "Transplante", "Doença Renal Crônica"] },
  { name: "Oncologia", subSpecialties: ["Clínica", "Cirúrgica", "Ginecológica"] },
  { name: "Oftalmologia", subSpecialties: ["Catarata", "Retina", "Glaucoma"] },
  { name: "Cirurgia Geral", subSpecialties: ["Hérnia", "Colecistectomia", "Proctologia"] },
]

export const PROCEDURE_CATALOG: ProcedureCatalogItem[] = [
  { sigtapCode: "0211060011", description: "Consulta em Cardiologia", specialty: "Cardiologia", subSpecialty: "Cardiologia Clínica" },
  { sigtapCode: "0211060216", description: "Consulta em Ortopedia", specialty: "Ortopedia", subSpecialty: "Joelho" },
  { sigtapCode: "0211060291", description: "Consulta em Neurologia", specialty: "Neurologia", subSpecialty: "Epilepsia" },
  { sigtapCode: "0403010024", description: "Cirurgia Ortopédica de Joelho", specialty: "Ortopedia", subSpecialty: "Joelho" },
  { sigtapCode: "0403010032", description: "Substituição Total de Quadril", specialty: "Ortopedia", subSpecialty: "Quadril" },
  { sigtapCode: "0406010030", description: "Revascularização do Miocárdio", specialty: "Cardiologia", subSpecialty: "Hemodinâmica" },
  { sigtapCode: "0504010014", description: "Transplante Renal", specialty: "Nefrologia", subSpecialty: "Transplante" },
  { sigtapCode: "0305010107", description: "Hemodiálise - até 3 sessões/semana", specialty: "Nefrologia", subSpecialty: "Dialise" },
  { sigtapCode: "0405030011", description: "Facectomia com implante de lente intraocular", specialty: "Oftalmologia", subSpecialty: "Catarata" },
  { sigtapCode: "0407030027", description: "Hernioplastia Inguinal", specialty: "Cirurgia Geral", subSpecialty: "Hérnia" },
]

export const CID_CATALOG: CidCatalogItem[] = [
  { code: "I49.9", description: "Arritmia cardíaca não especificada" },
  { code: "I25.1", description: "Doença aterosclerótica do coração" },
  { code: "M17.1", description: "Gonartrose primária unilateral" },
  { code: "M16.0", description: "Coxartrose primária bilateral" },
  { code: "N18.5", description: "Doença renal crônica estágio 5" },
  { code: "G40.9", description: "Epilepsia não especificada" },
  { code: "H25.1", description: "Catarata senil nuclear" },
  { code: "K40.9", description: "Hérnia inguinal unilateral sem obstrução" },
]

export function getSubSpecialties(specialty: string) {
  return SPECIALTY_OPTIONS.find((item) => item.name === specialty)?.subSpecialties ?? []
}

export function calculateDeadlineAt(receivedAt: string, deadlineDays: number) {
  if (!receivedAt || !deadlineDays || Number.isNaN(deadlineDays)) return ""
  const d = new Date(`${receivedAt}T00:00:00`)
  d.setDate(d.getDate() + deadlineDays)
  return d.toISOString().slice(0, 10)
}

export function municipalityLabel(item: MunicipalityOption) {
  return `${item.ibge} - ${item.name}/${item.uf}`
}
