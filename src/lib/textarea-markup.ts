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

// Leading indent (2 spaces/level, matching indentCurrentLine/outdentCurrentLine) plus either a
// "- " bullet or an "N. " numbered marker, captured separately so a marker swap keeps the line's
// indent level and a numbered marker's own number can be read back out.
const LIST_MARKER_REGEX = /^(\s*)(?:- |(\d+)\. )/

/**
 * Real toggle for the bullet/numbered toolbar buttons (GitHub issue #19) -
 * unlike prefixCurrentLine (still used as-is for plain indent, which must
 * stay purely additive), this reads the current line's existing marker
 * first: same type present -> removed; a different type present -> replaced
 * (matches urs-android's RichTextEditing.kt toggleList - "activating one
 * list type deactivates the other"); no marker -> inserted, indent
 * preserved either way.
 */
export function toggleListPrefix(textarea: HTMLTextAreaElement, type: 'bullet' | 'number'): MarkupEdit {
  const { selectionStart, value } = textarea
  const lineStart = currentLineStart(value, selectionStart)
  const lineEnd = value.indexOf('\n', lineStart)
  const line = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd)
  const match = line.match(LIST_MARKER_REGEX)

  const indent = match ? match[1] : (line.match(/^\s*/)?.[0] ?? '')
  const currentType = match ? (match[2] !== undefined ? 'number' : 'bullet') : null
  const oldMarkerLength = match ? match[0].length : 0
  const newMarker = currentType === type ? indent : indent + (type === 'bullet' ? '- ' : '1. ')

  const newValue = value.slice(0, lineStart) + newMarker + value.slice(lineStart + oldMarkerLength)
  const delta = newMarker.length - oldMarkerLength
  const newPos = Math.max(lineStart, selectionStart + delta)
  return { value: newValue, selectionStart: newPos, selectionEnd: newPos }
}

/**
 * Enter-key list continuation (GitHub issue #19), mirroring urs-android's
 * RichTextEditing.kt handleEnterKey: a non-empty list line continues the
 * list on the new line (auto-incrementing a numbered marker); an empty list
 * line (just the marker, nothing typed after it) exits list mode instead of
 * inserting another empty item. Returns null when the cursor's current line
 * isn't a list line at all, so the caller can fall back to a plain newline.
 */
export function continueListOnEnter(textarea: HTMLTextAreaElement): MarkupEdit | null {
  const { selectionStart, value } = textarea
  const lineStart = currentLineStart(value, selectionStart)
  const lineEnd = value.indexOf('\n', lineStart)
  const line = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd)
  const match = line.match(LIST_MARKER_REGEX)
  if (!match) return null

  const markerLength = match[0].length
  const hasContent = line.slice(markerLength).trim().length > 0

  if (!hasContent) {
    const newValue = value.slice(0, lineStart) + value.slice(lineStart + markerLength)
    return { value: newValue, selectionStart: lineStart, selectionEnd: lineStart }
  }

  const indent = match[1]
  const nextNumber = match[2] !== undefined ? Number(match[2]) + 1 : undefined
  const glyph = nextNumber !== undefined ? `${nextNumber}. ` : '- '
  const insertText = '\n' + indent + glyph
  const newValue = value.slice(0, selectionStart) + insertText + value.slice(selectionStart)
  const newPos = selectionStart + insertText.length
  return { value: newValue, selectionStart: newPos, selectionEnd: newPos }
}
