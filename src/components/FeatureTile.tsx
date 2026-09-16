import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { GLASS_CARD_CLASS } from '@/lib/glass-style'

type FeatureTileProps = {
  name: string
  icon: ComponentType<{ className?: string }>
  href: string
}

export default function FeatureTile({ name, icon: Icon, href }: FeatureTileProps) {
  return (
    <Link
      to={href}
      className={`flex min-h-32 flex-col justify-between gap-3 rounded-xl p-4 hover:border-primary ${GLASS_CARD_CLASS}`}
    >
      <Icon className="size-8 text-primary" />
      <span className="text-sm font-bold">{name}</span>
    </Link>
  )
}
