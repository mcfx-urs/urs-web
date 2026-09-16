import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import {
  applyRichTextEdit,
  indentList,
  outdentList,
  toggleCharStyle,
  toggleList,
  type EditorSelection,
  type EditorValue,
} from '@/lib/richtext/editing'
import { offsetAtPoint, readSelectionOffsets, renderRuns, setSelectionOffsets } from '@/lib/richtext/dom'
import { parseRichText, serializeRichText } from '@/lib/richtext/markup'
import { PLAIN_STYLE, linkAt, replaceRangeWithLink, styleFlag, withoutLink, type CharStyle } from '@/lib/richtext/model'
import LinkEditDialog from './LinkEditDialog'
import RichTextToolbar from './RichTextToolbar'

type LinkDialogState = { start: number; end: number; text: string; url: string; isExisting: boolean }

function normalizeUrl(url: string): string {
  return url.includes('://') ? url : `https://${url}`
}

/**
 * WYSIWYG rich-text field (GitHub issue #20) - a contentEditable port of
 * urs-android's RichTextField.kt. Owns markup parsing/serialization
 * internally and exposes the same plain-string onChange contract a
 * <textarea> would - the caller (and storage) never sees the styled model.
 *
 * A plain contentEditable div with manually intercepted `beforeinput`
 * events, not a rich-text framework: every edit is reconciled against the
 * StyledText model in editing.ts (the same diff-then-splice approach
 * RichTextEditing.kt uses against Compose's TextFieldValue), then the DOM
 * is re-rendered from that model and the caret restored - see dom.ts for
 * the character-offset <-> DOM (node, offset) mapping this relies on.
 *
 * Known limitation, accepted for this project's scope (parity with
 * Android's own feature set, not everything the web platform additionally
 * makes possible): IME composition (CJK input methods) isn't specially
 * handled - composition-related input types fall through to the default
 * "block it" branch in handleBeforeInput, matching Compose's own
 * BasicTextField only being exercised against Latin-script input here.
 */
