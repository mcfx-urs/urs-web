// Styled-text value model behind the rich-text editor (GitHub issue #20) -
// a TypeScript port of urs-android's RichTextSpans.kt/CharStyle.kt. Mirrors
// Compose's AnnotatedString shape: a plain text string plus separate
// annotation layers (character style spans, list markers, link ranges)
// addressed by character offset - not a DOM/HTML representation.
//
// Two kinds of metadata ride along independently of the character spans,
// same split as the Android side:
// - listMarkers marks a line's marker-prefix range ("• " or "2. ", including
//   its leading indent spaces) with its type/level - this is what lets a
//   plain line that merely *looks* like "- foo" or "1. foo" round-trip as
//   plain text instead of being misread as a real list item (see markup.ts).
// - links marks a link's visible text range with its URL.
//
// Link *visuals* (accent color + underline) are deliberately kept out of
// this model entirely, computed only at render time - so resolving manual
// bold/italic/underline via resolveStyleRuns never mistakes a link's fixed
// display underline for a manually toggled one.

export type CharStyle = { bold: boolean; italic: boolean; underline: boolean }

export const PLAIN_STYLE: CharStyle = { bold: false, italic: false, underline: false }

export function isPlainStyle(style: CharStyle): boolean {
  return !style.bold && !style.italic && !style.underline
}

export type ListType = 'BULLET' | 'NUMBER'

export type Span = { start: number; end: number; style: CharStyle }
export type ListMarker = { start: number; end: number; type: ListType; level: number }
export type LinkRange = { start: number; end: number; url: string }

export type StyledText = {
  text: string
  spans: Span[]
  listMarkers: ListMarker[]
  links: LinkRange[]
}

export const EMPTY_STYLED_TEXT: StyledText = { text: '', spans: [], listMarkers: [], links: [] }

export const INDENT_SPACES_PER_LEVEL = 2
export const MAX_LIST_LEVEL = 4
export const BULLET_GLYPH = '• '

/** The list marker (if any) starting exactly at lineStart - the sole source of truth for "is this a real list line". */
export function listMarkerAt(value: StyledText, lineStart: number): ListMarker | undefined {
  return value.listMarkers.find((m) => m.start === lineStart)
}

/** The link (if any) that strictly contains offset - used for tap-to-edit detection. */
export function linkAt(value: StyledText, offset: number): LinkRange | undefined {
  return value.links.find((l) => l.start <= offset && l.end > offset)
}

/** All links whose range intersects [start, end), clipped to it. */
export function linksIn(value: StyledText, start: number, end: number): LinkRange[] {
  return value.links
    .filter((l) => l.start < end && l.end > start)
    .map((l) => ({ start: Math.max(l.start, start), end: Math.min(l.end, end), url: l.url }))
    .sort((a, b) => a.start - b.start)
}

export type StyleRun = { start: number; end: number; style: CharStyle }

/**
 * Folds all overlapping spans within [start, end) into the minimal set of
 * non-overlapping style runs - the single source of truth for "what
 * bold/italic/underline combination applies at a given position", used both
 * by markup serialization and by the toolbar's selection-toggle logic.
 */
export function resolveStyleRuns(value: StyledText, start = 0, end = value.text.length): StyleRun[] {
  const s0 = Math.min(Math.max(start, 0), value.text.length)
  const e0 = Math.min(Math.max(end, 0), value.text.length)
  if (s0 >= e0) return []
  const cuts = new Set<number>([s0, e0])
  for (const span of value.spans) {
    const s = Math.min(Math.max(span.start, s0), e0)
    const e = Math.min(Math.max(span.end, s0), e0)
    if (s < e) {
      cuts.add(s)
      cuts.add(e)
    }
  }
  const sorted = [...cuts].sort((a, b) => a - b)
  const runs: StyleRun[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i]
    const e = sorted[i + 1]
    if (s >= e) continue
    let bold = false
    let italic = false
    let underline = false
    for (const span of value.spans) {
      if (span.start <= s && span.end >= e) {
        bold = bold || span.style.bold
        italic = italic || span.style.italic
        underline = underline || span.style.underline
      }
    }
    runs.push({ start: s, end: e, style: { bold, italic, underline } })
  }
  return runs
}

/** True only when [start, end) is non-empty and every character in it already has flag set. */
export function styleFlag(value: StyledText, start: number, end: number, flag: (s: CharStyle) => boolean): boolean {
  if (start >= end) return false
  const runs = resolveStyleRuns(value, start, end)
  return runs.length > 0 && runs.every((r) => flag(r.style))
}

