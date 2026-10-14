/**
 * Copies text to the clipboard. Tries the modern Clipboard API first, then falls back to
 * the older execCommand method, which still works in browsers or embedded panes that block
 * navigator.clipboard. Resolves true when the text was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy method.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  const active = document.activeElement as HTMLElement | null;
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  active?.focus?.();
  return ok;
}

/** Selects all text inside an element so the user can press Cmd/Ctrl+C. */
export function selectContents(el: HTMLElement | null) {
  if (!el) return;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.focus();
    el.select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export const copyShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘C" : "Ctrl+C";