export default function RichTextField({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
}) {
  const [state, setState] = useState<EditorValue>(() => {
    const parsed = parseRichText(value)
    return { value: parsed, selection: { start: parsed.text.length, end: parsed.text.length } }
  })
  const [pendingStyle, setPendingStyle] = useState<CharStyle>(PLAIN_STYLE)
  const [focused, setFocused] = useState(false)
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const lastEmittedRef = useRef(value)

  // value is only re-parsed when it changes for a reason other than this field's own edits
  // (e.g. the card/note finishing an async load) - see the lastEmittedRef guard. Re-parsing on
  // every keystroke would both be wasteful and, more importantly, lose the cursor position and
  // any style not yet reflected by a round-trip.
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      const parsed = parseRichText(value)
      lastEmittedRef.current = value
      setState({ value: parsed, selection: { start: parsed.text.length, end: parsed.text.length } })
    }
  }, [value])

  useLayoutEffect(() => {
    const root = editorRef.current
    if (!root || !focused) return
    setSelectionOffsets(root, state.selection.start, state.selection.end)
  }, [state, focused])

  useEffect(() => {
    function handleSelectionChange() {
      const root = editorRef.current
      if (!root || !focused) return
      const sel = readSelectionOffsets(root)
      if (sel && (sel.start !== state.selection.start || sel.end !== state.selection.end)) {
        setState((s) => ({ ...s, selection: sel }))
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, state.selection.start, state.selection.end])

  function commit(next: EditorValue) {
    setState(next)
    const serialized = serializeRichText(next.value)
    lastEmittedRef.current = serialized
    onChange(serialized)
  }

  function applyEdit(newText: string, newSelection: EditorSelection) {
    commit(applyRichTextEdit(state, newText, newSelection, pendingStyle))
  }

  function handleFocus() {
    setFocused(true)
    const root = editorRef.current
    if (!root) return
    const sel = readSelectionOffsets(root)
    if (sel) setState((s) => ({ ...s, selection: sel }))
  }

  function handleBlur() {
    setFocused(false)
    setPendingStyle(PLAIN_STYLE)
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const root = editorRef.current
    if (!root) return
    const offset = offsetAtPoint(root, e.clientX, e.clientY)
    if (offset === null) return
    const link = linkAt(state.value, offset)
    if (link) {
      e.preventDefault()
      setLinkDialog({ start: link.start, end: link.end, url: link.url, text: state.value.text.slice(link.start, link.end), isExisting: true })
    }
  }

  function handleBeforeInput(e: React.FormEvent<HTMLDivElement> & { inputType?: string; data?: string | null; dataTransfer?: DataTransfer | null }) {
    const root = editorRef.current
    if (!root) return
    const currentSel = readSelectionOffsets(root) ?? state.selection
    const text = state.value.text
    const { start, end } = currentSel

    let newText: string | null = null
    let newSelStart = start
    let newSelEnd = end

    switch (e.inputType) {
      case 'insertText':
      case 'insertReplacementText': {
        const data = e.data ?? ''
        newText = text.slice(0, start) + data + text.slice(end)
        newSelStart = newSelEnd = start + data.length
        break
      }
      case 'insertParagraph':
      case 'insertLineBreak': {
        newText = text.slice(0, start) + '\n' + text.slice(end)
        newSelStart = newSelEnd = start + 1
        break
      }
      case 'deleteContentBackward': {
        if (start !== end) {
          newText = text.slice(0, start) + text.slice(end)
          newSelStart = newSelEnd = start
        } else if (start > 0) {
          newText = text.slice(0, start - 1) + text.slice(start)
          newSelStart = newSelEnd = start - 1
        }
        break
      }
      case 'deleteContentForward': {
        if (start !== end) {
          newText = text.slice(0, start) + text.slice(end)
          newSelStart = newSelEnd = start
        } else if (end < text.length) {
          newText = text.slice(0, start) + text.slice(start + 1)
          newSelStart = newSelEnd = start
        }
        break
      }
      case 'deleteByCut': {
        newText = text.slice(0, start) + text.slice(end)
        newSelStart = newSelEnd = start
        break
      }
      case 'insertFromPaste':
      case 'insertFromDrop': {
        const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? ''
        if (data) {
          newText = text.slice(0, start) + data + text.slice(end)
          newSelStart = newSelEnd = start + data.length
        }
        break
      }
      default:
        break
    }

    e.preventDefault()
    if (newText !== null) applyEdit(newText, { start: newSelStart, end: newSelEnd })
  }

  function applyCharStyleToggle(flag: (s: CharStyle) => boolean, set: (s: CharStyle, v: boolean) => CharStyle) {
    const result = toggleCharStyle(state, pendingStyle, flag, set)
    setPendingStyle(result.pendingStyle)
    commit(result.value)
  }

  function handleToolbarLink() {
    const targetStart = Math.min(state.selection.start, state.selection.end)
    const targetEnd = Math.max(state.selection.start, state.selection.end)
    const prefillText = targetStart !== targetEnd ? state.value.text.slice(targetStart, targetEnd) : ''
    setLinkDialog({ start: targetStart, end: targetEnd, url: '', text: prefillText, isExisting: false })
  }

  function handleLinkSave(text: string, url: string) {
    if (!linkDialog) return
    const updated = replaceRangeWithLink(state.value, linkDialog.start, linkDialog.end, text, normalizeUrl(url))
    const pos = linkDialog.start + text.length
    commit({ value: updated, selection: { start: pos, end: pos } })
    setLinkDialog(null)
  }

  function handleLinkRemove() {
    if (!linkDialog) return
    const updated = withoutLink(state.value, linkDialog.start, linkDialog.end)
    commit({ value: updated, selection: state.selection })
    setLinkDialog(null)
  }

  function handleLinkOpen() {
    if (!linkDialog) return
    window.open(normalizeUrl(linkDialog.url), '_blank', 'noopener,noreferrer')
  }

  const selStart = Math.min(state.selection.start, state.selection.end)
  const selEnd = Math.max(state.selection.start, state.selection.end)
  const collapsed = selStart === selEnd
  const activeBold = collapsed ? pendingStyle.bold : styleFlag(state.value, selStart, selEnd, (s) => s.bold)
  const activeItalic = collapsed ? pendingStyle.italic : styleFlag(state.value, selStart, selEnd, (s) => s.italic)
  const activeUnderline = collapsed ? pendingStyle.underline : styleFlag(state.value, selStart, selEnd, (s) => s.underline)
  const runs = renderRuns(state.value)

  return (
    <div className="flex flex-col gap-2">
      {focused && (
        <RichTextToolbar
          activeBold={activeBold}
          activeItalic={activeItalic}
          activeUnderline={activeUnderline}
          onBold={() => applyCharStyleToggle((s) => s.bold, (s, v) => ({ ...s, bold: v }))}
          onItalic={() => applyCharStyleToggle((s) => s.italic, (s, v) => ({ ...s, italic: v }))}
          onUnderline={() => applyCharStyleToggle((s) => s.underline, (s, v) => ({ ...s, underline: v }))}
          onLink={handleToolbarLink}
          onBullet={() => commit(toggleList(state, 'BULLET'))}
          onNumbered={() => commit(toggleList(state, 'NUMBER'))}
          onIndent={() => commit(indentList(state))}
          onOutdent={() => commit(outdentList(state))}
        />
      )}
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        className="min-h-24 max-h-72 w-full overflow-y-auto rounded-lg border border-input bg-transparent px-2.5 py-2 text-base break-words whitespace-pre-wrap outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        onBeforeInput={handleBeforeInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
      >
        {state.value.text.length === 0 ? (
          <br />
        ) : (
          runs.map((run, i) => (
            <span
              key={i}
              className={cn(
                run.style.bold && 'font-bold',
                run.style.italic && 'italic',
                (run.style.underline || run.link) && 'underline',
                run.link && 'text-primary',
              )}
            >
              {state.value.text.slice(run.start, run.end)}
            </span>
          ))
        )}
      </div>
      {linkDialog && (
        <LinkEditDialog
          key={`${linkDialog.start}-${linkDialog.end}`}
          initialText={linkDialog.text}
          initialUrl={linkDialog.url}
          isExisting={linkDialog.isExisting}
          onSave={handleLinkSave}
          onRemove={handleLinkRemove}
          onOpen={handleLinkOpen}
          onDismiss={() => setLinkDialog(null)}
        />
      )}
    </div>
  )
}
