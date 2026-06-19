import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JudicialDetailRow = {
  monitoramentoId: string
  demandaId: string | null
  pacienteId: string | null
  fichaCore: string | null
  nomePacienteBase: string | null
  cpfBase: string | null
  cnsBase: string | null
  procedimentoCodigoBase: string | null
  procedimentoDescricaoBase: string | null
  cidCodigoBase: string | null
  cidDescricaoBase: string | null
  statusMonitoramentoAtual: string | null
  dataUltimoMonitoramento: string | null
  ativoMonitoramento: boolean | null
  origemModulo: string | null
  origemTabela: string | null
  origemRegistroId: string | null
  createdAtBase: string | null
  updatedAtBase: string | null

  protocolo: string | null
  modulo: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
  especialidade: string | null
  subespecialidade: string | null
  observacoesUnidade: string | null
  localSolicitado: string | null
  criadoPor: string | null
  criadoPorNome: string | null
  createdAtDemanda: string | null
  updatedAtDemanda: string | null

  pacienteNome: string | null
  pacienteCpf: string | null
  pacienteCartaoSus: string | null
  pacienteMunicipio: string | null
  pacienteEmail: string | null
  pacienteEndereco: string | null
}

type InteracaoRow = {
  id: string
  texto: string | null
  pendencia: string | null
  createdAt: string | null
  createdBy: string | null
  createdByName: string | null
  createdByCpf: string | null
}

type AnexoRow = {
  id: string
  nome: string | null
  tipo: string | null
  tamanho: number | null
  categoria: string | null
  descricao: string | null
  criadoPor: string | null
  criadoPorNome: string | null
  createdAt: string | null
  arquivoNomeOriginal: string | null
  arquivoPath: string | null
  mimeType: string | null
}

type MunicipioContatoRow = {
  id: string
  municipioNome: string | null
  emails: unknown
  telefones: unknown
  contatos: unknown
  updatedAt: string | null
}

type JudicialFinalizacaoRow = {
  id: string
  status: string | null
  pendingLocation: string | null
  reason: string | null
  valorEstado: string | number | null
  valorMunicipio: string | number | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string | null
}

type JudicialStatusProcessoRow = {
  id: string
  status: string | null
  reason: string | null
  deadlineType: string | null
  deadlineValue: number | null
  prazoInicio: string | null
  prazoDescricao: string | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string | null
}

type JudicialProcessoVinculadoRow = {
  id: string
  tipo: string | null
  numero: string | null
  ativo: boolean | null
  createdAt: string | null
}

type JudicialFichaRow = {
  id: string
  system: string | null
  number: string | null
  requestedInclusion: boolean | null
  hasJudicialMark: boolean | null
  attachmentName: string | null
  attachmentUrl: string | null
  attachmentRelativePath: string | null
  notes: string | null
  active: boolean | null
  status: string | null
  statusReason: string | null
  statusUpdatedAt: string | null
  statusUpdatedByName: string | null
  inactiveReason: string | null
  createdAt: string | null
  createdByName: string | null
  updatedAt: string | null
  updatedByName: string | null
}

type JudicialProcedimentoRow = {
  id: string
  sigtapId: string | null
  sigtapCode: string | null
  description: string | null
  specialty: string | null
  subSpecialty: string | null
  active: boolean | null
  inactiveReason: string | null
  createdAt: string | null
  createdByName: string | null
  updatedAt: string | null
  updatedByName: string | null
}

