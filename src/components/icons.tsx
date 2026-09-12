type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function ChoresIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  )
}

export function FuelIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="10" height="16" rx="1" />
      <line x1="4" y1="9" x2="14" y2="9" />
      <path d="M14 8h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0v-7l-2-2" />
    </svg>
  )
}

export function InventoryIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8 12 4 20 8 20 17 12 21 4 17Z" />
      <path d="M4 8 12 12 20 8" />
      <line x1="12" y1="12" x2="12" y2="21" />
    </svg>
  )
}

export function ShoppingListIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 8h14l-1.5 9a2 2 0 0 1-2 1.7H9.5a2 2 0 0 1-2-1.7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <line x1="4" y1="8" x2="6" y2="8" />
    </svg>
  )
}

export function BeerIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6h10v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6Z" />
      <path d="M16 9h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      <line x1="6" y1="10" x2="16" y2="10" />
    </svg>
  )
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="12" x2="12" y2="7" />
      <line x1="12" y1="12" x2="15.5" y2="14" />
    </svg>
  )
}

export function PinIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21s-6-5.686-6-10a6 6 0 0 1 12 0c0 4.314-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  )
}

export function NotesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 4h9l3 3v13H6Z" />
      <path d="M15 4v3h3" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
      <line x1="9" y1="18" x2="13" y2="18" />
    </svg>
  )
}

export function KanbanIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <line x1="10" y1="4" x2="10" y2="20" />
      <line x1="16" y1="4" x2="16" y2="20" />
      <line x1="6.5" y1="8" x2="7.5" y2="8" />
      <line x1="12.5" y1="8" x2="13.5" y2="8" />
      <line x1="18.5" y1="8" x2="18.5" y2="8" />
    </svg>
  )
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12M18.36 18.36l-2.12-2.12M7.76 7.76 5.64 5.64" />
    </svg>
  )
}
