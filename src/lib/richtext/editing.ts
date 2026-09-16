// Live editing operations on the rich-text field's StyledText value - a
// TypeScript port of urs-android's RichTextEditing.kt. markup.ts's parse/
// serialize functions are only used at the load/save boundary; while the
// field is being edited, the canonical state is this StyledText value plus
// a plain character-offset selection, reconciled against raw DOM edits by
// RichTextField.tsx (see that file for the beforeinput-driven diff, the web
// equivalent of Compose's BasicTextField edit callback).

import {
  BULLET_GLYPH,
  INDENT_SPACES_PER_LEVEL,
  MAX_LIST_LEVEL,
  PLAIN_STYLE,
  type CharStyle,
  type ListMarker,
  type ListType,
  type StyledText,
  concat,
  currentMarkerNumber,
  lineStart,
  linkAt,
  listMarkerAt,
  plainStyledText,
  replaceRangeWithLink,
  resolveStyleRuns,
  styleFlag,
  subSequence,
  withCharStyle,
} from './model'

export type EditorSelection = { start: number; end: number }
export type EditorValue = { value: StyledText; selection: EditorSelection }

/** Common-prefix/common-suffix diff: [prefix, oldSuffixStart, newSuffixStart). */
function computeSplice(oldText: string, newText: string): { prefix: number; oldSuffixStart: number; newSuffixStart: number } {
  const maxPrefix = Math.min(oldText.length, newText.length)
  let prefix = 0
  while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix++
  let oldEnd = oldText.length
  let newEnd = newText.length
  while (oldEnd > prefix && newEnd > prefix && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--
    newEnd--
  }
  return { prefix, oldSuffixStart: oldEnd, newSuffixStart: newEnd }
}

// Splices the edit into the styled string by keeping the old prefix/suffix (with their
// annotations intact, via subSequence) and inserting the new text plain, or under
// pendingStyle if one is armed - newly typed text never inherits an adjacent span's style
// implicitly, only the explicit pending-style toggle applies going forward.
function spliceEdit(old: StyledText, newText: string, prefix: number, oldSuffixStart: number, newSuffixStart: number, pendingStyle: CharStyle): StyledText {
  const insertedText = newText.slice(prefix, newSuffixStart)
  const insertedStyled = insertedText.length === 0 ? plainStyledText('') : plainStyledText(insertedText, pendingStyle)
  return concat(subSequence(old, 0, prefix), insertedStyled, subSequence(old, oldSuffixStart, old.text.length))
}

/**
 * Reconciles a raw DOM edit (new plain text + the selection the browser
 * reports afterward) against the styled current value, then applies list/
 * link editing behavior (Enter/Backspace on a list line, auto-linkify).
 * newText is not trusted for styling - only its content and the reported
 * selection are used.
 */
export function applyRichTextEdit(current: EditorValue, newText: string, newSelection: EditorSelection, pendingStyle: CharStyle): EditorValue {
  const { prefix, oldSuffixStart, newSuffixStart } = computeSplice(current.value.text, newText)
  const insertedText = newText.slice(prefix, newSuffixStart)
  const deletedLen = oldSuffixStart - prefix
  const spliced = spliceEdit(current.value, newText, prefix, oldSuffixStart, newSuffixStart, insertedText.length > 0 ? pendingStyle : PLAIN_STYLE)
  let result: EditorValue = { value: spliced, selection: newSelection }

  // Position of the last character just inserted - reported directly by the caller (derived
  // from the DOM selection after the edit), not re-derived from the prefix/suffix diff, which
  // is genuinely ambiguous whenever the inserted character is identical to its neighbor (e.g.
  // pressing Enter anywhere except the very end of the text, where the freshly typed "\n" sits
  // right before the already-existing "\n" ending that line).
  const insertedEndPos = insertedText.length > 0 && newSelection.start === newSelection.end ? newSelection.start : prefix + insertedText.length

  // handleEnterKey's "exit list mode" branch removes the previous line's marker text before
  // prefix, shrinking the text and invalidating any offset computed against the pre-call
  // length - including the auto-linkify position below. Skip auto-linkify for that edit rather
  // than reusing a now-stale index; there's nothing meaningful to linkify there anyway, since
  // what was removed was a list marker, not user-typed text.
  let skipAutoLinkify = false
  if (insertedText.endsWith('\n') && deletedLen === 0) {
    const newlinePos = insertedEndPos - 1
    const beforeLength = result.value.text.length
    result = handleEnterKey(result, newlinePos)
    if (result.value.text.length < beforeLength) skipAutoLinkify = true
  } else if (insertedText.length === 0 && deletedLen === 1) {
    result = handleBackspaceAtMarker(current.value, result, prefix)
  }
  if (!skipAutoLinkify && insertedText.length > 0 && (insertedText[insertedText.length - 1] === ' ' || insertedText[insertedText.length - 1] === '\n')) {
    result = autoLinkify(result, insertedEndPos - 1)
  }
  return result
}

