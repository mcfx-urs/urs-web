import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'
import { fetchFuelTypes, type Fuel } from '@/lib/fuel-types'
import { createVehicle, fetchVehicles, updateVehicle, type Vehicle, type VehicleInput } from '@/lib/vehicles'

const VEHICLE_TYPES = [
  { value: 'car', label: 'Car' },
  { value: 'motorbike', label: 'Motorbike' },
  { value: 'ebike', label: 'E-Bike' },
]

export default function VehicleFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const { data: vehicles, isLoading } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles, enabled: isEditing })
  const { data: fuelTypes } = useQuery({ queryKey: ['fuel-types'], queryFn: fetchFuelTypes })
  const existing = isEditing ? vehicles?.find((v) => v.vehicle_id === id) : undefined

  if (isEditing && isLoading) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }
  if (isEditing && !existing) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Vehicle not found.</p>
        </main>
      </div>
    )
  }

  return <VehicleForm key={existing?.vehicle_id ?? 'new'} existing={existing} fuelTypes={fuelTypes ?? []} />
}

function VehicleForm({ existing, fuelTypes }: { existing?: Vehicle; fuelTypes: Fuel[] }) {
  const isEditing = Boolean(existing)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [brand, setBrand] = useState(existing?.vehicle_brand ?? '')
  const [model, setModel] = useState(existing?.vehicle_model ?? '')
  const [year, setYear] = useState(existing?.vehicle_year ?? '')
  const [fuelId, setFuelId] = useState(existing?.vehicle_fuel_id ?? '')
  const [vehicleType, setVehicleType] = useState(existing?.vehicle_type ?? 'car')
  const [engineCode, setEngineCode] = useState(existing?.vehicle_engine_code ?? '')
  const [color, setColor] = useState(existing?.vehicle_color ?? '')
  const [vin, setVin] = useState(existing?.vehicle_vin ?? '')
  const [registrationNumber, setRegistrationNumber] = useState(existing?.vehicle_registration_number ?? '')
  const [typeApprovalNumber, setTypeApprovalNumber] = useState(existing?.vehicle_type_approval_number ?? '')
  const [displacementCcm, setDisplacementCcm] = useState(existing?.vehicle_displacement_ccm ?? '')
  const [weightKg, setWeightKg] = useState(existing?.vehicle_weight_kg ?? '')
  const [powerKw, setPowerKw] = useState(existing?.vehicle_power_kw ?? '')
  const [powerPs, setPowerPs] = useState(existing?.vehicle_power_ps ?? '')
  const [firstRegistrationDate, setFirstRegistrationDate] = useState(existing?.vehicle_first_registration_date ?? '')
  const [lastMfkDate, setLastMfkDate] = useState(existing?.vehicle_last_mfk_date ?? '')

  const isValid = Boolean(brand.trim() && model.trim() && year.trim() && fuelId)

  const mutation = useMutation({
    mutationFn: () => {
      const input: VehicleInput = {
        vehicle_brand: brand,
        vehicle_model: model,
        vehicle_year: year,
        vehicle_fuel_id: fuelId,
        vehicle_type: vehicleType,
        vehicle_engine_code: engineCode,
        vehicle_color: color,
        vehicle_vin: vin,
        vehicle_registration_number: registrationNumber,
        vehicle_type_approval_number: typeApprovalNumber,
        vehicle_displacement_ccm: displacementCcm,
        vehicle_power_kw: powerKw,
        vehicle_power_ps: powerPs,
        vehicle_weight_kg: weightKg,
        vehicle_first_registration_date: firstRegistrationDate,
        vehicle_last_mfk_date: lastMfkDate,
      }
      return isEditing && existing ? updateVehicle(existing.vehicle_id, input) : createVehicle(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      navigate('/vehicles')
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isValid) mutation.mutate()
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-base font-bold">{isEditing ? 'Edit vehicle' : 'New vehicle'}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} required />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="model">Model</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="year">Year</Label>
            <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fuel-type">Fuel type</Label>
            <select
              id="fuel-type"
              value={fuelId}
              onChange={(e) => setFuelId(e.target.value)}
              required
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              <option value="" disabled>
                Select a fuel type
              </option>
              {fuelTypes.map((f) => (
                <option key={f.fuel_id} value={f.fuel_id}>
                  {f.fuel_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vehicle-type">Vehicle type</Label>
            <select
              id="vehicle-type"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="engine-code">Engine code</Label>
            <Input id="engine-code" value={engineCode} onChange={(e) => setEngineCode(e.target.value)} />
          </div>

          <h2 className="mt-2 text-sm font-bold">Registration document</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="color">Color</Label>
            <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vin">VIN</Label>
            <Input id="vin" value={vin} onChange={(e) => setVin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="registration-number">Registration number</Label>
            <Input id="registration-number" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="type-approval-number">Type approval number</Label>
            <Input
              id="type-approval-number"
              value={typeApprovalNumber}
              onChange={(e) => setTypeApprovalNumber(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="displacement">Displacement (ccm)</Label>
              <Input id="displacement" type="number" value={displacementCcm} onChange={(e) => setDisplacementCcm(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="power-kw">Power (kW)</Label>
              <Input id="power-kw" type="number" value={powerKw} onChange={(e) => setPowerKw(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="power-ps">Power (PS)</Label>
              <Input id="power-ps" type="number" value={powerPs} onChange={(e) => setPowerPs(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="first-registration">First registration date</Label>
            <Input
              id="first-registration"
              type="date"
              value={firstRegistrationDate}
              onChange={(e) => setFirstRegistrationDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="last-mfk">Last MFK date</Label>
            <Input id="last-mfk" type="date" value={lastMfkDate} onChange={(e) => setLastMfkDate(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={!isValid || mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/vehicles')}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
