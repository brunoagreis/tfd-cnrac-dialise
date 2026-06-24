import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Module, TipoSolicitacao, CategoriaAnexo } from "@prisma/client"
import { ensureEmailOsRoutingColumns } from "@/lib/email-os-routing"

function text(value: unknown) {
  return String(value ?? "").trim()
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
      await prisma.$executeRawUnsafe(
        `UPDATE public.judicial_email_os SET status = 'CONVERTIDA', convertido_demanda_id = $2, convertido_protocolo = $3, convertido_em = NOW(), updated_at = NOW() WHERE id::text = $1`,
        osId,
        novaDemanda.id,
        novaDemanda.protocolo,
      )
    }

    return NextResponse.json({ success: true, protocolo: novaDemanda.protocolo })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao salvar solicitacao" }, { status: 500 })
  }
}