type JudicialMovimentacaoRow = {
  id: string
  type: string | null
  description: string | null
  appointmentDate: string | null
  responseRequestedAt: string | null
  stateAmount: string | number | null
  municipalityAmount: string | number | null
  attachments: unknown
  createdBy: string | null
  createdByName: string | null
  createdAt: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function splitCatalogValues(value: unknown) {
  return text(value)
    .split(/[|;\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean)
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => text(item)).filter(Boolean)
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  return []
}

function mapCaseStatus(value: unknown) {
  const status = text(value).toLowerCase()

  if (["cumprido", "resolvido", "finalizado", "finalizada"].includes(status)) {
    return "cumprido"
  }

  if (["descumprido", "descumprimento"].includes(status)) {
    return "descumprido"
  }

  if (["encerrado", "encerrada", "obito", "óbito"].includes(status)) {
    return "encerrado"
  }

  if (["agendado", "agendada"].includes(status)) {
    return "agendado"
  }

  if (["aguardando_agendamento", "aguardando agendamento"].includes(status)) {
    return "aguardando_agendamento"
  }

  return "ativo"
}

function mapFinalizationStatus(value: unknown) {
  const status = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (status === "resolvido") return "resolvido"
  if (status === "bloqueio") return "bloqueio"
  if (status === "sequestro") return "sequestro"
  if (status === "obito") return "obito"
  if (status === "arquivado") return "arquivado"
  if (status === "devolvida" || status === "devolvido") return "devolvida"

  return "pendente"
}

function mapProcessStatus(value: unknown) {
  const status = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (status === "descumprimento" || status === "descumprido") {
    return "descumprimento"
  }

  if (
    status === "decisao_judicial_prazo" ||
    status === "decisao judicial com prazo" ||
    status === "decisao_com_prazo"
  ) {
    return "decisao_judicial_prazo"
  }

  return "em_andamento"
}

function mapFichaSystem(value: unknown): "CORE" | "SISREG" | "OUTRO" {
  const system = text(value).toUpperCase()

  if (system === "SISREG") return "SISREG"
  if (system === "OUTRO") return "OUTRO"

  return "CORE"
}

function mapAttachmentCategory(value: unknown) {
  const category = text(value).toLowerCase()

  if (category === "ficha") return "ficha"
  if (category === "manifestacao" || category === "manifestação") return "manifestacao"
  if (category === "oficio" || category === "ofício") return "oficio"
  if (category === "comprovante") return "comprovante"
  if (
    category === "monitoramento" ||
    category === "movimentacao" ||
    category === "movimentação"
  ) {
    return "monitoramento"
  }

  return "outros"
}

function buildFileUrl(relativePath: string) {
  const cleanPath = relativePath.replace(/^\/+/, "").replaceAll("\\", "/")
  return encodeURI(`/api/files/${cleanPath}`)
}

function finalizationLabel(value: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    resolvido: "Resolvido",
    bloqueio: "Bloqueio",
    sequestro: "Sequestro",
    obito: "Óbito",
    devolvida: "Devolvida",
  }

  return labels[value] || "Pendente"
}

