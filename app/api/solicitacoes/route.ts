import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Module, TipoSolicitacao, CategoriaAnexo } from "@prisma/client"
import { ensureEmailOsRoutingColumns } from "@/lib/email-os-routing"

function text(value: unknown) {
  return String(value ?? "").trim()
}

function buildId(prefix: string) {
  return `${prefix}${randomUUID().replace(/-/g, "")}`
}

function parseArray(value: unknown) {
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function attachmentLine(value: unknown) {
  const items = parseArray(value)
  if (!items.length) return "nenhum"
  return items.map((item: any) => text(item?.name || item?.filename || item?.url || "anexo")).filter(Boolean).join(" | ") || "nenhum"
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { paciente, demanda, anexos } = body
    const osId = text(body?.osId)

    let pacienteDb = await prisma.paciente.findUnique({ where: { cpf: paciente.cpf } })

    if (!pacienteDb) {
      pacienteDb = await prisma.paciente.create({
        data: {
          cpf: paciente.cpf,
          cartaoSus: paciente.cartaoSus,
          nome: paciente.nome,
          dataNascimento: new Date(paciente.dataNascimento),
          email: paciente.email,
          municipio: paciente.municipio,
          endereco: paciente.endereco,
          telefones: { create: paciente.telefones.map((t: string) => ({ value: t })) },
        },
      })
    }

    const novaDemanda = await prisma.demanda.create({
      data: {
        protocolo: `PRT-${Date.now()}`,
        pacienteId: pacienteDb.id,
        modulo: demanda.modulo as Module,
        localSolicitante: demanda.localSolicitante,
        emailSolicitante: demanda.emailSolicitante,
        acaoJudicial: demanda.acaoJudicial,
        codigoSigtap: demanda.codigoSigtap,
        descricaoSigtap: demanda.descricaoSigtap,
        cid10: demanda.cid10,
        especialidade: demanda.especialidade,
        subespecialidade: demanda.subespecialidade,
        peso: demanda.peso,
        altura: demanda.altura,
        tipoSanguineo: demanda.tipoSanguineo,
        observacoesUnidade: demanda.observacoesUnidade,
        localSolicitado: demanda.localSolicitado,
        tipoSolicitacao: demanda.tipoSolicitacao as TipoSolicitacao,
        telefonesSolicitante: { create: demanda.telefonesSolicitante.map((t: string) => ({ value: t })) },
        anexos: {
          create: anexos.map((a: any) => ({
            nome: a.nome,
            tipo: "application/pdf",
            tamanho: 100000,
            categoria: a.categoria as CategoriaAnexo,
            descricao: a.descricao,
            criadoPor: "externo",
            criadoPorNome: demanda.localSolicitante,
          })),
        },
      },
    })

    if (osId) {
      await ensureEmailOsRoutingColumns()
      const osRows = await prisma.$queryRawUnsafe<Array<{ protocolo: string | null; assunto: string | null; remetente: string | null; corpoResumo: string | null; anexos: unknown; responsavelNome: string | null }>>(
        `SELECT protocolo, assunto, remetente, corpo_resumo AS "corpoResumo", anexos, responsavel_nome AS "responsavelNome" FROM public.judicial_email_os WHERE id::text = $1 LIMIT 1`,
        osId,
      )
      const os = osRows[0]
      await prisma.$executeRawUnsafe(
        `UPDATE public.judicial_email_os SET status = 'CONVERTIDA', convertido_demanda_id = $2, convertido_protocolo = $3, convertido_em = NOW(), updated_at = NOW() WHERE id::text = $1`,
        osId,
        novaDemanda.id,
        novaDemanda.protocolo,
      )
      if (os) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO public.interacoes (id, "demandaId", texto, pendencia, "createdAt", "createdBy", "createdByName") VALUES ($1, $2, $3, NULL, NOW(), 'sistema-email', 'Integração de e-mail')`,
          buildId("int_"),
          novaDemanda.id,
          [
            "E-MAIL AUTOMÁTICO IDENTIFICADO",
            `OS criada: ${os.protocolo || osId}`,
            `OS convertida em protocolo: ${novaDemanda.protocolo}`,
            `Assunto: ${os.assunto || ""}`,
            `Remetente: ${os.remetente || ""}`,
            `Responsável direcionado: ${os.responsavelNome || "não definido"}`,
            `Pessoa que criou o processo: ${text(body?.createdByName) || text(body?.usuarioNome) || "não informado"}`,
            `Corpo do e-mail: ${os.corpoResumo || ""}`,
            `Anexos: ${attachmentLine(os.anexos)}`,
          ].join("\n"),
        )
      }
    }

    return NextResponse.json({ success: true, protocolo: novaDemanda.protocolo })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao salvar solicitacao" }, { status: 500 })
  }
}
