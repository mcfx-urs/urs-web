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

// Firefox doesn't populate InputEvent.inputType for contentEditable elements
// (confirmed via live debug logging against a real Firefox session, 2026-09-17
// - data/dataTransfer are usually still set correctly there, only inputType is
// missing), so handleBeforeInput can't switch on it directly. Falls back to
// deriving the same intent from data/dataTransfer when inputType is absent.
// Known gap of the fallback: a forward-delete (Delete key) is indistinguishable
// from a backward-delete (Backspace) without inputType, so it's treated as
// backward-delete - the far more common gesture, and still deletes the right
// character(s) whenever there's an active selection.
//
// Space is a second, separate gap (also confirmed via live debug logging,
// 2026-09-17): Firefox sometimes leaves data/dataTransfer empty for a Space
// keypress too, indistinguishable here from a delete - matches a known class
// of Firefox contentEditable whitespace bugs (e.g. Mozilla bugs 1571375,
// 681626). handleBeforeInput compensates with a keydown-tracked fallback
// (lastKeyRef) for this one specific case, since there's no field on the
// beforeinput event itself left to disambiguate it.
function resolveInputKind(native: InputEvent): string | undefined {
  if (native.inputType) return native.inputType
  if (native.data != null) return 'insertText'
  if (native.dataTransfer) return 'insertFromPaste'
  return 'deleteContentBackward'
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
  const lastKeyRef = useRef<string | null>(null)

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    lastKeyRef.current = e.key
    // Firefox sometimes never fires beforeinput at all for Backspace (confirmed
    // via live debug logging, 2026-09-17: no [richtext debug] entry appears for
    // the keypress) - when that happens the native deletion still runs directly
    // on the DOM, leaving state.value.text stale, out of sync with what's now
    // visible. The next edit then reads the correct (post-deletion) caret
    // position but slices the stale (pre-deletion) text, resurrecting the
    // "deleted" characters (e.g. "urs test", four backspaces to "urs ", then
    // "a" produces "urs atest" instead of "urs a"). keydown is the one event in
    // this whole flow that's actually reliable, so Backspace/Delete are handled
    // here directly instead of through beforeinput - preventDefault on keydown
    // stops the native default (and the beforeinput/input pair that would
    // normally accompany it) before it can run at all.
    if (e.key !== 'Backspace' && e.key !== 'Delete') return
    const root = editorRef.current
    if (!root) return
    e.preventDefault()
    const { start, end } = readSelectionOffsets(root) ?? state.selection
    const text = state.value.text
    let newText: string | null = null
    let newSel = start
    if (start !== end) {
      newText = text.slice(0, start) + text.slice(end)
    } else if (e.key === 'Backspace' && start > 0) {
      newText = text.slice(0, start - 1) + text.slice(start)
      newSel = start - 1
    } else if (e.key === 'Delete' && end < text.length) {
      newText = text.slice(0, start) + text.slice(start + 1)
    }
    if (newText !== null) applyEdit(newText, { start: newSel, end: newSel })
  }

  function handleBeforeInput(e: React.FormEvent<HTMLDivElement>) {
    const root = editorRef.current
    if (!root) return
    // React's SyntheticEvent for onBeforeInput sets `data` but never `inputType`/`dataTransfer` -
    // both are only present on the real native event.
    const native = e.nativeEvent as InputEvent
    const currentSel = readSelectionOffsets(root) ?? state.selection
    const text = state.value.text
    const { start, end } = currentSel
    let resolvedKind = resolveInputKind(native)
    let resolvedData = native.data
    // See resolveInputKind's Space comment above: without inputType/data/
    // dataTransfer, a Space keypress is otherwise indistinguishable from a
    // delete. lastKeyRef reflects the physical key from the keydown that
    // just preceded this beforeinput (guaranteed to fire first, per spec).
    if (resolvedKind === 'deleteContentBackward' && lastKeyRef.current === ' ') {
      resolvedKind = 'insertText'
      resolvedData = ' '
    }
    let newText: string | null = null
    let newSelStart = start
    let newSelEnd = end

    switch (resolvedKind) {
      case 'insertText':
      case 'insertReplacementText': {
        const data = resolvedData ?? ''
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
        const data = native.data ?? native.dataTransfer?.getData('text/plain') ?? ''
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
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
      >
        {state.value.text.length === 0 ? (
          <br />
        ) : (
          <>
            {runs.map((run, i) => (
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
            ))}
            {/* A trailing \n with nothing after it doesn't get its own visible
                line box under white-space: pre-wrap (confirmed via live DOM
                inspection, 2026-09-17: the text node already contained the \n
                before the next keystroke, but no line break was painted) -
                an explicit trailing <br> forces the empty last line to render
                immediately, same fix already used for a fully empty field. */}
            {state.value.text.endsWith('\n') && <br />}
          </>
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
