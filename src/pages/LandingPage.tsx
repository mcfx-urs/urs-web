import {
  BakingIcon,
  BeerIcon,
  ChoresIcon,
  ClockIcon,
  FuelIcon,
  GearIcon,
  InventoryIcon,
  JournalIcon,
  KanbanIcon,
  NotesIcon,
  PinIcon,
  ServiceIcon,
  ShoppingListIcon,
  VehicleIcon,
} from '@/components/icons'
import TopBar from '@/components/TopBar'
import FeatureTile from '@/components/FeatureTile'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'

// Only features that are actually ported get a tile - no "coming soon"
// placeholders. Add an entry (with its real route as `href`) when a
// feature ships; nothing waits here unbuilt.
const FEATURES = [
  { name: 'Notes', icon: NotesIcon, href: '/notes' },
  { name: 'Chores', icon: ChoresIcon, href: '/chores' },
  { name: 'Journal', icon: JournalIcon, href: '/journal' },
  { name: 'Inventory', icon: InventoryIcon, href: '/inventory' },
  { name: 'Shopping List', icon: ShoppingListIcon, href: '/shopping' },
  { name: 'Kanban', icon: KanbanIcon, href: '/kanban' },
  { name: 'Life Map', icon: PinIcon, href: '/life-map' },
  { name: 'Work Time', icon: ClockIcon, href: '/worktime' },
  { name: 'Fuel', icon: FuelIcon, href: '/fuel' },
  { name: 'Beer log', icon: BeerIcon, href: '/beer' },
  { name: 'Baking', icon: BakingIcon, href: '/baking' },
  { name: 'Vehicles', icon: VehicleIcon, href: '/vehicles' },
  { name: 'Vehicle Service', icon: ServiceIcon, href: '/service' },
  { name: 'Settings', icon: GearIcon, href: '/settings' },
]

export default function LandingPage() {
  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Home</h1>
        {FEATURES.length === 0 ? (
          <p className="text-sm text-muted-foreground">No features yet - check back soon.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
            {FEATURES.map((feature) => (
              <FeatureTile key={feature.name} {...feature} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
