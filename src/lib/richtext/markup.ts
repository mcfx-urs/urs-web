// Parse/serialize between the stored markup string and a StyledText value -
// a TypeScript port of urs-android's RichTextMarkup.kt. Not Markdown/
// CommonMark, just the small closed syntax this editor itself reads and
// writes, byte-compatible with what urs-android's own editor produces:
//
// - **text** bold, ~text~ italic, __text__ underline, [text](url) link
//   (italic deliberately doesn't share a character with bold's ** or
//   underline's __ - a single */_ delimiter would merge with the adjacent
//   double one into an ambiguous run wherever both styles cover the same
//   text)
// - a line starting with "- " is a bullet item, "1. " a numbered item
//   (renumbered per level on save); 2 leading spaces per indent level (0-4)
//
// parseRichText turns a stored string into the editable StyledText (list
// lines get their marker glyph rendered as real leading characters, tracked
// via listMarkers so serializeRichText can tell a genuine list line apart
// from plain text that merely starts with a look-alike sequence).
// serializeRichText is the exact inverse.
//
// Literal \ * _ [ ] ( ) characters that are plain content (not an actual
// style/link boundary) are backslash-escaped on save and un-escaped on load
// so the format round-trips unambiguously. A plain line that happens to
// start with something list-marker-shaped is escaped the same way so it
// doesn't get misread as a list item on the next load.

import {
  BULLET_GLYPH,
  INDENT_SPACES_PER_LEVEL,
  MAX_LIST_LEVEL,
  type CharStyle,
  type ListType,
  type StyledText,
  PLAIN_STYLE,
  concat,
  linksIn,
  listMarkerAt,
  plainStyledText,
  resolveStyleRuns,
} from './model'

const BULLET_LINE_REGEX = /^- ([\s\S]*)$/
const NUMBERED_LINE_REGEX = /^(\d+)\. ([\s\S]*)$/
const NUMBERED_LOOKALIKE_REGEX = /^\d+\. /
const ESCAPE_CHARS = new Set(['\\', '*', '_', '~', '[', ']', '(', ')'])

export function parseRichText(markup: string): StyledText {
  const lines = markup.split('\n')
  const parts: StyledText[] = []
  lines.forEach((rawLine, index) => {
    if (index > 0) parts.push(plainStyledText('\n'))
    const indentMatch = rawLine.match(/^ */)
    const indentCount = indentMatch ? indentMatch[0].length : 0
    const level = Math.min(Math.max(Math.floor(indentCount / INDENT_SPACES_PER_LEVEL), 0), MAX_LIST_LEVEL)
    const afterIndent = rawLine.slice(indentCount)
    const bulletMatch = afterIndent.match(BULLET_LINE_REGEX)
    const numberedMatch = !bulletMatch ? afterIndent.match(NUMBERED_LINE_REGEX) : null
    if (bulletMatch) {
      const markerText = ' '.repeat(level * INDENT_SPACES_PER_LEVEL) + BULLET_GLYPH
      const markerPart: StyledText = {
        text: markerText,
        spans: [],
        listMarkers: [{ start: 0, end: markerText.length, type: 'BULLET', level }],
        links: [],
      }
      parts.push(concat(markerPart, parseInline(bulletMatch[1])))
    } else if (numberedMatch) {
      const markerText = ' '.repeat(level * INDENT_SPACES_PER_LEVEL) + `${numberedMatch[1]}. `
      const markerPart: StyledText = {
        text: markerText,
        spans: [],
        listMarkers: [{ start: 0, end: markerText.length, type: 'NUMBER', level }],
        links: [],
      }
      parts.push(concat(markerPart, parseInline(numberedMatch[2])))
    } else {
      parts.push(parseInline(rawLine))
    }
  })
  return concat(...parts)
}

function parseInline(s: string, style: CharStyle = PLAIN_STYLE): StyledText {
  const parts: StyledText[] = []
  let i = 0
  let plain = ''
  const flush = () => {
    if (plain.length > 0) {
      parts.push(plainStyledText(plain, style))
      plain = ''
    }
  }
  while (i < s.length) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length) {
      plain += s[i + 1]
      i += 2
    } else if (s.startsWith('**', i)) {
      const close = findClosing(s, i + 2, '**')
      if (close !== -1) {
        flush()
        parts.push(parseInline(s.slice(i + 2, close), { ...style, bold: true }))
        i = close + 2
      } else {
        plain += c
        i++
      }
    } else if (s.startsWith('__', i)) {
      const close = findClosing(s, i + 2, '__')
      if (close !== -1) {
        flush()
        parts.push(parseInline(s.slice(i + 2, close), { ...style, underline: true }))
        i = close + 2
      } else {
        plain += c
        i++
      }
    } else if (c === '~') {
      const close = findClosing(s, i + 1, '~')
      if (close !== -1) {
        flush()
        parts.push(parseInline(s.slice(i + 1, close), { ...style, italic: true }))
        i = close + 1
      } else {
        plain += c
        i++
      }
    } else if (c === '[') {
      const link = tryParseLink(s, i)
      if (link) {
        flush()
        const linkContent = parseInline(link.text, style)
        parts.push({
          ...linkContent,
          links: [...linkContent.links, { start: 0, end: linkContent.text.length, url: link.url }],
        })
        i = link.nextIndex
      } else {
        plain += c
        i++
      }
    } else {
      plain += c
      i++
    }
  }
  flush()
  return concat(...parts)
}

