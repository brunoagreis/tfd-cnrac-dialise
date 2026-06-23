import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"
import { recordMunicipalityEmailDispatch } from "@/lib/municipality-email-dispatch-log"

type MunicipalityContactRow = {
  municipalityName: string | null
  emails: unknown
}

type TemplateRow = {
  subject: string | null
  body: string | null
}

type DemandNotificationInput = {
  module: "tfd" | "cnrac" | "hemodialise" | "judicial" | "pre_judicial"
  protocolo: string
  pacienteNome: string
  pacienteCpf?: string | null
  pacienteCns?: string | null
  pacienteTelefone?: string | null
  pacienteEmail?: string | null
  pacienteDataNascimento?: string | null
  pacienteEndereco?: string | null
  municipio: string
  localSolicitante?: string | null
  emailSolicitante?: string | null
  telefoneSolicitante?: string | null
  localSolicitado?: string | null
  tipoSolicitacao?: string | null
  codigoSigtap?: string | null
  descricaoSigtap?: string | null
  cid10?: string | null
  especialidade?: string | null
  subespecialidade?: string | null
  peso?: string | null
  altura?: string | null
  tipoSanguineo?: string | null
  observacoes?: string | null
  fichaCore?: string | null
  numeroProcesso?: string | null
  pgeNet?: string | null
  numeroOficio?: string | null
  tipoIntimacao?: string | null
  dataRecebimento?: string | null
  dataReiteracao?: string | null
  prazoDias?: string | number | null
  prazoFinal?: string | null
  dataAgendamento?: string | null
  userSistema?: string | null
}

type NotificationResult = {
  ok: boolean
  skipped: boolean
  reason?: string
  messageId?: string
  accepted?: unknown
  rejected?: unknown
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeModule(value: string) {
  return text(value).toLowerCase().replace(/\s+/g, "_").replace("-", "_")
}

function moduleLabel(value: string) {
  const module = normalizeModule(value)
  const labels: Record<string, string> = {
    tfd: "TFD",
    cnrac: "CNRAC",
    hemodialise: "Hemodiálise",
    judicial: "Judicial",
    pre_judicial: "Pré Judicial",
  }
  return labels[module] ?? module.toUpperCase()
}

function escapeHtml(value: unknown) {
  return text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function normalizeEmails(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean)
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((item) => text(item)).filter(Boolean)
    } catch {
      return value.split(/[;,]/).map((item) => text(item)).filter(Boolean)
    }
  }
  return []
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function tipoSolicitacaoLabel(value: unknown) {
  const key = text(value).toLowerCase()
  const labels: Record<string, string> = {
    transito: "Trânsito",
    definitiva: "Definitiva",
    nao_se_aplica: "Não se aplica",
    inclusao: "Inclusão",
    substituicao: "Substituição",
    alta: "Alta",
    outros: "Outros",
  }
  return labels[key] ?? text(value)
}

