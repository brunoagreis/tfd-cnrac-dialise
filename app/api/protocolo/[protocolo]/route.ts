import { NextRequest, NextResponse } from "next/server"
import { readServerSession } from "@/lib/security/server-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProtocoloRow = {
  demandaId: string
  protocolo: string
  modulo: string
  pacienteId: string
  pacienteNome: string | null
  pacienteCpf: string | null
  pacienteCartaoSus: string | null
  pacienteDataNascimento: string | null
  pacienteEmail: string | null
  pacienteMunicipio: string | null
  pacienteEndereco: string | null
  localSolicitante: string | null
  emailSolicitante: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
  especialidade: string | null
  subespecialidade: string | null
  observacoesUnidade: string | null
  localSolicitado: string | null
  tipoSolicitacao: string | null
  acaoJudicial: boolean | null
  criadoPor: string | null
  criadoPorNome: string | null
  createdAt: string | null
  updatedAt: string | null
  statusMonitoramentoAtual: string | null
}

type TelefoneSolicitanteRow = {
  value: string | null
}


type ProtocolPermissionUserRow = {
  id: string
  ativo: boolean | null
  role: string | null
  perfilCodigo: string | null
}

type ProtocolPermissionPerfilRow = {
  id: string
  codigo: string | null
  nome: string | null
}

type ProtocolPermissionRow = {
  modulo: string | null
  acao: string | null
}

function normalizeProtocolAccessValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function normalizeProtocolModule(value: unknown) {
  const normalized = normalizeProtocolAccessValue(value).replace(/[\s-]+/g, "_")

  if (normalized === "prejudicial") return "pre_judicial"
  if (normalized === "pre_judicial") return "pre_judicial"
  if (normalized === "hemodialise") return "hemodialise"
  if (normalized === "judicial") return "judicial"
  if (normalized === "tfd") return "tfd"
  if (normalized === "cnrac") return "cnrac"

  return normalized
}

function isProtocolAdminUser(user: ProtocolPermissionUserRow | null | undefined) {
  const role = normalizeProtocolAccessValue(user?.role)
  const perfil = normalizeProtocolAccessValue(user?.perfilCodigo)

  return (
    role === "admin" ||
    role === "administrador" ||
    role.includes("admin") ||
    perfil === "admin" ||
    perfil === "administrador" ||
    perfil.includes("admin")
  )
}

function normalizeProtocolPermission(modulo: unknown, acao: unknown) {
  return `${normalizeProtocolModule(modulo)}.${normalizeProtocolAccessValue(acao)}`
}

async function loadProtocolUserAndPermissions(userId: string) {
  const users = await prisma.$queryRawUnsafe<ProtocolPermissionUserRow[]>(
    `
      SELECT
        id::text AS id,
        ativo,
        role::text AS role,
        "perfilCodigo"::text AS "perfilCodigo"
      FROM public.usuarios
      WHERE id::text = $1
      LIMIT 1
    `,
    userId,
  )

  const user = users[0] || null

  if (!user || user.ativo === false) {
    return { user, permissions: [] as string[] }
  }

  if (isProtocolAdminUser(user)) {
    return { user, permissions: ["*"] }
  }

  const perfilCodigo = String(user.perfilCodigo ?? "").trim()

  if (!perfilCodigo) {
    return { user, permissions: [] as string[] }
  }

  const perfis = await prisma.$queryRawUnsafe<ProtocolPermissionPerfilRow[]>(
    `
      SELECT
        id::text AS id,
        codigo,
        nome
      FROM public.perfis
      WHERE UPPER(COALESCE(codigo, '')) = UPPER($1)
         OR UPPER(COALESCE(nome, '')) = UPPER($1)
      ORDER BY id
      LIMIT 1
    `,
    perfilCodigo,
  )

  const perfil = perfis[0]

  if (!perfil) {
    return { user, permissions: [] as string[] }
  }

  const rows = await prisma.$queryRawUnsafe<ProtocolPermissionRow[]>(
    `
      SELECT
        modulo,
        acao
      FROM public.perfil_permissoes
      WHERE perfil_id::text = $1
        AND permitido = true
      ORDER BY modulo, acao
    `,
    perfil.id,
  )

  const permissions = Array.from(
    new Set(rows.map((item) => normalizeProtocolPermission(item.modulo, item.acao)).filter(Boolean)),
  )

  return { user, permissions }
}

