import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ColumnRow = {
  column_name: string
}

type ScheduleRow = {
  id: string
  idUsuario: string
  usuarioNome: string | null
  usuarioEmail: string | null
  diaSemana: number
  horaEntrada: string
  horaEntradaAlmoco: string
  horaRetornoAlmoco: string
  horaSaida: string
  ativo: boolean
  createdAt: Date | null
  updatedAt: Date | null
}

type UserRow = {
  id: string
  nome: string | null
  email: string | null
  role: string | null
  perfilCodigo: string | null
  ativo: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function toInt(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.trunc(number) : 0
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function pickFirstExisting(candidates: string[], available: Set<string>) {
  return candidates.find((item) => available.has(item)) ?? null
}

async function getUsuariosColumns() {
  const rows = await prisma.$queryRawUnsafe<ColumnRow[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
    ORDER BY ordinal_position
  `)

  return new Set(rows.map((row) => row.column_name))
}

function isTime(value: string) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value)
}

function normalizeTime(value: unknown) {
  const raw = text(value)
  if (!raw) return ""
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw
  return raw
}

function normalizeSchedule(row: ScheduleRow) {
  return {
    id: row.id,
    idUsuario: row.idUsuario,
    usuarioNome: row.usuarioNome ?? "",
    usuarioEmail: row.usuarioEmail ?? "",
    diaSemana: row.diaSemana,
    horaEntrada: String(row.horaEntrada ?? "").slice(0, 5),
    horaEntradaAlmoco: String(row.horaEntradaAlmoco ?? "").slice(0, 5),
    horaRetornoAlmoco: String(row.horaRetornoAlmoco ?? "").slice(0, 5),
    horaSaida: String(row.horaSaida ?? "").slice(0, 5),
    ativo: row.ativo,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  }
}

function normalizeUser(row: UserRow) {
  return {
    id: row.id,
    nome: row.nome ?? "",
    email: row.email ?? "",
    role: row.role ?? "",
    perfilCodigo: row.perfilCodigo ?? "",
    ativo: row.ativo ?? true,
  }
}

export async function GET() {
  try {
    const columns = await getUsuariosColumns()

    const idCol = pickFirstExisting(["id"], columns)
    if (!idCol) {
      return NextResponse.json(
        { ok: false, error: "Tabela usuarios sem coluna id." },
        { status: 500 },
      )
    }

    const nomeCol = pickFirstExisting(["nome", "name", "nomeCompleto", "nome_completo"], columns)
    const emailCol = pickFirstExisting(["email", "e_mail", "login"], columns)
    const roleCol = pickFirstExisting(["role", "papelPrincipal", "papel_principal", "perfil", "tipo"], columns)
    const perfilCol = pickFirstExisting(["perfilCodigo", "perfil_codigo", "codigoPerfil", "codigo_perfil"], columns)
    const ativoCol = pickFirstExisting(["ativo", "active", "isActive", "is_active"], columns)

    const idExpr = `${quoteIdent(idCol)}::text`
    const nomeExpr = nomeCol
      ? `${quoteIdent(nomeCol)}::text`
      : emailCol
        ? `${quoteIdent(emailCol)}::text`
        : `${idExpr}`
    const emailExpr = emailCol ? `${quoteIdent(emailCol)}::text` : `NULL::text`
    const roleExpr = roleCol ? `${quoteIdent(roleCol)}::text` : `NULL::text`
    const perfilExpr = perfilCol ? `${quoteIdent(perfilCol)}::text` : `NULL::text`
    const ativoExpr = ativoCol ? `${quoteIdent(ativoCol)}::boolean` : `true`
    const whereAtivo = ativoCol ? `WHERE COALESCE(${quoteIdent(ativoCol)}, true) = true` : ""

    const [usuarios, horarios] = await Promise.all([
      prisma.$queryRawUnsafe<UserRow[]>(
        `
          SELECT
            ${idExpr} AS id,
            COALESCE(${nomeExpr}, ${emailExpr}, ${idExpr}) AS nome,
            ${emailExpr} AS email,
            ${roleExpr} AS role,
            ${perfilExpr} AS "perfilCodigo",
            ${ativoExpr} AS ativo
          FROM public.usuarios
          ${whereAtivo}
          ORDER BY COALESCE(${nomeExpr}, ${emailExpr}, ${idExpr})
        `,
      ),
      prisma.$queryRawUnsafe<ScheduleRow[]>(
        `
          SELECT
            id::text AS id,
            id_usuario::text AS "idUsuario",
            usuario_nome AS "usuarioNome",
            usuario_email AS "usuarioEmail",
            dia_semana::int AS "diaSemana",
            hora_entrada::text AS "horaEntrada",
            hora_entrada_almoco::text AS "horaEntradaAlmoco",
            hora_retorno_almoco::text AS "horaRetornoAlmoco",
            hora_saida::text AS "horaSaida",
            ativo,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM public.cadastro_horario_trabalho
          ORDER BY ativo DESC, usuario_nome, id_usuario, dia_semana, id DESC
        `,
      ),
    ])

    return NextResponse.json({
      ok: true,
      usuarios: usuarios.map(normalizeUser),
      horarios: horarios.map(normalizeSchedule),
    })
  } catch (error) {
    console.error("GET_ADMIN_WORK_SCHEDULES_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar horários de trabalho." },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const idUsuario = text(body?.idUsuario || body?.id_usuario)
    const usuarioNome = text(body?.usuarioNome || body?.usuario_nome)
    const usuarioEmail = text(body?.usuarioEmail || body?.usuario_email)
    const diaSemana = toInt(body?.diaSemana || body?.dia_semana)
    const horaEntrada = normalizeTime(body?.horaEntrada || body?.hora_entrada)
    const horaEntradaAlmoco = normalizeTime(body?.horaEntradaAlmoco || body?.hora_entrada_almoco)
    const horaRetornoAlmoco = normalizeTime(body?.horaRetornoAlmoco || body?.hora_retorno_almoco)
    const horaSaida = normalizeTime(body?.horaSaida || body?.hora_saida)

    if (!idUsuario) {
      return NextResponse.json({ ok: false, error: "Usuário é obrigatório." }, { status: 400 })
    }

    if (diaSemana < 1 || diaSemana > 5) {
      return NextResponse.json({ ok: false, error: "Dia da semana inválido." }, { status: 400 })
    }

    if (![horaEntrada, horaEntradaAlmoco, horaRetornoAlmoco, horaSaida].every(isTime)) {
      return NextResponse.json({ ok: false, error: "Horários inválidos." }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.cadastro_horario_trabalho
          SET ativo = false, updated_at = NOW()
          WHERE id_usuario::text = $1
            AND dia_semana = $2::smallint
            AND ativo = true
        `,
        idUsuario,
        diaSemana,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.cadastro_horario_trabalho (
            id_usuario,
            usuario_nome,
            usuario_email,
            dia_semana,
            hora_entrada,
            hora_entrada_almoco,
            hora_retorno_almoco,
            hora_saida,
            ativo,
            created_at,
            updated_at
          ) VALUES (
            $1,
            $2,
            $3,
            $4::smallint,
            $5::time,
            $6::time,
            $7::time,
            $8::time,
            true,
            NOW(),
            NOW()
          )
        `,
        idUsuario,
        usuarioNome,
        usuarioEmail,
        diaSemana,
        horaEntrada,
        horaEntradaAlmoco,
        horaRetornoAlmoco,
        horaSaida,
      )
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("POST_ADMIN_WORK_SCHEDULES_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao salvar horário de trabalho." },
      { status: 500 },
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = text(body?.id)
    const ativo = Boolean(body?.ativo)

    if (!id) {
      return NextResponse.json({ ok: false, error: "Horário não informado." }, { status: 400 })
    }

    await prisma.$executeRawUnsafe(
      `
        UPDATE public.cadastro_horario_trabalho
        SET ativo = $2::boolean, updated_at = NOW()
        WHERE id::text = $1
      `,
      id,
      ativo,
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("PATCH_ADMIN_WORK_SCHEDULES_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar horário de trabalho." },
      { status: 500 },
    )
  }
}