function formatMoney(value: string | number | null) {
  if (value === null || value === undefined || value === "") return ""

  const number = Number(value)
  if (!Number.isFinite(number)) return ""

  return number.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function movementAttachments(
  value: unknown,
  createdAt: string,
  createdByName: string,
) {
  let items: unknown[] = []

  if (Array.isArray(value)) {
    items = value
  } else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      items = Array.isArray(parsed) ? parsed : []
    } catch {
      items = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  return items
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `mov-att-${index}-${item}`,
          name: item,
          category: "monitoramento",
          createdAt,
          createdById: "sistema",
          createdByName,
          source: "movimentacao",
        }
      }

      if (!item || typeof item !== "object") return null

      const record = item as Record<string, unknown>
      const name = text(record.name || record.storedName || record.relativePath || "Arquivo")
      const relativePath = text(record.relativePath || record.path)
      const url = text(record.url) || (relativePath ? buildFileUrl(relativePath) : undefined)

      return {
        id: text(record.id) || `mov-att-${index}-${name}`,
        name,
        category: "monitoramento",
        createdAt,
        createdById: text(record.createdById || "sistema"),
        createdByName,
        source: "movimentacao",
        storedName: text(record.storedName) || undefined,
        relativePath: relativePath || undefined,
        url,
        mimeType: text(record.mimeType) || undefined,
        size: Number.isFinite(Number(record.size)) ? Number(record.size) : undefined,
      }
    })
    .filter(Boolean)
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)

    const rows = await prisma.$queryRawUnsafe<JudicialDetailRow[]>(
      `
        SELECT
          b.id::text AS "monitoramentoId",
          b.demanda_id::text AS "demandaId",
          b.paciente_id::text AS "pacienteId",
          b.ficha_core AS "fichaCore",
          b.nome_paciente AS "nomePacienteBase",
          b.cpf AS "cpfBase",
          b.cns AS "cnsBase",
          b.procedimento_codigo AS "procedimentoCodigoBase",
          b.procedimento_descricao AS "procedimentoDescricaoBase",
          b.cid_codigo AS "cidCodigoBase",
          b.cid_descricao AS "cidDescricaoBase",
          b.status_monitoramento_atual AS "statusMonitoramentoAtual",
          b.data_ultimo_monitoramento::text AS "dataUltimoMonitoramento",
          b.ativo_monitoramento AS "ativoMonitoramento",
          b.origem_modulo AS "origemModulo",
          b.origem_tabela AS "origemTabela",
          b.origem_registro_id AS "origemRegistroId",
          b.created_at::text AS "createdAtBase",
          b.updated_at::text AS "updatedAtBase",

          d.protocolo::text AS protocolo,
          LOWER(COALESCE(d.modulo::text, 'judicial')) AS modulo,
          d."codigoSigtap" AS "codigoSigtap",
          d."descricaoSigtap" AS "descricaoSigtap",
          d.cid10 AS cid10,
          d.especialidade AS especialidade,
          d.subespecialidade AS subespecialidade,
          d."observacoesUnidade" AS "observacoesUnidade",
          d."localSolicitado" AS "localSolicitado",
          d."criadoPor" AS "criadoPor",
          d."criadoPorNome" AS "criadoPorNome",
          d."createdAt"::text AS "createdAtDemanda",
          d."updatedAt"::text AS "updatedAtDemanda",

          p.nome AS "pacienteNome",
          p.cpf AS "pacienteCpf",
          p."cartaoSus" AS "pacienteCartaoSus",
          p.municipio AS "pacienteMunicipio",
          p.email AS "pacienteEmail",
          p.endereco AS "pacienteEndereco"
        FROM public.judicial_monitoramento_base b
        LEFT JOIN public.demandas d
          ON d.id = b.demanda_id
        LEFT JOIN public.pacientes p
          ON p.id = COALESCE(b.paciente_id, d."pacienteId")
        WHERE UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'
          AND (
            b.id::text = $1
            OR b.demanda_id::text = $1
            OR b.origem_registro_id::text = $1
            OR d.id::text = $1
            OR d.protocolo::text = $1
          )
        ORDER BY b.id DESC
        LIMIT 1
      `,
      decodedId,
    )

    const row = rows[0]

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    const monitoramentoId = row.monitoramentoId
    const demandaId = row.demandaId ?? ""

    const interacoes = demandaId
      ? await prisma.$queryRawUnsafe<InteracaoRow[]>(
          `
            SELECT
              id::text AS id,
              texto,
              pendencia,
              "createdAt"::text AS "createdAt",
              "createdBy",
              "createdByName",
              "createdByCpf"
            FROM public.interacoes
            WHERE "demandaId" = $1
            ORDER BY "createdAt" ASC
          `,
          demandaId,
        )
      : []

    const anexos = demandaId
      ? await prisma.$queryRawUnsafe<AnexoRow[]>(
          `
            SELECT
              id::text AS id,
              nome,
              tipo,
              tamanho,
              categoria::text AS categoria,
              descricao,
              "criadoPor",
              "criadoPorNome",
              "createdAt"::text AS "createdAt",
              "arquivoNomeOriginal",
              "arquivoPath",
              "mimeType"
            FROM public.anexos
            WHERE "demandaId" = $1
            ORDER BY "createdAt" DESC
          `,
          demandaId,
        )
      : []

    const finalizacoes = await prisma.$queryRawUnsafe<JudicialFinalizacaoRow[]>(
      `
        SELECT
          id::text AS id,
          status,
          pending_location AS "pendingLocation",
          reason,
          valor_estado AS "valorEstado",
          valor_municipio AS "valorMunicipio",
          created_by AS "createdBy",
          created_by_name AS "createdByName",
          created_at::text AS "createdAt"
        FROM public.judicial_finalizacoes
        WHERE monitoramento_id = $1::bigint
        ORDER BY created_at DESC
      `,
      monitoramentoId,
    )

    const statusProcesso = await prisma.$queryRawUnsafe<JudicialStatusProcessoRow[]>(
      `
        SELECT
          id::text AS id,
          status,
          reason,
          deadline_type AS "deadlineType",
          deadline_value AS "deadlineValue",
          prazo_inicio::text AS "prazoInicio",
          prazo_descricao AS "prazoDescricao",
          created_by AS "createdBy",
          created_by_name AS "createdByName",
          created_at::text AS "createdAt"
        FROM public.judicial_status_processo
        WHERE monitoramento_id = $1::bigint
        ORDER BY created_at ASC
      `,
      monitoramentoId,
    )

    const processosVinculados =
      await prisma.$queryRawUnsafe<JudicialProcessoVinculadoRow[]>(
        `
          SELECT
            id::text AS id,
            tipo,
            numero,
            ativo,
            created_at::text AS "createdAt"
          FROM public.judicial_processos_vinculados
          WHERE monitoramento_id = $1::bigint
            AND COALESCE(ativo, TRUE) = TRUE
          ORDER BY
            CASE WHEN tipo = 'PGE_NET' THEN 0 ELSE 1 END,
            created_at ASC
        `,
        monitoramentoId,
      )

    const fichasRows = await prisma.$queryRawUnsafe<JudicialFichaRow[]>(
      `
        SELECT
          id::text AS id,
          system,
          number,
          requested_inclusion AS "requestedInclusion",
          has_judicial_mark AS "hasJudicialMark",
          attachment_name AS "attachmentName",
          attachment_url AS "attachmentUrl",
          attachment_relative_path AS "attachmentRelativePath",
          notes,
          active,
          status,
          status_reason AS "statusReason",
          status_updated_at::text AS "statusUpdatedAt",
          status_updated_by_name AS "statusUpdatedByName",
          inactive_reason AS "inactiveReason",
          created_at::text AS "createdAt",
          created_by_name AS "createdByName",
          updated_at::text AS "updatedAt",
          updated_by_name AS "updatedByName"
        FROM public.judicial_fichas
        WHERE monitoramento_id = $1::bigint
        ORDER BY COALESCE(updated_at, created_at) ASC, id ASC
      `,
      monitoramentoId,
    )

    const procedimentosRows = await prisma.$queryRawUnsafe<JudicialProcedimentoRow[]>(
      `
        SELECT
          id::text AS id,
          sigtap_id::text AS "sigtapId",
          sigtap_codigo AS "sigtapCode",
          sigtap_descricao AS description,
          especialidade AS specialty,
          subespecialidade AS "subSpecialty",
          active,
          inactive_reason AS "inactiveReason",
          created_at::text AS "createdAt",
          created_by_name AS "createdByName",
          updated_at::text AS "updatedAt",
          updated_by_name AS "updatedByName"
        FROM public.judicial_procedimentos
        WHERE monitoramento_id = $1::bigint
        ORDER BY COALESCE(created_at, updated_at) ASC, id ASC
      `,
      monitoramentoId,
    )


    const movimentacoesRows = await prisma.$queryRawUnsafe<JudicialMovimentacaoRow[]>(
      `
        SELECT
          id::text AS id,
          type,
          description,
          appointment_date::text AS "appointmentDate",
          response_requested_at::text AS "responseRequestedAt",
          state_amount AS "stateAmount",
          municipality_amount AS "municipalityAmount",
          attachments,
          created_by AS "createdBy",
          created_by_name AS "createdByName",
          created_at::text AS "createdAt"
        FROM public.judicial_movimentacoes
        WHERE monitoramento_id = $1::bigint
        ORDER BY created_at ASC, id ASC
      `,
      monitoramentoId,
    )

    const municipioNome = row.pacienteMunicipio ?? row.localSolicitado ?? ""

    const contatosMunicipio = municipioNome
      ? await prisma.$queryRawUnsafe<MunicipioContatoRow[]>(
          `
            SELECT
              id::text AS id,
              municipio_nome AS "municipioNome",
              emails,
              telefones,
              contatos,
              updated_at::text AS "updatedAt"
            FROM public.admin_judicial_municipios_contatos
            WHERE LOWER(TRIM(municipio_nome)) = LOWER(TRIM($1))
            LIMIT 1
          `,
          municipioNome,
        )
      : []

    const contato = contatosMunicipio[0]

    const attachments = anexos.map((item) => {
      const relativePath = text(item.arquivoPath)

      return {
        id: item.id,
        name: text(item.nome || item.arquivoNomeOriginal || "Arquivo"),
        category: mapAttachmentCategory(item.categoria),
        createdAt: item.createdAt ?? new Date().toISOString(),
        createdById: text(item.criadoPor || "sistema"),
        createdByName: text(item.criadoPorNome || "Sistema"),
        source: "processo",
        storedName: text(item.arquivoNomeOriginal || item.nome),
        relativePath,
        url: relativePath ? buildFileUrl(relativePath) : undefined,
        mimeType: text(item.mimeType || item.tipo),
        size: item.tamanho ?? undefined,
      }
    })

    const movementsFromInteracoes = interacoes.map((item) => {
      const descricao = [item.pendencia, item.texto]
        .map((part) => text(part))
        .filter(Boolean)
        .join("\n\n")

      return {
        id: item.id,
        type: "monitoramento",
        description: descricao || "Interação registrada.",
        createdAt: item.createdAt ?? new Date().toISOString(),
        createdById: text(item.createdBy || item.createdByCpf || "sistema"),
        createdByName: text(item.createdByName || "Sistema"),
        attachments: [],
      }
    })

    const movementsFromFinalizacoes = finalizacoes.map((item) => {
      const status = mapFinalizationStatus(item.status)
      const valorEstado = formatMoney(item.valorEstado)
      const valorMunicipio = formatMoney(item.valorMunicipio)
      const descricao = [
        `FINALIZAÇÃO DA DEMANDA: ${finalizationLabel(status)}`,
        item.pendingLocation ? `Pendente em: ${item.pendingLocation}` : "",
        item.reason ? `Justificativa: ${item.reason}` : "",
        valorEstado ? `Valor Estado: ${valorEstado}` : "",
        valorMunicipio ? `Valor Município: ${valorMunicipio}` : "",
      ]
        .filter(Boolean)
        .join("\n")

      return {
        id: `finalizacao-${item.id}`,
        type: "monitoramento",
        description: descricao,
        createdAt: item.createdAt ?? new Date().toISOString(),
        createdById: text(item.createdBy || "sistema"),
        createdByName: text(item.createdByName || "Sistema"),
        attachments: [],
      }
    })

    const movementsFromBanco = movimentacoesRows.map((item) => {
      const createdAt = item.createdAt ?? new Date().toISOString()
      const createdByName = text(item.createdByName || "Sistema")

      return {
        id: item.id,
        type: text(item.type) || "monitoramento",
        description: text(item.description) || "Movimentação registrada.",
        createdAt,
        createdById: text(item.createdBy || "sistema"),
        createdByName,
        appointmentDate: item.appointmentDate ?? undefined,
        responseRequestedAt: item.responseRequestedAt ?? undefined,
        stateAmount:
          item.stateAmount === null || item.stateAmount === undefined
            ? undefined
            : Number(item.stateAmount),
        municipalityAmount:
          item.municipalityAmount === null || item.municipalityAmount === undefined
            ? undefined
            : Number(item.municipalityAmount),
        attachments: movementAttachments(item.attachments, createdAt, createdByName),
      }
    })

    const movements = [
      ...movementsFromInteracoes,
      ...movementsFromFinalizacoes,
      ...movementsFromBanco,
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    const procedureCode = text(row.codigoSigtap || row.procedimentoCodigoBase)
    const procedureDescription = text(
      row.descricaoSigtap || row.procedimentoDescricaoBase,
    )

    const proceduresFromTable = procedimentosRows.map((item) => ({
      id: item.id,
      sigtapCode: text(item.sigtapCode),
      description: text(item.description) || "Procedimento não informado",
      specialty: text(item.specialty) || undefined,
      subSpecialty: text(item.subSpecialty) || undefined,
      active: item.active !== false,
      createdAt: item.createdAt ?? new Date().toISOString(),
      createdByName: text(item.createdByName || "Sistema"),
      updatedAt: item.updatedAt ?? undefined,
      updatedByName: text(item.updatedByName) || undefined,
      inactiveReason: text(item.inactiveReason) || undefined,
    }))

    const procedures =
      proceduresFromTable.length > 0
        ? proceduresFromTable
        : procedureCode
          ? [
              {
                id: `${demandaId || monitoramentoId}-procedimento`,
                sigtapCode: procedureCode,
                description: procedureDescription || "Procedimento não informado",
                specialty: text(row.especialidade) || undefined,
                subSpecialty: text(row.subespecialidade) || undefined,
                active: true,
                createdAt:
                  row.createdAtDemanda ?? row.createdAtBase ?? new Date().toISOString(),
                createdByName: text(row.criadoPorNome || "Sistema"),
              },
            ]
          : []

    const cidCodes = splitCatalogValues(row.cid10 || row.cidCodigoBase)
    const cidDescriptions = splitCatalogValues(row.cidDescricaoBase)

    const cids = cidCodes.map((code, index) => ({
      id: `${demandaId || monitoramentoId}-cid-${index}-${code}`,
      code,
      description: cidDescriptions[index] || code,
      active: true,
      createdAt: row.createdAtDemanda ?? row.createdAtBase ?? new Date().toISOString(),
      createdByName: text(row.criadoPorNome || "Sistema"),
    }))

    const fichasFromTable = fichasRows.map((item) => ({
      id: item.id,
      system: mapFichaSystem(item.system),
      number: text(item.number) || undefined,
      includedAt: item.createdAt ?? new Date().toISOString(),
      requestedInclusion: Boolean(item.requestedInclusion),
      hasJudicialMark: item.hasJudicialMark !== false,
      attachmentName: text(item.attachmentName) || undefined,
      attachmentUrl: text(item.attachmentUrl) || undefined,
      attachmentRelativePath: text(item.attachmentRelativePath) || undefined,
      notes: text(item.notes),
      active: item.active !== false,
      updatedAt: item.updatedAt ?? undefined,
      updatedByName: text(item.updatedByName || item.createdByName) || undefined,
      inactiveReason: text(item.inactiveReason) || undefined,
      status: text(item.status) || undefined,
      statusReason: text(item.statusReason) || undefined,
      statusUpdatedAt: item.statusUpdatedAt ?? undefined,
      statusUpdatedByName: text(item.statusUpdatedByName) || undefined,
    }))

    const fichaCore = text(row.fichaCore)

    const fichas =
      fichasFromTable.length > 0
        ? fichasFromTable
        : fichaCore
          ? [
              {
                id: `${monitoramentoId}-ficha-core`,
                system: "CORE" as const,
                number: fichaCore,
                includedAt:
                  row.createdAtBase ?? row.createdAtDemanda ?? new Date().toISOString(),
                requestedInclusion: false,
                hasJudicialMark: true,
                notes: "Ficha CORE vinculada ao monitoramento judicial.",
                active: true,
              },
            ]
          : []

    const pgeNetNumbers = processosVinculados
      .filter((item) => text(item.tipo).toUpperCase() === "PGE_NET")
      .map((item) => text(item.numero))
      .filter(Boolean)

    const processNumbers = processosVinculados
      .filter((item) => text(item.tipo).toUpperCase() !== "PGE_NET")
      .map((item) => text(item.numero))
      .filter(Boolean)

    const latestFinalization = finalizacoes[0]

    const finalization = latestFinalization
      ? {
          status: mapFinalizationStatus(latestFinalization.status),
          createdAt: latestFinalization.createdAt ?? new Date().toISOString(),
          createdById: text(latestFinalization.createdBy || "sistema"),
          createdByName: text(latestFinalization.createdByName || "Sistema"),
          pendingLocation:
            text(latestFinalization.pendingLocation) === "ses" ||
            text(latestFinalization.pendingLocation) === "core" ||
            text(latestFinalization.pendingLocation) === "municipio"
              ? (text(latestFinalization.pendingLocation) as "ses" | "core" | "municipio")
              : undefined,
          reason: text(latestFinalization.reason) || undefined,
        }
      : undefined

    const processStatusHistory = statusProcesso.map((item) => {
      const reasonParts = [
        text(item.reason),
        item.prazoInicio ? `Início do prazo: ${item.prazoInicio}` : "",
        text(item.prazoDescricao) ? `Prazo: ${text(item.prazoDescricao)}` : "",
      ].filter(Boolean)

      return {
        id: item.id,
        status: mapProcessStatus(item.status),
        createdAt: item.createdAt ?? new Date().toISOString(),
        createdById: text(item.createdBy || "sistema"),
        createdByName: text(item.createdByName || "Sistema"),
        reason: reasonParts.join("\n") || undefined,
        deadlineType:
          text(item.deadlineType) === "horas" || text(item.deadlineType) === "dias"
            ? (text(item.deadlineType) as "horas" | "dias")
            : undefined,
        deadlineValue:
          Number.isFinite(Number(item.deadlineValue)) && item.deadlineValue !== null
            ? Number(item.deadlineValue)
            : undefined,
      }
    })

    const caseItem = {
      id: monitoramentoId,
      patientId: text(row.pacienteId || row.pacienteCartaoSus),
      patientName: text(row.pacienteNome || row.nomePacienteBase || "SEM NOME"),
      cpf: text(row.pacienteCpf || row.cpfBase),
      municipalityName: municipioNome || "Não informado",
      originModule: "judicial",
      originProtocol: text(row.protocolo || demandaId || `MON-${monitoramentoId}`),
      processNumber: processNumbers[0] || "",
      processNumbers,
      active: row.ativoMonitoramento !== false,
      status: mapCaseStatus(row.statusMonitoramentoAtual),
      priority: 1,
      lastMonitoredAt: row.dataUltimoMonitoramento ?? undefined,
      lastMovementAt:
        row.updatedAtBase ??
        row.updatedAtDemanda ??
        row.createdAtBase ??
        row.createdAtDemanda ??
        new Date().toISOString(),
      monitoringMode: "humano",
      monitoringModeReason:
        "Processo judicial carregado do banco de dados pelo monitoramento judicial.",
      schedulingStatus: "fora_fila",
      appointmentDate: undefined,
      procedures,
      cids,
      fichas,
      attachments,
      movements,
      municipalityManifestations: [],
      coreHistory: [],
      registration: {
        isIntimation: "nao",
        oficioNumber: "",
        receivedAt: row.createdAtDemanda ?? row.createdAtBase ?? new Date().toISOString(),
        actionRecords: text(row.observacoesUnidade),
        pgeNetNumber: pgeNetNumbers.join(" | "),
        deadlineDays: 0,
        deadlineAt: "",
        municipalityId: "",
        municipalityIbge: "",
        municipalityName: municipioNome || "Não informado",
      },
      processStatusHistory,
      finalization,
    }

    return NextResponse.json({
      ok: true,
      item: caseItem,
      municipalityContact: contato
        ? {
            id: contato.id,
            municipalityName: text(contato.municipioNome),
            emails: jsonArray(contato.emails),
            phones: jsonArray(contato.telefones),
            contacts: jsonArray(contato.contatos),
            updatedAt: contato.updatedAt ?? "",
          }
        : null,
    })
  } catch (error) {
    console.error("[GET /api/judicial/casos/[id]] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar detalhe do processo judicial." },
      { status: 500 },
    )
  }
}
