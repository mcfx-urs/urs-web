import { BeerIcon, ClockIcon, FuelIcon, GearIcon, InventoryIcon, NotesIcon, PinIcon } from '@/components/icons'
import TopBar from '@/components/TopBar'
import FeatureTile from '@/components/FeatureTile'

// One tile per urs-android feature, "soon" until it's actually ported to
// urs-web (add `href` once a feature gets a real route).
const FEATURES = [
  { name: 'Fuel', icon: FuelIcon },
  { name: 'Inventory', icon: InventoryIcon },
  { name: 'Beer log', icon: BeerIcon },
  { name: 'Work time', icon: ClockIcon },
  { name: 'Life map', icon: PinIcon },
  { name: 'Notes', icon: NotesIcon },
  { name: 'Settings', icon: GearIcon },
]

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Home</h1>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
          {FEATURES.map((feature) => (
            <FeatureTile key={feature.name} {...feature} />
          ))}
        </div>
      </main>
    </div>
  )
}
