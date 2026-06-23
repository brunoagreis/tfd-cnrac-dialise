"use client"

import { useEffect } from "react"

function isEmailEditor(element: Element) {
  return (
    element instanceof HTMLElement &&
    element.isContentEditable &&
    element.className.includes("prose") &&
    element.className.includes("min-h-[280px]")
  )
}

function findEmailEditors() {
  return Array.from(document.querySelectorAll('[contenteditable="true"]')).filter(isEmailEditor)
}

export function JudicialEmailEditorCaretFix() {
  useEffect(() => {
    const cleanupFns: Array<() => void> = []

    function bindEditor(editor: Element) {
      const marker = "sigajusCaretFixBound"
      const target = editor as HTMLElement & { [key: string]: unknown }

      if (target[marker]) return
      target[marker] = true

      const stopReactInputSync = (event: Event) => {
        // O editor salva o HTML diretamente ao clicar em "Salvar modelo".
        // Não deixamos o React sincronizar estado a cada tecla, porque isso
        // recria o contentEditable e move o cursor para o início.
        event.stopPropagation()
      }

      editor.addEventListener("input", stopReactInputSync, true)

      cleanupFns.push(() => {
        editor.removeEventListener("input", stopReactInputSync, true)
        target[marker] = false
      })
    }

    function bindAll() {
      for (const editor of findEmailEditors()) bindEditor(editor)
    }

    bindAll()

    const observer = new MutationObserver(() => bindAll())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      cleanupFns.forEach((cleanup) => cleanup())
    }
  }, [])

  return null
}