function tokenValues(input: DemandNotificationInput) {
  const moduloCodigo = normalizeModule(input.module)
  const protocolo = text(input.protocolo)
  const pacienteNome = text(input.pacienteNome)
  const pacienteCpf = text(input.pacienteCpf)
  const pacienteCns = text(input.pacienteCns)
  const pacienteTelefone = text(input.pacienteTelefone)
  const pacienteEmail = text(input.pacienteEmail)
  const numeroProcesso = text(input.numeroProcesso)
  const pgeNet = text(input.pgeNet)
  const numeroOficio = text(input.numeroOficio)
  const userSistema = text(input.userSistema) || "SIGAJUS"
  const dataAgendamento = text(input.dataAgendamento)
  const localSolicitante = text(input.localSolicitante)
  const localSolicitado = text(input.localSolicitado)
  const tipoSolicitacao = tipoSolicitacaoLabel(input.tipoSolicitacao)
  const municipio = text(input.municipio)
  const codigoSigtap = text(input.codigoSigtap)
  const descricaoSigtap = text(input.descricaoSigtap)
  const cid10 = text(input.cid10)

  return {
    modulo: moduleLabel(input.module),
    modulo_codigo: moduloCodigo,

    protocolo,
    protocolo_tfd: moduloCodigo === "tfd" ? protocolo : "",
    protocolo_cnrac: moduloCodigo === "cnrac" ? protocolo : "",
    protocolo_hemodialise: moduloCodigo === "hemodialise" ? protocolo : "",
    protocolo_judicial: moduloCodigo === "judicial" ? protocolo : "",
    protocolo_prejudicial: moduloCodigo === "pre_judicial" ? protocolo : "",

    nome_paciente: pacienteNome,
    paciente_nome: pacienteNome,
    requerente: pacienteNome,
    cpf: pacienteCpf,
    paciente_cpf: pacienteCpf,
    cns: pacienteCns,
    cartao_sus: pacienteCns,
    paciente_cns: pacienteCns,
    telefone_paciente: pacienteTelefone,
    paciente_telefone: pacienteTelefone,
    email_paciente: pacienteEmail,
    paciente_email: pacienteEmail,
    data_nascimento: text(input.pacienteDataNascimento),
    nascimento_paciente: text(input.pacienteDataNascimento),
    endereco_paciente: text(input.pacienteEndereco),

    municipio,
    municipio_paciente: municipio,
    local_solicitante: localSolicitante,
    email_solicitante: text(input.emailSolicitante),
    telefone_solicitante: text(input.telefoneSolicitante),
    local_solicitado: localSolicitado,
    origem: localSolicitante,
    destino: localSolicitado,
    tipo_solicitacao: tipoSolicitacao,

    ficha_core: text(input.fichaCore),
    numero_processo: numeroProcesso,
    autos_acao: numeroProcesso,
    processo: numeroProcesso,
    pge_net: pgeNet,
    numero_pge_net: pgeNet,
    numero_oficio: numeroOficio,
    oficio: numeroOficio,
    tipo_intimacao: text(input.tipoIntimacao),
    data_recebimento: text(input.dataRecebimento),
    data_reiteracao: text(input.dataReiteracao),
    prazo_dias: text(input.prazoDias),
    prazo_final: text(input.prazoFinal),
    data_agendamento: dataAgendamento,
    user_sistema: userSistema,

    sigtap: codigoSigtap,
    codigo_sigtap: codigoSigtap,
    procedimento: descricaoSigtap,
    procedimento_sigtap: codigoSigtap,
    procedimento_cnrac: descricaoSigtap,
    sigtap_descricao: descricaoSigtap,
    descricao_sigtap: descricaoSigtap,
    cid: cid10,
    cid10,
    cid_cnrac: cid10,
    especialidade: text(input.especialidade),
    subespecialidade: text(input.subespecialidade),

    peso: text(input.peso),
    altura: text(input.altura),
    tipo_sanguineo: text(input.tipoSanguineo),
    observacoes: text(input.observacoes),
    observacoes_unidade: text(input.observacoes),
  } satisfies Record<string, string>
}

function replaceTokens(template: string, input: DemandNotificationInput) {
  const values = tokenValues(input)
  return template.replace(/\$([a-zA-Z0-9_]+)/g, (match, key) => {
    const value = values[String(key)]
    return value !== undefined ? value : match
  })
}

function detailRow(label: string, value: unknown) {
  const content = text(value) || "-"
  return `
    <tr>
      <td style="padding:8px 0;color:#1d4ed8;font-size:13px;width:160px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:700;vertical-align:top;">${escapeHtml(content)}</td>
    </tr>
  `
}

function automaticSummaryRows(values: ReturnType<typeof tokenValues>) {
  return [
    detailRow("Município", values.municipio),
    values.numero_processo ? detailRow("Nº processo", values.numero_processo) : "",
  ].join("")
}

function wrapEmailHtml(bodyHtml: string, input: DemandNotificationInput) {
  const values = tokenValues(input)

  return `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(values.protocolo || "SIGAJUS")}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f8;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe4ef;box-shadow:0 12px 30px rgba(15,23,42,.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f4c81,#1976a3);padding:22px 28px;color:#ffffff;">
                <div style="font-size:22px;font-weight:800;letter-spacing:.5px;">SIGAJUS</div>
                <div style="font-size:13px;opacity:.9;margin-top:4px;">Sistema de Gestão de Ações Judiciais na Saúde</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 8px 28px;">
                <div style="display:inline-block;border-radius:999px;background:#e0f2fe;color:#075985;padding:6px 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;">${escapeHtml(values.modulo)}</div>
                <h1 style="margin:14px 0 6px 0;font-size:22px;line-height:1.25;color:#0f172a;">Demanda registrada</h1>
                <p style="margin:0;color:#64748b;font-size:14px;line-height:1.5;">Protocolo ${escapeHtml(values.protocolo || "-")}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 18px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                        ${automaticSummaryRows(values)}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px 28px;">
                <div style="font-size:15px;line-height:1.65;color:#0f172a;">
                  ${bodyHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5;">
                <strong style="color:#334155;">${escapeHtml(values.user_sistema)}</strong><br />
                E-mail disparado automaticamente. Por favor, não responda esta mensagem.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `
}