/**
 * Rewrites the character-style layer for the whole string, applying
 * transform only to runs overlapping [start, end). Rebuilds the layer from
 * scratch every time (rather than surgically patching individual spans) so
 * the "minimal non-overlapping partition" invariant resolveStyleRuns relies
 * on always holds afterward. List/link annotations are untouched since
 * their ranges are unaffected (the text itself never changes length here).
 */
export function withCharStyle(value: StyledText, start: number, end: number, transform: (s: CharStyle) => CharStyle): StyledText {
  const len = value.text.length
  if (len === 0) return value
  const s0 = Math.min(Math.max(start, 0), len)
  const e0 = Math.min(Math.max(end, 0), len)
  const cuts = new Set<number>([0, len, s0, e0])
  for (const span of value.spans) {
    cuts.add(Math.min(Math.max(span.start, 0), len))
    cuts.add(Math.min(Math.max(span.end, 0), len))
  }
  const sorted = [...cuts].sort((a, b) => a - b)
  const spans: Span[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i]
    const e = sorted[i + 1]
    if (s >= e) continue
    let style: CharStyle = { bold: false, italic: false, underline: false }
    for (const span of value.spans) {
      if (span.start <= s && span.end >= e) {
        style = {
          bold: style.bold || span.style.bold,
          italic: style.italic || span.style.italic,
          underline: style.underline || span.style.underline,
        }
      }
    }
    if (s < e0 && e > s0) style = transform(style)
    if (!isPlainStyle(style)) spans.push({ start: s, end: e, style })
  }
  return { ...value, spans }
}

/** Extracts [start, end) as its own StyledText, clipping/shifting every annotation layer to match. */
export function subSequence(value: StyledText, start: number, end: number): StyledText {
  const s = Math.max(0, start)
  const e = Math.min(value.text.length, end)
  const text = value.text.slice(s, e)
  function clip<T extends { start: number; end: number }>(items: T[]): T[] {
    return items
      .filter((it) => it.start < e && it.end > s)
      .map((it) => ({ ...it, start: Math.max(it.start, s) - s, end: Math.min(it.end, e) - s }))
  }
  return { text, spans: clip(value.spans), listMarkers: clip(value.listMarkers), links: clip(value.links) }
}

/** Concatenates several StyledTexts end to end, shifting each part's annotation ranges by the running offset. */
export function concat(...parts: StyledText[]): StyledText {
  let text = ''
  const spans: Span[] = []
  const listMarkers: ListMarker[] = []
  const links: LinkRange[] = []
  for (const part of parts) {
    const offset = text.length
    text += part.text
    for (const s of part.spans) spans.push({ ...s, start: s.start + offset, end: s.end + offset })
    for (const m of part.listMarkers) listMarkers.push({ ...m, start: m.start + offset, end: m.end + offset })
    for (const l of part.links) links.push({ ...l, start: l.start + offset, end: l.end + offset })
  }
  return { text, spans, listMarkers, links }
}

export function plainStyledText(text: string, style: CharStyle = PLAIN_STYLE): StyledText {
  return { text, spans: isPlainStyle(style) ? [] : [{ start: 0, end: text.length, style }], listMarkers: [], links: [] }
}

/** Replaces [start, end) with a fresh link segment carrying text/url, dropping whatever was there before. */
export function replaceRangeWithLink(value: StyledText, start: number, end: number, text: string, url: string): StyledText {
  const linkPart: StyledText = { text, spans: [], listMarkers: [], links: [{ start: 0, end: text.length, url }] }
  return concat(subSequence(value, 0, start), linkPart, subSequence(value, end, value.text.length))
}

/** Strips just the link annotation covering [start, end), keeping the characters and any other styling. */
export function withoutLink(value: StyledText, start: number, end: number): StyledText {
  return { ...value, links: value.links.filter((l) => l.start >= end || l.end <= start) }
}

/** Start offset of the line containing pos (the character right after the previous '\n', or 0). */
export function lineStart(text: string, pos: number): number {
  if (pos <= 0) return 0
  const idx = text.lastIndexOf('\n', pos - 1)
  return idx === -1 ? 0 : idx + 1
}

/** Reads the literal digits out of an already-rendered numbered marker, e.g. "  3. " -> 3. */
export function currentMarkerNumber(text: string, marker: ListMarker): number {
  const markerText = text.slice(marker.start, marker.end)
  const match = markerText.match(/(\d+)\./)
  return match ? Number(match[1]) : 1
}
