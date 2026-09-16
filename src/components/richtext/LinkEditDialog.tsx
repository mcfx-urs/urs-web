import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Popup for inserting a new link or editing/removing an existing one - port of urs-android's LinkEditSheet.kt. */
export default function LinkEditDialog({
  initialText,
  initialUrl,
  isExisting,
  onSave,
  onRemove,
  onOpen,
  onDismiss,
}: {
  initialText: string
  initialUrl: string
  isExisting: boolean
  onSave: (text: string, url: string) => void
  onRemove: () => void
  onOpen: () => void
  onDismiss: () => void
}) {
  const [text, setText] = useState(initialText)
  const [url, setUrl] = useState(initialUrl)

  return (
    <Dialog open onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isExisting ? 'Edit link' : 'Insert link'}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim() && url.trim()) onSave(text.trim(), url.trim())
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="link-text">Text</Label>
            <Input id="link-text" value={text} onChange={(e) => setText(e.target.value)} autoFocus={!initialText} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="link-url">URL</Label>
            <Input id="link-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus={Boolean(initialText)} />
          </div>
          {isExisting && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onOpen}>
                Open
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={onRemove}>
                Remove
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onDismiss}>
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim() || !url.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
