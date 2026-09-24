/**
 * Copies text to the clipboard. Uses the async Clipboard API where the page
 * is allowed to (a secure context — https or localhost), and falls back to
 * a hidden textarea + `execCommand('copy')` elsewhere. Rejects if neither
 * works, so callers can tell the viewer it didn't happen.
 */
export async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  // The fallback has to select text in a real element, which moves focus;
  // put it back afterwards so a keyboard user isn't dropped at the top of
  // the page.
  const previouslyFocused = document.activeElement as HTMLElement | null
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  let copied = false
  try {
    copied = document.execCommand('copy')
  } finally {
    textarea.remove()
    previouslyFocused?.focus()
  }

  if (!copied) throw new Error('Copy command was rejected')
}

/** Whether to show macOS modifier glyphs (⌘) or spelled-out ones (Ctrl). */
export const IS_MAC_LIKE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
