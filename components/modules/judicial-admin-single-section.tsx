"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { JudicialAdminPanel as JudicialAdminPanelReal } from "@/components/modules/judicial-admin-panel-original"
import { Button } from "@/components/ui/button"

const FIXES: Array<[RegExp, string]> = [
  [/Ã§/g, "ç"],
  [/Ã‡/g, "Ç"],
  [/Ã£/g, "ã"],
  [/Ãµ/g, "õ"],
  [/Ã¡/g, "á"],
  [/Ã©/g, "é"],
  [/Ã­/g, "í"],
  [/Ã³/g, "ó"],
  [/Ãº/g, "ú"],
  [/Ãª/g, "ê"],
  [/Ã¢/g, "â"],
  [/Ã´/g, "ô"],
  [/Ã /g, "à"],
  [/Ã�/g, "Á"],
  [/Ã‰/g, "É"],
  [/â€¢/g, "•"],
  [/â€“/g, "–"],
  [/â€”/g, "—"],
]

function fixMojibake(value: string) {
  let next = value
  for (const [pattern, replacement] of FIXES) next = next.replace(pattern, replacement)
  return next
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
  const tabLists = Array.from(root.querySelectorAll<HTMLElement>('[role="tablist"]'))
  for (const tabList of tabLists) tabList.style.display = "none"

  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  const target = tabs.find((tab) => fixMojibake(tab.textContent || "").trim() === tabLabel)
  target?.click()
}

export function JudicialAdminSingleSection({
  tabLabel,
  title,
  description,
}: {
  tabLabel: string
  title: string
  description: string
}) {
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
    const timer = window.setTimeout(apply, 100)
    const observer = new MutationObserver(apply)
    observer.observe(root, { childList: true, subtree: true, characterData: true })

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [tabLabel])

  if (!canAccessJudicialAdmin(user)) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
        Somente administradores podem acessar esta página.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/admin/judicial">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Admin Judicial
          </Link>
        </Button>
      </div>

      <div ref={rootRef}>
        <JudicialAdminPanelReal />
      </div>
    </div>
  )
}
