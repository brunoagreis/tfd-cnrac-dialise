"use client"

import { useEffect } from "react"

const BUTTON_COMMANDS = [
  { command: "bold" },
  { command: "italic" },
  { command: "underline" },
  { command: "strikeThrough" },
  { command: "justifyLeft" },
  { command: "justifyCenter" },
  { command: "justifyRight" },
  { command: "insertUnorderedList" },
  { command: "insertOrderedList" },
  { command: "formatBlock", value: "<p>" },
  { command: "removeFormat" },
]

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

function getToolbar(editor: Element) {
  const toolbar = editor.previousElementSibling
  if (!toolbar || !(toolbar instanceof HTMLElement)) return null
  return toolbar
}

function getEditorSelectionRange(editor: Element) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return null

  return range.cloneRange()
}

function restoreSelection(range: Range | null) {
  if (!range) return

  const selection = window.getSelection()
  if (!selection) return

  selection.removeAllRanges()
  selection.addRange(range)
}

export function JudicialEmailEditorCaretFix() {
  useEffect(() => {
    const cleanupFns: Array<() => void> = []

    function bindEditor(editor: Element) {
      const marker = "sigajusCaretFixBound"
      const target = editor as HTMLElement & { [key: string]: unknown }

      if (target[marker]) return
      target[marker] = true

      let lastRange: Range | null = null

      const saveRange = () => {
        const currentRange = getEditorSelectionRange(editor)
        if (currentRange) lastRange = currentRange
      }

      const stopReactInputSync = (event: Event) => {
        // O editor salva o HTML diretamente ao clicar em "Salvar modelo".
        // Não deixamos o React sincronizar estado a cada tecla, porque isso
        // recria o contentEditable e move o cursor para o início.
        saveRange()
        event.stopPropagation()
      }

      const toolbar = getToolbar(editor)

      const preventToolbarButtonFocusLoss = (event: MouseEvent) => {
        const button = (event.target as HTMLElement | null)?.closest("button")
        if (!button || !toolbar?.contains(button)) return

        saveRange()
        event.preventDefault()
      }

      const runCommandWithoutReactSync = (event: MouseEvent) => {
        const button = (event.target as HTMLElement | null)?.closest("button")
        if (!button || !toolbar?.contains(button)) return

        const buttons = Array.from(toolbar.querySelectorAll("button"))
        const index = buttons.indexOf(button)
        const item = BUTTON_COMMANDS[index]

        if (!item) return

        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        ;(editor as HTMLElement).focus()
        restoreSelection(lastRange)
        document.execCommand("styleWithCSS", false, "true")
        document.execCommand(item.command, false, item.value)
        saveRange()
      }

      const runSelectCommandWithoutReactSync = (event: Event) => {
        const select = (event.target as HTMLElement | null)?.closest("select") as HTMLSelectElement | null
        if (!select || !toolbar?.contains(select)) return

        const selects = Array.from(toolbar.querySelectorAll("select"))
        const index = selects.indexOf(select)
        const command = index === 0 ? "fontName" : index === 1 ? "fontSize" : ""

        if (!command) return

        event.stopPropagation()
        if ("stopImmediatePropagation" in event) event.stopImmediatePropagation()

        ;(editor as HTMLElement).focus()
        restoreSelection(lastRange)
        document.execCommand("styleWithCSS", false, "true")
        document.execCommand(command, false, select.value)
        saveRange()
      }

      editor.addEventListener("input", stopReactInputSync, true)
      editor.addEventListener("keyup", saveRange)
      editor.addEventListener("mouseup", saveRange)
      editor.addEventListener("blur", saveRange)
      toolbar?.addEventListener("mousedown", preventToolbarButtonFocusLoss, true)
      toolbar?.addEventListener("click", runCommandWithoutReactSync, true)
      toolbar?.addEventListener("change", runSelectCommandWithoutReactSync, true)

      cleanupFns.push(() => {
        editor.removeEventListener("input", stopReactInputSync, true)
        editor.removeEventListener("keyup", saveRange)
        editor.removeEventListener("mouseup", saveRange)
        editor.removeEventListener("blur", saveRange)
        toolbar?.removeEventListener("mousedown", preventToolbarButtonFocusLoss, true)
        toolbar?.removeEventListener("click", runCommandWithoutReactSync, true)
        toolbar?.removeEventListener("change", runSelectCommandWithoutReactSync, true)
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
