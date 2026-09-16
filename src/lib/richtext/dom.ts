// DOM-specific plumbing for RichTextField.tsx: mapping between plain
// character offsets (the coordinate space model.ts/editing.ts operate in)
// and actual DOM (node, offset) positions inside the contentEditable root.
// Kept separate from the pure editing logic above so that logic stays
// framework/DOM-independent and easy to reason about in isolation.

import { linkAt, resolveStyleRuns, type CharStyle, type StyledText } from './model'

/** One contiguous run to render as its own <span> - cut by both style-run and link boundaries. */
export type RenderRun = { start: number; end: number; style: CharStyle; link?: string }

/**
 * Splits value into runs a single <span> can render - a style run cut
 * further wherever a link boundary falls inside it, so link visuals (accent
 * color + underline) can be layered onto whatever character style already
 * applies there without the two ever needing to share one annotation layer.
 */
export function renderRuns(value: StyledText): RenderRun[] {
  const len = value.text.length
  if (len === 0) return []
  const cuts = new Set<number>([0, len])
  for (const r of resolveStyleRuns(value)) {
    cuts.add(r.start)
    cuts.add(r.end)
  }
  for (const l of value.links) {
    cuts.add(l.start)
    cuts.add(l.end)
  }
  const sorted = [...cuts].sort((a, b) => a - b)
  const runs: RenderRun[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]
    const end = sorted[i + 1]
    if (start >= end) continue
    const style = resolveStyleRuns(value, start, end)[0]?.style ?? { bold: false, italic: false, underline: false }
    const link = linkAt(value, start)
    runs.push({ start, end, style, link: link?.url })
  }
  return runs
}

/** Plain-text character offset of a DOM (node, offset) position within root. */
export function offsetInRoot(root: HTMLElement, node: Node, nodeOffset: number): number {
  const range = document.createRange()
  range.selectNodeContents(root)
  range.setEnd(node, nodeOffset)
  return range.toString().length
}

/** The current window selection's [start, end) as plain-text character offsets within root, or null if it's elsewhere. */
export function readSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const a = offsetInRoot(root, range.startContainer, range.startOffset)
  const b = offsetInRoot(root, range.endContainer, range.endOffset)
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

/** The DOM (node, offset) position within root corresponding to plain-text character offset target. */
function nodeOffsetAt(root: HTMLElement, target: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  let remaining = target
  let last: Text | null = null
  while (node) {
    const text = node as Text
    const len = text.textContent?.length ?? 0
    if (remaining <= len) return { node: text, offset: remaining }
    remaining -= len
    last = text
    node = walker.nextNode()
  }
  if (last) return { node: last, offset: last.textContent?.length ?? 0 }
  return { node: root, offset: 0 }
}

/** Places the window selection at [start, end) (as plain-text character offsets) within root. */
export function setSelectionOffsets(root: HTMLElement, start: number, end: number): void {
  const sel = window.getSelection()
  if (!sel) return
  const startPos = nodeOffsetAt(root, start)
  const endPos = start === end ? startPos : nodeOffsetAt(root, end)
  const range = document.createRange()
  range.setStart(startPos.node, startPos.offset)
  range.setEnd(endPos.node, endPos.offset)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Plain-text character offset under a viewport point, or null if it can't be resolved (e.g. outside root). */
export function offsetAtPoint(root: HTMLElement, clientX: number, clientY: number): number | null {
  const withCaretRangeFromPoint = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const withCaretPositionFromPoint = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (withCaretRangeFromPoint.caretRangeFromPoint) {
    const range = withCaretRangeFromPoint.caretRangeFromPoint(clientX, clientY)
    if (!range || !root.contains(range.startContainer)) return null
    return offsetInRoot(root, range.startContainer, range.startOffset)
  }
  if (withCaretPositionFromPoint.caretPositionFromPoint) {
    const pos = withCaretPositionFromPoint.caretPositionFromPoint(clientX, clientY)
    if (!pos || !root.contains(pos.offsetNode)) return null
    return offsetInRoot(root, pos.offsetNode, pos.offset)
  }
  return null
}
