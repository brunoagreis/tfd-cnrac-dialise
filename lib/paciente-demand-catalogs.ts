
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

export const MUNICIPALITY_OPTIONS = [
  { id: "agua-clara", ibge: "5000203", name: "Água Clara", uf: "MS" },
  { id: "alcinopolis", ibge: "5000252", name: "Alcinópolis", uf: "MS" },
  { id: "amambai", ibge: "5000609", name: "Amambai", uf: "MS" },
  { id: "anastacio", ibge: "5000708", name: "Anastácio", uf: "MS" },
  { id: "anaurilandia", ibge: "5000807", name: "Anaurilândia", uf: "MS" },
  { id: "angelica", ibge: "5000856", name: "Angélica", uf: "MS" },
  { id: "antonio-joao", ibge: "5000906", name: "Antônio João", uf: "MS" },
  { id: "aparecida-do-taboado", ibge: "5001003", name: "Aparecida do Taboado", uf: "MS" },
  { id: "aquidauana", ibge: "5001102", name: "Aquidauana", uf: "MS" },
  { id: "aral-moreira", ibge: "5001243", name: "Aral Moreira", uf: "MS" },
  { id: "bandeirantes", ibge: "5001508", name: "Bandeirantes", uf: "MS" },
  { id: "bataguassu", ibge: "5001904", name: "Bataguassu", uf: "MS" },
  { id: "bataypora", ibge: "5002001", name: "Batayporã", uf: "MS" },
  { id: "bela-vista", ibge: "5002100", name: "Bela Vista", uf: "MS" },
  { id: "bodoquena", ibge: "5002159", name: "Bodoquena", uf: "MS" },
  { id: "bonito", ibge: "5002209", name: "Bonito", uf: "MS" },
  { id: "brasilandia", ibge: "5002308", name: "Brasilândia", uf: "MS" },
  { id: "caarapo", ibge: "5002407", name: "Caarapó", uf: "MS" },
  { id: "camapua", ibge: "5002605", name: "Camapuã", uf: "MS" },
  { id: "campo-grande", ibge: "5002704", name: "Campo Grande", uf: "MS" },
  { id: "caracol", ibge: "5002803", name: "Caracol", uf: "MS" },
  { id: "cassilandia", ibge: "5002902", name: "Cassilândia", uf: "MS" },
  { id: "chapadao-do-sul", ibge: "5002951", name: "Chapadão do Sul", uf: "MS" },
  { id: "corguinho", ibge: "5003108", name: "Corguinho", uf: "MS" },
  { id: "coronel-sapucaia", ibge: "5003157", name: "Coronel Sapucaia", uf: "MS" },
  { id: "corumba", ibge: "5003207", name: "Corumbá", uf: "MS" },
  { id: "costa-rica", ibge: "5003256", name: "Costa Rica", uf: "MS" },
  { id: "coxim", ibge: "5003306", name: "Coxim", uf: "MS" },
  { id: "deodapolis", ibge: "5003454", name: "Deodápolis", uf: "MS" },
  { id: "dois-irmaos-do-buriti", ibge: "5003488", name: "Dois Irmãos do Buriti", uf: "MS" },
  { id: "douradina", ibge: "5003504", name: "Douradina", uf: "MS" },
  { id: "dourados", ibge: "5003702", name: "Dourados", uf: "MS" },
  { id: "eldorado", ibge: "5003751", name: "Eldorado", uf: "MS" },
  { id: "fatima-do-sul", ibge: "5003801", name: "Fátima do Sul", uf: "MS" },
  { id: "figueirao", ibge: "5003900", name: "Figueirão", uf: "MS" },
  { id: "gloria-de-dourados", ibge: "5004007", name: "Glória de Dourados", uf: "MS" },
  { id: "guia-lopes-da-laguna", ibge: "5004106", name: "Guia Lopes da Laguna", uf: "MS" },
  { id: "iguatemi", ibge: "5004304", name: "Iguatemi", uf: "MS" },
  { id: "inocencia", ibge: "5004403", name: "Inocência", uf: "MS" },
  { id: "itapora", ibge: "5004502", name: "Itaporã", uf: "MS" },
  { id: "itaquirai", ibge: "5004601", name: "Itaquiraí", uf: "MS" },
  { id: "ivinhema", ibge: "5004700", name: "Ivinhema", uf: "MS" },
  { id: "japora", ibge: "5004809", name: "Japorã", uf: "MS" },
  { id: "jaraguari", ibge: "5004908", name: "Jaraguari", uf: "MS" },
  { id: "jardim", ibge: "5005004", name: "Jardim", uf: "MS" },
  { id: "jatei", ibge: "5005103", name: "Jateí", uf: "MS" },
  { id: "juti", ibge: "5005152", name: "Juti", uf: "MS" },
  { id: "ladario", ibge: "5005202", name: "Ladário", uf: "MS" },
  { id: "laguna-carapa", ibge: "5005251", name: "Laguna Carapã", uf: "MS" },
  { id: "maracaju", ibge: "5005400", name: "Maracaju", uf: "MS" },
  { id: "miranda", ibge: "5005608", name: "Miranda", uf: "MS" },
  { id: "mundo-novo", ibge: "5005681", name: "Mundo Novo", uf: "MS" },
  { id: "navirai", ibge: "5005707", name: "Naviraí", uf: "MS" },
  { id: "nioaque", ibge: "5005806", name: "Nioaque", uf: "MS" },
  { id: "nova-alvorada-do-sul", ibge: "5006002", name: "Nova Alvorada do Sul", uf: "MS" },
  { id: "nova-andradina", ibge: "5006200", name: "Nova Andradina", uf: "MS" },
  { id: "novo-horizonte-do-sul", ibge: "5006259", name: "Novo Horizonte do Sul", uf: "MS" },
  { id: "paraiso-das-aguas", ibge: "5006275", name: "Paraíso das Águas", uf: "MS" },
  { id: "paranaiba", ibge: "5006309", name: "Paranaíba", uf: "MS" },
  { id: "paranhos", ibge: "5006358", name: "Paranhos", uf: "MS" },
  { id: "pedro-gomes", ibge: "5006408", name: "Pedro Gomes", uf: "MS" },
  { id: "ponta-pora", ibge: "5006606", name: "Ponta Porã", uf: "MS" },
  { id: "porto-murtinho", ibge: "5006903", name: "Porto Murtinho", uf: "MS" },
  { id: "ribas-do-rio-pardo", ibge: "5007109", name: "Ribas do Rio Pardo", uf: "MS" },
  { id: "rio-brilhante", ibge: "5007208", name: "Rio Brilhante", uf: "MS" },
  { id: "rio-negro", ibge: "5007307", name: "Rio Negro", uf: "MS" },
  { id: "rio-verde-de-mato-grosso", ibge: "5007406", name: "Rio Verde de Mato Grosso", uf: "MS" },
  { id: "rochedo", ibge: "5007505", name: "Rochedo", uf: "MS" },
  { id: "santa-rita-do-pardo", ibge: "5007554", name: "Santa Rita do Pardo", uf: "MS" },
  { id: "sao-gabriel-do-oeste", ibge: "5007695", name: "São Gabriel do Oeste", uf: "MS" },
  { id: "sete-quedas", ibge: "5007703", name: "Sete Quedas", uf: "MS" },
  { id: "selviria", ibge: "5007802", name: "Selvíria", uf: "MS" },
  { id: "sidrolandia", ibge: "5007901", name: "Sidrolândia", uf: "MS" },
  { id: "sonora", ibge: "5007935", name: "Sonora", uf: "MS" },
  { id: "tacuru", ibge: "5007950", name: "Tacuru", uf: "MS" },
  { id: "taquarussu", ibge: "5007976", name: "Taquarussu", uf: "MS" },
  { id: "terenos", ibge: "5008008", name: "Terenos", uf: "MS" },
  { id: "tres-lagoas", ibge: "5008305", name: "Três Lagoas", uf: "MS" },
  { id: "vicentina", ibge: "5008404", name: "Vicentina", uf: "MS" },
] as const

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
