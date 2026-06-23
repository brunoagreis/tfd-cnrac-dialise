"use client"

import { useEffect } from "react"

const LINK_PATTERN = /\s*Link:\s*(\/api\/municipio\/demandas\/anexo\/baixar\/[^\s]+)/i

function closestMovementContainer(node: Node) {
  const element = node.parentElement
  if (!element) return null

  return element.closest("div.rounded, div.rounded-xl, div[class*='rounded']") as HTMLElement | null
}

function enhanceMunicipalityAttachmentLinks() {
  if (typeof document === "undefined") return

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []

  while (walker.nextNode()) {
    const current = walker.currentNode
    if (current instanceof Text && LINK_PATTERN.test(current.nodeValue || "")) {
      nodes.push(current)
    }
  }

  for (const textNode of nodes) {
    const value = textNode.nodeValue || ""
    const match = value.match(LINK_PATTERN)
    const url = match?.[1]
    if (!url) continue

    const container = closestMovementContainer(textNode)
    if (!container) continue

    const key = `municipio-anexo-${url}`
    if (container.querySelector(`[data-sigajus-municipio-anexo="${key}"]`)) continue

    textNode.nodeValue = value.replace(LINK_PATTERN, "").trim()

    const wrapper = document.createElement("div")
    wrapper.setAttribute("data-sigajus-municipio-anexo", key)
    wrapper.className = "mt-2 flex flex-wrap gap-2"

    const link = document.createElement("a")
    link.href = url
    link.target = "_blank"
    link.rel = "noreferrer"
    link.textContent = "Abrir anexo do município"
    link.className = "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"

    wrapper.appendChild(link)
    container.appendChild(wrapper)
  }
}

export function MunicipalityAttachmentLinkEnhancer() {
  useEffect(() => {
    enhanceMunicipalityAttachmentLinks()

    const observer = new MutationObserver(() => {
      window.setTimeout(enhanceMunicipalityAttachmentLinks, 50)
    })

    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => observer.disconnect()
  }, [])

  return null
}