// Enter on a non-empty list line continues the list at the same level/type, auto-incrementing a
// numbered marker off the current line's own number. Enter on an empty list line exits list mode
// instead of inserting another empty item (standard "double-enter exits list" behavior).
function handleEnterKey(value: EditorValue, newlinePos: number): EditorValue {
  const styled = value.value
  const text = styled.text
  const prevLineStart = lineStart(text, newlinePos)
  const marker = listMarkerAt(styled, prevLineStart)
  if (!marker) return value
  const hasContent = marker.end < newlinePos

  if (!hasContent) {
    const updated = concat(subSequence(styled, 0, prevLineStart), subSequence(styled, marker.end, styled.text.length))
    return { value: updated, selection: { start: prevLineStart + 1, end: prevLineStart + 1 } }
  }

  const nextNumber = marker.type === 'NUMBER' ? currentMarkerNumber(text, marker) + 1 : undefined
  const insertPos = newlinePos + 1
  const indent = ' '.repeat(marker.level * INDENT_SPACES_PER_LEVEL)
  const glyph = marker.type === 'BULLET' ? BULLET_GLYPH : `${nextNumber}. `
  const insertText = indent + glyph
  const markerPart: StyledText = { text: insertText, spans: [], listMarkers: [{ start: 0, end: insertText.length, type: marker.type, level: marker.level }], links: [] }
  const updated = concat(subSequence(styled, 0, insertPos), markerPart, subSequence(styled, insertPos, styled.text.length))
  const markerEnd = insertPos + insertText.length
  return { value: updated, selection: { start: markerEnd, end: markerEnd } }
}

// Backspacing the marker's own trailing space removes the whole marker in one step (dropping list
// mode for that line) instead of leaving a broken partial marker like "•" with no trailing space.
function handleBackspaceAtMarker(current: StyledText, spliced: EditorValue, deletePos: number): EditorValue {
  const ls = lineStart(current.text, deletePos + 1)
  const marker = listMarkerAt(current, ls)
  if (!marker || deletePos !== marker.end - 1) return spliced

  const styled = spliced.value
  const removeEnd = marker.end - 1
  const updated = concat(subSequence(styled, 0, ls), subSequence(styled, removeEnd, styled.text.length))
  return { value: updated, selection: { start: ls, end: ls } }
}

const URL_LIKE_REGEX = /^(https?:\/\/|www\.)\S+$/i

// Converts a bare URL-looking token into a link the moment it's followed by a space or line
// break, whether typed one character at a time or landing all at once via paste.
export function autoLinkify(value: EditorValue, separatorPos: number): EditorValue {
  const text = value.value.text
  const lineBegin = lineStart(text, separatorPos)
  let tokenStart = separatorPos
  while (tokenStart > lineBegin && !/\s/.test(text[tokenStart - 1])) tokenStart--
  if (tokenStart >= separatorPos) return value

  const token = text.slice(tokenStart, separatorPos)
  if (!URL_LIKE_REGEX.test(token)) return value
  if (linkAt(value.value, tokenStart)) return value

  const url = /^www\./i.test(token) ? `https://${token}` : token
  const updated = replaceRangeWithLink(value.value, tokenStart, separatorPos, token, url)
  return { ...value, value: updated }
}

/**
 * Toggles flag on value's selection (or arms/disarms pendingStyle for a
 * collapsed cursor). Returns the possibly-updated field value alongside the
 * pending style to keep around for the next keystroke.
 */
export function toggleCharStyle(
  value: EditorValue,
  pendingStyle: CharStyle,
  flag: (s: CharStyle) => boolean,
  set: (s: CharStyle, v: boolean) => CharStyle,
): { value: EditorValue; pendingStyle: CharStyle } {
  const { start, end } = value.selection
  if (start === end) {
    return { value, pendingStyle: set(pendingStyle, !flag(pendingStyle)) }
  }
  const targetStart = Math.min(start, end)
  const targetEnd = Math.max(start, end)
  const currentlyUniform = styleFlag(value.value, targetStart, targetEnd, flag)
  const updated = withCharStyle(value.value, targetStart, targetEnd, (s) => set(s, !currentlyUniform))
  return { value: { ...value, value: updated }, pendingStyle }
}

// Line-start offsets (in text's current shape) touched by selection, or just the cursor's own
// line when the selection is collapsed.
function affectedLineStarts(text: string, selection: EditorSelection): number[] {
  const from = Math.min(selection.start, selection.end)
  const to = Math.max(selection.start, selection.end)
  const starts: number[] = []
  let pos = lineStart(text, from)
  starts.push(pos)
  let idx = text.indexOf('\n', pos)
  while (idx !== -1 && idx < to) {
    pos = idx + 1
    starts.push(pos)
    idx = text.indexOf('\n', pos)
  }
  return starts
}