/** First unescaped occurrence of delim at or after from, skipping backslash-escaped pairs. */
function findClosing(s: string, from: number, delim: string): number {
  let i = from
  while (i <= s.length - delim.length) {
    if (s[i] === '\\') {
      i += 2
      continue
    }
    if (s.startsWith(delim, i)) return i
    i++
  }
  return -1
}

type ParsedLink = { text: string; url: string; nextIndex: number }

function tryParseLink(s: string, start: number): ParsedLink | null {
  const textClose = findClosing(s, start + 1, ']')
  if (textClose === -1 || textClose + 1 >= s.length || s[textClose + 1] !== '(') return null
  const urlClose = findClosing(s, textClose + 2, ')')
  if (urlClose === -1) return null
  const text = s.slice(start + 1, textClose)
  const url = unescapeUrl(s.slice(textClose + 2, urlClose))
  return { text, url, nextIndex: urlClose + 1 }
}

function escapeLiteral(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (ESCAPE_CHARS.has(c)) out += '\\'
    out += c
  }
  return out
}

function escapeUrl(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/\)/g, '\\)')
}

function unescapeUrl(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) {
      out += s[i + 1]
      i += 2
    } else {
      out += s[i]
      i++
    }
  }
  return out
}

function looksLikeListMarker(content: string): boolean {
  return content.startsWith('- ') || NUMBERED_LOOKALIKE_REGEX.test(content)
}

type ListNumbering = { level: number; type: ListType; index: number }

export function serializeRichText(value: StyledText): string {
  const lines: string[] = []
  const stack: ListNumbering[] = []
  let lineStartOffset = 0
  const fullText = value.text
  while (true) {
    const newlineIndex = fullText.indexOf('\n', lineStartOffset)
    const lineEnd = newlineIndex === -1 ? fullText.length : newlineIndex
    lines.push(serializeLine(value, lineStartOffset, lineEnd, stack))
    if (newlineIndex === -1) break
    lineStartOffset = newlineIndex + 1
  }
  return lines.join('\n')
}

function serializeLine(value: StyledText, lineStartOffset: number, lineEnd: number, stack: ListNumbering[]): string {
  const marker = listMarkerAt(value, lineStartOffset)
  if (!marker) {
    stack.length = 0
    const content = emitLineContent(value, lineStartOffset, lineEnd)
    return looksLikeListMarker(content) ? `\\${content}` : content
  }

  while (stack.length > 0 && stack[stack.length - 1].level > marker.level) stack.pop()
  let number: number
  if (stack.length > 0 && stack[stack.length - 1].level === marker.level) {
    const top = stack[stack.length - 1]
    if (top.type === marker.type) {
      top.index += 1
      number = top.index
    } else {
      stack.pop()
      stack.push({ level: marker.level, type: marker.type, index: 1 })
      number = 1
    }
  } else {
    stack.push({ level: marker.level, type: marker.type, index: 1 })
    number = 1
  }

  const indent = ' '.repeat(marker.level * INDENT_SPACES_PER_LEVEL)
  const markerText = marker.type === 'BULLET' ? '- ' : `${number}. `
  const content = emitLineContent(value, marker.end, lineEnd)
  return indent + markerText + content
}

function emitLineContent(value: StyledText, start: number, end: number): string {
  if (start >= end) return ''
  const links = linksIn(value, start, end)
  let out = ''
  let cursor = start
  for (const link of links) {
    out += emitInline(value, cursor, link.start)
    out += '[' + emitInline(value, link.start, link.end) + '](' + escapeUrl(link.url) + ')'
    cursor = link.end
  }
  out += emitInline(value, cursor, end)
  return out
}

function emitInline(value: StyledText, start: number, end: number): string {
  if (start >= end) return ''
  let out = ''
  for (const run of resolveStyleRuns(value, start, end)) {
    let wrapped = escapeLiteral(value.text.slice(run.start, run.end))
    if (run.style.underline) wrapped = `__${wrapped}__`
    if (run.style.italic) wrapped = `~${wrapped}~`
    if (run.style.bold) wrapped = `**${wrapped}**`
    out += wrapped
  }
  return out
}
