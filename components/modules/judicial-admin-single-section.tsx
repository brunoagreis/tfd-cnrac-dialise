"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { JudicialAdminPanel as JudicialAdminPanelReal } from "@/components/modules/judicial-admin-panel-original"
import { Button } from "@/components/ui/button"

function fixMojibake(value: string) {
  try {
    return decodeURIComponent(escape(value))
  } catch {
    return value
  }
}

function fixTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    const fixed = fixMojibake(node.nodeValue || "")
    if (fixed !== node.nodeValue) node.nodeValue = fixed
  }
}

function activateInternalTab(root: HTMLElement, tabLabel: string) {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const target = tabs.find((tab) => fixMojibake(tab.textContent || "").trim() === tabLabel)
  if (target && target.getAttribute("aria-selected") !== "true" && target.getAttribute("data-state") !== "active") {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  }

  const tabLists = Array.from(root.querySelectorAll<HTMLElement>('[role="tablist"]'))
  for (const tabList of tabLists) {
    tabList.style.position = "absolute"
    tabList.style.width = "1px"
    tabList.style.height = "1px"
    tabList.style.overflow = "hidden"
    tabList.style.clipPath = "inset(50%)"
    tabList.style.whiteSpace = "nowrap"
  }
}

export function JudicialAdminSingleSection({ tabLabel, title, description }: { tabLabel: string; title: string; description: string }) {
  const { user } = useAuth()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const apply = () => {
      activateInternalTab(root, tabLabel)
      fixTextNodes(root)
    }

    apply()
    const timers = [50, 150, 400].map((ms) => window.setTimeout(apply, ms))
    const observer = new MutationObserver(() => window.setTimeout(apply, 0))
    observer.observe(root, { childList: true, subtree: true })

    return () => {
      timers.forEach(window.clearTimeout)
      observer.disconnect()
    }
  }, [tabLabel])

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar esta página.</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link>
        </Button>
      </div>
      <div ref={rootRef}><JudicialAdminPanelReal /></div>
    </div>
  )
}