function canAccessProtocolByModule(args: {
  user: ProtocolPermissionUserRow | null
  permissions: string[]
  modulo: string
}) {
  if (isProtocolAdminUser(args.user)) return true
  if (args.permissions.includes("*")) return true

  const modulo = normalizeProtocolModule(args.modulo)
  const permissionSet = new Set(args.permissions.map((item) => normalizeProtocolAccessValue(item)))

  return (
    permissionSet.has("protocolo.visualizar") ||
    permissionSet.has(`${modulo}.visualizar`) ||
    (
      permissionSet.has("pacientes.visualizar") &&
      permissionSet.has(`${modulo}.visualizar`)
    )
  )
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase()

  if (status === "finalizado" || status === "resolvido") return "resolvido"
  if (status === "devolvida" || status === "devolvido") return "devolvida"

  return "pendente"
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ protocolo: string }> },
) {
  try {
    const session = readServerSession(req)

    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      )
    }

    const { user, permissions } = await loadProtocolUserAndPermissions(String(session.id))

    if (!user || user.ativo === false) {
      return NextResponse.json(
        { ok: false, error: "Sessão inválida." },
        { status: 401 },
      )
    }

    const { protocolo } = await context.params
    const decodedProtocol = decodeURIComponent(protocolo)

    const rows = await prisma.$queryRawUnsafe<ProtocoloRow[]>(
      `
        SELECT
          d.id::text AS "demandaId",
          d.protocolo::text AS protocolo,
          LOWER(COALESCE(d.modulo::text, 'tfd')) AS modulo,
          d."pacienteId"::text AS "pacienteId",
          p.nome AS "pacienteNome",
          p.cpf AS "pacienteCpf",
          p."cartaoSus" AS "pacienteCartaoSus",
          p."dataNascimento"::text AS "pacienteDataNascimento",
          p.email AS "pacienteEmail",
          p.municipio AS "pacienteMunicipio",
          p.endereco AS "pacienteEndereco",
          d."localSolicitante" AS "localSolicitante",
          d."emailSolicitante" AS "emailSolicitante",
          d."codigoSigtap" AS "codigoSigtap",
          d."descricaoSigtap" AS "descricaoSigtap",
          d.cid10 AS cid10,
          d.especialidade AS especialidade,
          d.subespecialidade AS subespecialidade,
          d."observacoesUnidade" AS "observacoesUnidade",
          d."localSolicitado" AS "localSolicitado",
          d."tipoSolicitacao"::text AS "tipoSolicitacao",
          d."acaoJudicial" AS "acaoJudicial",
          d."criadoPor" AS "criadoPor",
          d."criadoPorNome" AS "criadoPorNome",
          d."createdAt"::text AS "createdAt",
          d."updatedAt"::text AS "updatedAt",
          CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.interacoes i
    WHERE i."demandaId" = d.id
      AND i.pendencia = 'finalizar_demanda'
  )
  THEN 'RESOLVIDO'
  ELSE b.status_monitoramento_atual
END AS "statusMonitoramentoAtual"
        FROM public.demandas d
        INNER JOIN public.pacientes p
          ON p.id = d."pacienteId"
        LEFT JOIN public.judicial_monitoramento_base b
          ON b.origem_tabela = 'demandas'
         AND b.origem_registro_id = d.id::text
        WHERE d.protocolo = $1
        LIMIT 1
      `,
      decodedProtocol,
    )

    const row = rows[0]

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Protocolo não encontrado." },
        { status: 404 },
      )
    }

    if (!canAccessProtocolByModule({ user, permissions, modulo: row.modulo })) {
      return NextResponse.json(
        { ok: false, error: "Você não tem permissão para visualizar este protocolo." },
        { status: 403 },
      )
    }

    const telefones = await prisma.$queryRawUnsafe<TelefoneSolicitanteRow[]>(
      `
        SELECT value
        FROM public.telefone_solicitante
        WHERE "demandaId" = $1
        ORDER BY id
      `,
      row.demandaId,
    )

    return NextResponse.json({
      ok: true,
      item: {
        demanda: {
          id: row.demandaId,
          protocolo: row.protocolo,
          pacienteId: row.pacienteId,
          modulo: row.modulo,
          localSolicitante: row.localSolicitante ?? "",
          telefoneSolicitante: telefones.map((t) => t.value ?? "").filter(Boolean),
          emailSolicitante: row.emailSolicitante ?? "",
          codigoSigtap: row.codigoSigtap ?? "",
          descricaoSigtap: row.descricaoSigtap ?? "",
          cid10: row.cid10 ?? "",
          especialidade: row.especialidade ?? "",
          subespecialidade: row.subespecialidade ?? "",
          peso: "",
          altura: "",
          tipoSanguineo: "",
          observacoesUnidade: row.observacoesUnidade ?? "",
tipoSolicitacao:
  row.tipoSolicitacao === "definitiva"
    ? "definitiva"
    : row.tipoSolicitacao === "nao_se_aplica"
      ? "nao_se_aplica"
      : row.tipoSolicitacao === "inclusao"
        ? "inclusao"
        : row.tipoSolicitacao === "substituicao"
          ? "substituicao"
          : row.tipoSolicitacao === "alta"
            ? "alta"
            : row.tipoSolicitacao === "outros"
              ? "outros"
              : "transito",
          localSolicitado: row.localSolicitado ?? "",
          acaoJudicial: Boolean(row.acaoJudicial),
          status: normalizeStatus(row.statusMonitoramentoAtual),
          anexos: [],
          interacoes: [],
          criadoEm: row.createdAt ?? "",
          atualizadoEm: row.updatedAt ?? "",
          criadoPor: row.criadoPor ?? "",
          criadoPorNome: row.criadoPorNome ?? "",
        },
        paciente: {
          id: row.pacienteId,
          cpf: row.pacienteCpf ?? "",
          cartaoSus: row.pacienteCartaoSus ?? "",
          nome: row.pacienteNome ?? "SEM NOME",
          dataNascimento: row.pacienteDataNascimento ?? "",
          telefones: [],
          email: row.pacienteEmail ?? "",
          municipio: row.pacienteMunicipio ?? "",
          endereco: row.pacienteEndereco ?? "",
          criadoEm: "",
          atualizadoEm: "",
        },
      },
    })
  } catch (error) {
    console.error("[GET /api/protocolo/[protocolo]] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar protocolo." },
      { status: 500 },
    )
  }
}