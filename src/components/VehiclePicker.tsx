import type { Vehicle } from '@/lib/vehicles'

type VehiclePickerProps = {
  id?: string
  vehicles: Vehicle[]
  value: string
  onChange: (vehicleId: string) => void
  includeAllOption?: boolean
  includeNoneOption?: boolean
}

// Plain native <select>, styled to match Input - this codebase has no
// shadcn Select primitive yet, and one dropdown doesn't warrant adding one.
export default function VehiclePicker({
  id,
  vehicles,
  value,
  onChange,
  includeAllOption,
  includeNoneOption,
}: VehiclePickerProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
    >
      {includeAllOption && <option value="">All vehicles</option>}
      {includeNoneOption && <option value="">None</option>}
      {vehicles.map((v) => (
        <option key={v.vehicle_id} value={v.vehicle_id}>
          {v.vehicle_brand} {v.vehicle_model}
        </option>
      ))}
    </select>
  )
}
