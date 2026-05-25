export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function" &&
      (window.isSecureContext || window.location.protocol === "http:")
    ) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fallback below
  }

  try {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.setAttribute("readonly", "")
    textArea.style.position = "fixed"
    textArea.style.top = "0"
    textArea.style.left = "0"
    textArea.style.opacity = "0"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    textArea.setSelectionRange(0, textArea.value.length)

    const copied = typeof document.execCommand === "function"
      ? document.execCommand("copy")
      : false

    document.body.removeChild(textArea)
    return copied
  } catch {
    return false
  }
}