async function ensureEmailDispatchColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.admin_judicial_modelos_email
      ADD COLUMN IF NOT EXISTS modulo_disparo TEXT
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.admin_judicial_modelos_email
      ADD COLUMN IF NOT EXISTS disparo_automatico BOOLEAN NOT NULL DEFAULT FALSE
  `)
}

function getMailConfig() {
  const host = process.env.MAIL_HOST?.trim()
  const username = process.env.MAIL_USERNAME?.trim()
  const password = process.env.MAIL_PASSWORD?.trim()
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "SIGAJUS"
  const fromAddress = process.env.MAIL_FROM_ADDRESS?.trim()
  const port = Number(process.env.MAIL_PORT || 587)
  const secure = parseBoolean(process.env.MAIL_SECURE, port === 465)

  const missing = [
    !host ? "MAIL_HOST" : null,
    !username ? "MAIL_USERNAME" : null,
    !password ? "MAIL_PASSWORD" : null,
    !fromAddress ? "MAIL_FROM_ADDRESS" : null,
  ].filter(Boolean) as string[]

  return {
    isConfigured: missing.length === 0,
    missing,
    host,
    username,
    password,
    fromName,
    fromAddress,
    port,
    secure,
  }
}

async function finishNotification(input: DemandNotificationInput, result: NotificationResult) {
  try {
    await recordMunicipalityEmailDispatch({
      protocolo: input.protocolo,
      module: input.module,
      municipio: input.municipio,
      status: result.ok && !result.skipped ? "ENVIADO" : "NAO_ENVIADO",
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      reason: result.reason,
    })
  } catch (error) {
    console.error("RECORD_MUNICIPALITY_EMAIL_DISPATCH_ERROR", error)
  }

  return result
}

export async function sendMunicipalityDemandNotification(input: DemandNotificationInput) {
  try {
    await ensureEmailDispatchColumns()

    const municipio = text(input.municipio)
    if (!municipio) return finishNotification(input, { ok: false, skipped: true, reason: "Município não informado." })

    const [contact] = await prisma.$queryRawUnsafe<MunicipalityContactRow[]>(
      `
        SELECT municipio_nome AS "municipalityName", emails
        FROM public.admin_judicial_municipios_contatos
        WHERE LOWER(TRIM(municipio_nome)) = LOWER(TRIM($1))
        LIMIT 1
      `,
      municipio,
    )

    const recipients = normalizeEmails(contact?.emails)
    if (recipients.length === 0) {
      return finishNotification(input, { ok: false, skipped: true, reason: "Município sem e-mail cadastrado." })
    }

    const [template] = await prisma.$queryRawUnsafe<TemplateRow[]>(
      `
        SELECT assunto AS subject, corpo_html AS body
        FROM public.admin_judicial_modelos_email
        WHERE disparo_automatico = TRUE
          AND LOWER(COALESCE(modulo_disparo, '')) = LOWER($1)
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `,
      normalizeModule(input.module),
    )

    if (!template?.subject || !template?.body) {
      return finishNotification(input, { ok: false, skipped: true, reason: "Modelo de e-mail automático não configurado para o módulo." })
    }

    const config = getMailConfig()
    if (!config.isConfigured) {
      return finishNotification(input, { ok: false, skipped: true, reason: `SMTP não configurado: ${config.missing.join(", ")}` })
    }

    const subject = replaceTokens(template.subject, input)
    const html = wrapEmailHtml(replaceTokens(template.body, input), input)

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
    })

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromAddress}>`,
      to: recipients.join(", "),
      subject,
      html,
    })

    return finishNotification(input, { ok: true, skipped: false, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected })
  } catch (error) {
    console.error("SEND_MUNICIPALITY_DEMAND_NOTIFICATION_ERROR", error)
    return finishNotification(input, { ok: false, skipped: true, reason: error instanceof Error ? error.message : "Erro ao enviar e-mail." })
  }
}
