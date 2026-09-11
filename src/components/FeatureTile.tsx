import type { ComponentType } from 'react'

type FeatureTileProps = {
  name: string
  icon: ComponentType<{ className?: string }>
  // undefined = not built yet (shows "soon", not clickable). Set once the
  // feature actually has a route.
  href?: string
}

// Mirrors urs-android's nav-drawer pattern: every feature gets a tile from
// day one, "soon" until it's actually ported.
export default function FeatureTile({ name, icon: Icon, href }: FeatureTileProps) {
  return (
    <div
      className={`relative flex min-h-32 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 ${href ? '' : 'opacity-60'}`}
    >
      {!href && (
        <span className="absolute top-4 right-4 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold tracking-wide text-primary-foreground uppercase">
          Soon
        </span>
      )}
      <Icon className="size-8 text-primary" />
      <span className="text-sm font-bold">{name}</span>
    </div>
  )
}
