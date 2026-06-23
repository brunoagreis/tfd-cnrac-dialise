"use client"

import { useEffect } from "react"

const placeholderHtml = `
  <div style="display:grid;gap:12px;">
    <div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px;padding:12px;color:#1e3a8a;line-height:1.45;">
      <strong>Placeholders disponíveis.</strong><br />
      O cabeçalho automático do SIGAJUS mostra apenas módulo, protocolo, município e número do processo. Os demais dados só aparecem se forem usados no modelo cadastrado.
    </div>

    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;">
      <strong>Dados pessoais do paciente</strong>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
        ${[
          "$nome_paciente",
          "$paciente_nome",
          "$requerente",
          "$cpf",
          "$paciente_cpf",
          "$cns",
          "$paciente_cns",
          "$cartao_sus",
          "$telefone_paciente",
          "$paciente_telefone",
          "$email_paciente",
          "$paciente_email",
          "$data_nascimento",
          "$nascimento_paciente",
          "$endereco_paciente",
        ].map(tokenChip).join("")}
      </div>
    </div>

    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;">
      <strong>Comuns a todos os módulos</strong>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
        ${[
          "$protocolo",
          "$modulo",
          "$municipio",
          "$municipio_paciente",
          "$local_solicitante",
          "$email_solicitante",
          "$telefone_solicitante",
          "$local_solicitado",
          "$tipo_solicitacao",
          "$observacoes",
          "$observacoes_unidade",
          "$user_sistema",
        ].map(tokenChip).join("")}
      </div>
    </div>

    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;">
      <strong>Dados clínicos/procedimento</strong>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
        ${[
          "$sigtap",
          "$codigo_sigtap",
          "$sigtap_descricao",
          "$descricao_sigtap",
          "$procedimento",
          "$procedimento_sigtap",
          "$cid",
          "$cid10",
          "$especialidade",
          "$subespecialidade",
          "$peso",
          "$altura",
          "$tipo_sanguineo",
        ].map(tokenChip).join("")}
      </div>
    </div>

    ${moduleBlock("TFD", [
      "$protocolo_tfd",
      "$origem",
      "$destino",
      "$tipo_solicitacao",
      "$data_agendamento",
    ])}

    ${moduleBlock("CNRAC", [
      "$protocolo_cnrac",
      "$procedimento_cnrac",
      "$cid_cnrac",
      "$ficha_core",
      "$origem",
      "$destino",
    ])}

    ${moduleBlock("Hemodiálise", [
      "$protocolo_hemodialise",
      "$peso",
      "$altura",
      "$tipo_sanguineo",
      "$origem",
      "$destino",
    ])}

    ${moduleBlock("Judicial", [
      "$protocolo_judicial",
      "$numero_processo",
      "$autos_acao",
      "$processo",
      "$pge_net",
      "$numero_pge_net",
      "$numero_oficio",
      "$oficio",
      "$tipo_intimacao",
      "$data_recebimento",
      "$data_reiteracao",
      "$prazo_dias",
      "$prazo_final",
    ])}

    ${moduleBlock("Pré Judicial", [
      "$protocolo_prejudicial",
      "$data_agendamento",
      "$numero_processo",
      "$pge_net",
      "$prazo_dias",
      "$prazo_final",
    ])}
  </div>
`

function tokenChip(token: string) {
  return `<code style="border:1px solid #e5e7eb;background:#f8fafc;border-radius:6px;padding:4px 7px;font-size:12px;color:#0f172a;">${token}</code>`
}

function moduleBlock(title: string, tokens: string[]) {
  return `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;">
      <strong>${title}</strong>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
        ${tokens.map(tokenChip).join("")}
      </div>
    </div>
  `
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase()
}

function findEmailCardTitle() {
  const elements = Array.from(document.querySelectorAll("h1,h2,h3,div,p,span"))
  return elements.find((element) => normalizeText(element.textContent || "") === "modelo de e-mail")
}

function removeHeaderDescription(title: Element) {
  let sibling = title.nextElementSibling
  while (sibling) {
    const text = normalizeText(sibling.textContent || "")
    if (text.includes("use placeholders como")) {
      sibling.remove()
      return
    }
    sibling = sibling.nextElementSibling
  }
}

function replaceInlinePlaceholderBox() {
  const boxes = Array.from(document.querySelectorAll("div"))

  for (const box of boxes) {
    const text = normalizeText(box.textContent || "")
    const alreadyEnhanced = box.getAttribute("data-sigajus-placeholders") === "enhanced"

    if (alreadyEnhanced) continue

    if (text.startsWith("placeholders dispon") && text.includes("$ficha_core") && text.includes("$user_sistema")) {
      box.setAttribute("data-sigajus-placeholders", "enhanced")
      box.className = "rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground"
      box.innerHTML = placeholderHtml
      return
    }
  }
}

function applyEnhancement() {
  const title = findEmailCardTitle()
  if (title) removeHeaderDescription(title)
  replaceInlinePlaceholderBox()
}

export function JudicialEmailPlaceholdersInline() {
  useEffect(() => {
    applyEnhancement()

    const observer = new MutationObserver(() => applyEnhancement())
    observer.observe(document.body, { childList: true, subtree: true })

    const interval = window.setInterval(applyEnhancement, 1000)

    return () => {
      observer.disconnect()
      window.clearInterval(interval)
    }
  }, [])

  return null
}
