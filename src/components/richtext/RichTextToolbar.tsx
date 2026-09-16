import {
  Bold,
  Italic,
  LinkIcon,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Underline,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The 8-icon formatting row, always shown while the field is focused - port
 * of urs-android's RichTextToolbar.kt. onMouseDown on every button prevents
 * the default focus-shift-on-mousedown, so clicking a button never blurs
 * the field or drops its current selection before the click handler runs.
 */
export default function RichTextToolbar({
  activeBold,
  activeItalic,
  activeUnderline,
  onBold,
  onItalic,
  onUnderline,
  onLink,
  onBullet,
  onNumbered,
  onIndent,
  onOutdent,
}: {
  activeBold: boolean
  activeItalic: boolean
  activeUnderline: boolean
  onBold: () => void
  onItalic: () => void
  onUnderline: () => void
  onLink: () => void
  onBullet: () => void
  onNumbered: () => void
  onIndent: () => void
  onOutdent: () => void
}) {
  const preventBlur = (e: React.MouseEvent) => e.preventDefault()

  return (
    <div className="flex flex-wrap gap-1">
      <Button type="button" variant={activeBold ? 'default' : 'outline'} size="icon-sm" onMouseDown={preventBlur} onClick={onBold} aria-label="Bold">
        <Bold className="size-4" />
      </Button>
      <Button type="button" variant={activeItalic ? 'default' : 'outline'} size="icon-sm" onMouseDown={preventBlur} onClick={onItalic} aria-label="Italic">
        <Italic className="size-4" />
      </Button>
      <Button type="button" variant={activeUnderline ? 'default' : 'outline'} size="icon-sm" onMouseDown={preventBlur} onClick={onUnderline} aria-label="Underline">
        <Underline className="size-4" />
      </Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={preventBlur} onClick={onLink} aria-label="Link">
        <LinkIcon className="size-4" />
      </Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={preventBlur} onClick={onBullet} aria-label="Bullet list">
        <List className="size-4" />
      </Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={preventBlur} onClick={onNumbered} aria-label="Numbered list">
        <ListOrdered className="size-4" />
      </Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={preventBlur} onClick={onOutdent} aria-label="Outdent">
        <ListIndentDecrease className="size-4" />
      </Button>
      <Button type="button" variant="outline" size="icon-sm" onMouseDown={preventBlur} onClick={onIndent} aria-label="Indent">
        <ListIndentIncrease className="size-4" />
      </Button>
    </div>
  )
}
