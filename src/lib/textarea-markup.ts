// Inserts/wraps text in a plain <textarea> using the exact same markup
// syntax urs-android's rich-text editor reads and writes (RichTextMarkup.kt):
// **bold**, ~italic~, __underline__, [text](url), "- " bullets, "N. "
// numbered lines, 2 leading spaces per indent level. Not a WYSIWYG editor -
// this operates on the raw markup string so content stays cross-compatible
// with the Android app, which is what actually renders it.
export type MarkupEdit = { value: string; selectionStart: number; selectionEnd: number }

export function wrapSelection(textarea: HTMLTextAreaElement, marker: string): MarkupEdit {
  const { selectionStart, selectionEnd, value } = textarea
  const selected = value.slice(selectionStart, selectionEnd)
  const newValue = value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd)
  return {
    value: newValue,
    selectionStart: selectionStart + marker.length,
    selectionEnd: selectionStart + marker.length + selected.length,
  }
}

export function wrapAsLink(textarea: HTMLTextAreaElement, url: string): MarkupEdit {
  const { selectionStart, selectionEnd, value } = textarea
  const selected = value.slice(selectionStart, selectionEnd) || url
  const inserted = `[${selected}](${url})`
  const newValue = value.slice(0, selectionStart) + inserted + value.slice(selectionEnd)
  return { value: newValue, selectionStart: selectionStart + inserted.length, selectionEnd: selectionStart + inserted.length }
}

function currentLineStart(value: string, cursor: number): number {
  const idx = value.lastIndexOf('\n', cursor - 1)
  return idx + 1
}

export function prefixCurrentLine(textarea: HTMLTextAreaElement, prefix: string): MarkupEdit {
  const { selectionStart, value } = textarea
  const lineStart = currentLineStart(value, selectionStart)
  const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart)
  return { value: newValue, selectionStart: selectionStart + prefix.length, selectionEnd: selectionStart + prefix.length }
}

export function indentCurrentLine(textarea: HTMLTextAreaElement): MarkupEdit {
  return prefixCurrentLine(textarea, '  ')
}

export function outdentCurrentLine(textarea: HTMLTextAreaElement): MarkupEdit {
  const { selectionStart, value } = textarea
  const lineStart = currentLineStart(value, selectionStart)
  const removable = value.slice(lineStart, lineStart + 2) === '  ' ? 2 : value[lineStart] === ' ' ? 1 : 0
  const newValue = value.slice(0, lineStart) + value.slice(lineStart + removable)
  return {
    value: newValue,
    selectionStart: Math.max(lineStart, selectionStart - removable),
    selectionEnd: Math.max(lineStart, selectionStart - removable),
  }
}
