// Mirrors urs-android's ChangelogParser.kt: deliberately not a general-purpose
// Markdown parser, only the subset this project's own CHANGELOG.md actually
// uses - `#`/`##`/`###` headers, flat `- ` bullets, no nested lists, no
// tables, no images. A line using anything outside that set falls through to
// a paragraph block and renders as plain text rather than being dropped.

export type ChangelogBlock =
  | { type: 'header'; level: number; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'paragraph'; text: string }

const INLINE_CODE_SPAN = /`([^`]*)`/g
const INLINE_LINK = /\[([^\]]*)]\([^)]*\)/g

function renderInline(text: string): string {
  return text.replace(INLINE_LINK, '$1').replace(INLINE_CODE_SPAN, '$1')
}

export function parseChangelog(markdown: string): ChangelogBlock[] {
  const blocks: ChangelogBlock[] = []
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.length === 0) continue
    if (line.startsWith('### ')) {
      blocks.push({ type: 'header', level: 3, text: renderInline(line.slice(4)) })
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'header', level: 2, text: renderInline(line.slice(3)) })
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'header', level: 1, text: renderInline(line.slice(2)) })
    } else if (line.startsWith('- ')) {
      blocks.push({ type: 'bullet', text: renderInline(line.slice(2)) })
    } else {
      blocks.push({ type: 'paragraph', text: renderInline(line) })
    }
  }
  return blocks
}