// Applies a per-line edit (returning the updated value plus how many characters that line grew
// or shrank by) to every affected line in order, tracking the cumulative offset shift so each
// line is located correctly in the progressively-updated string, and keeping the selection
// anchored relative to the edits as they land.
function applyToLines(value: EditorValue, transformLine: (styled: StyledText, lineStartOffset: number) => [StyledText, number]): EditorValue {
  let styled = value.value
  const originalStarts = affectedLineStarts(styled.text, value.selection)
  let delta = 0
  let selStart = value.selection.start
  let selEnd = value.selection.end
  for (const originalStart of originalStarts) {
    const actualStart = originalStart + delta
    const [updated, lineDelta] = transformLine(styled, actualStart)
    styled = updated
    if (selStart >= actualStart) selStart += lineDelta
    if (selEnd >= actualStart) selEnd += lineDelta
    delta += lineDelta
  }
  return {
    value: styled,
    selection: {
      start: Math.min(Math.max(selStart, 0), styled.text.length),
      end: Math.min(Math.max(selEnd, 0), styled.text.length),
    },
  }
}

/** Activating one list type on a line deactivates the other one if it was active, per line touched by the selection. */
export function toggleList(value: EditorValue, type: ListType): EditorValue {
  return applyToLines(value, (styled, ls) => {
    const marker = listMarkerAt(styled, ls)
    if (marker && marker.type === type) {
      const updated = concat(subSequence(styled, 0, ls), subSequence(styled, marker.end, styled.text.length))
      return [updated, -(marker.end - marker.start)]
    }
    const level = marker ? marker.level : 0
    const glyph = type === 'BULLET' ? BULLET_GLYPH : '1. '
    const insertText = ' '.repeat(level * INDENT_SPACES_PER_LEVEL) + glyph
    const withoutOldMarker = marker ? concat(subSequence(styled, 0, ls), subSequence(styled, marker.end, styled.text.length)) : styled
    const markerPart: StyledText = { text: insertText, spans: [], listMarkers: [{ start: 0, end: insertText.length, type, level }], links: [] }
    const updated = concat(subSequence(withoutOldMarker, 0, ls), markerPart, subSequence(withoutOldMarker, ls, withoutOldMarker.text.length))
    const delta = insertText.length - (marker ? marker.end - marker.start : 0)
    return [updated, delta]
  })
}

/** No-op on non-list lines; otherwise increases the level up to MAX_LIST_LEVEL, restarting numbered items at 1. */
export function indentList(value: EditorValue): EditorValue {
  return applyToLines(value, (styled, ls) => {
    const marker = listMarkerAt(styled, ls)
    if (!marker || marker.level >= MAX_LIST_LEVEL) return [styled, 0]
    return rewriteMarker(styled, ls, marker, marker.level + 1, true)
  })
}

/** No-op on non-list lines; decreases the level, or exits list mode entirely from level 0. */
export function outdentList(value: EditorValue): EditorValue {
  return applyToLines(value, (styled, ls) => {
    const marker = listMarkerAt(styled, ls)
    if (!marker) return [styled, 0]
    if (marker.level === 0) {
      const updated = concat(subSequence(styled, 0, ls), subSequence(styled, marker.end, styled.text.length))
      return [updated, -(marker.end - marker.start)]
    }
    return rewriteMarker(styled, ls, marker, marker.level - 1, false)
  })
}

// Shared by indent/outdent: rewrites a line's marker (indent spaces + glyph) at newLevel,
// keeping the annotation range in sync. Numbered items either restart at 1 (indenting into a
// fresh sub-level) or resume off the nearest same-level sibling above (outdenting back into an
// already-numbered parent level) - this is a best-effort live estimate; the authoritative
// renumbering always happens at save time (see markup.ts's serializeRichText).
function rewriteMarker(styled: StyledText, ls: number, marker: ListMarker, newLevel: number, resetNumber: boolean): [StyledText, number] {
  const text = styled.text
  const number = marker.type === 'NUMBER' ? (resetNumber ? 1 : nearestSiblingNumber(text, styled, ls, newLevel, marker.type)) : undefined
  const glyph = marker.type === 'BULLET' ? BULLET_GLYPH : `${number}. `
  const insertText = ' '.repeat(newLevel * INDENT_SPACES_PER_LEVEL) + glyph
  const markerPart: StyledText = { text: insertText, spans: [], listMarkers: [{ start: 0, end: insertText.length, type: marker.type, level: newLevel }], links: [] }
  const updated = concat(subSequence(styled, 0, ls), markerPart, subSequence(styled, marker.end, styled.text.length))
  const delta = insertText.length - (marker.end - marker.start)
  return [updated, delta]
}

function nearestSiblingNumber(text: string, styled: StyledText, fromLineStart: number, level: number, type: ListType): number {
  let searchFrom = fromLineStart
  while (searchFrom > 0) {
    const prevStart = lineStart(text, searchFrom - 1)
    const marker = listMarkerAt(styled, prevStart)
    if (!marker) return 1
    if (marker.level < level) return 1
    if (marker.level === level) return marker.type === type ? currentMarkerNumber(text, marker) + 1 : 1
    searchFrom = prevStart
  }
  return 1
}

// Re-exported so RichTextField.tsx's toolbar-active-state computation can share the exact same
// "what style applies to this selection" logic the serializer/toggle functions use.
export { resolveStyleRuns }
