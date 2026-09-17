import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import VehiclePicker from '@/components/VehiclePicker'
import { fetchCurrencies } from '@/lib/currency'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'
import {
  createVehicleServiceRecord,
  CUSTOM_TAG_CODE,
  fetchVehicleServiceRecords,
  SERVICE_CATEGORIES,
  updateVehicleServiceRecord,
  type ServiceTag,
  type VehicleServiceInput,
  type VehicleServiceRecord,
} from '@/lib/vehicle-service'
import { fetchVehicles, type Vehicle } from '@/lib/vehicles'

export default function ServiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const { data: records, isLoading } = useQuery({
    queryKey: ['vehicle-service'],
    queryFn: fetchVehicleServiceRecords,
    enabled: isEditing,
  })
  const { data: vehicles } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
  const { data: currencies } = useQuery({ queryKey: ['currencies'], queryFn: fetchCurrencies })
  const existing = isEditing ? records?.find((r) => r.vehicle_service_id === id) : undefined

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
          <p className="text-sm text-muted-foreground">Record not found.</p>
        </main>
      </div>
    )
  }

  return (
    <ServiceForm
      key={existing?.vehicle_service_id ?? 'new'}
      existing={existing}
      vehicles={vehicles ?? []}
      currencies={currencies ?? []}
    />
  )
}

function ServiceForm({
  existing,
  vehicles,
  currencies,
}: {
  existing?: VehicleServiceRecord
  vehicles: Vehicle[]
  currencies: { currency_code: string; currency_name: string }[]
}) {
  const isEditing = Boolean(existing)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const existingFixedCodes = new Set(
    (existing?.tags ?? []).filter((t) => t.vehicle_service_tag_code !== CUSTOM_TAG_CODE).map((t) => t.vehicle_service_tag_code),
  )
  const existingCustomLabels = (existing?.tags ?? [])
    .filter((t) => t.vehicle_service_tag_code === CUSTOM_TAG_CODE)
    .map((t) => t.vehicle_service_tag_label)

  const [vehicleId, setVehicleId] = useState(existing?.vehicle_service_vehicle_id ?? vehicles[0]?.vehicle_id ?? '')
  const [date, setDate] = useState(existing?.vehicle_service_date ?? new Date().toISOString().slice(0, 10))
  const [odometer, setOdometer] = useState(existing?.vehicle_service_odometer ?? '')
  const [isDiy, setIsDiy] = useState(existing?.vehicle_service_is_diy === '1')
  const [provider, setProvider] = useState(existing?.vehicle_service_provider ?? '')
  const [costAmount, setCostAmount] = useState(existing?.vehicle_service_cost_amount ?? '')
  const [currencyCode, setCurrencyCode] = useState(existing?.vehicle_service_currency_code || 'CHF')
  const [notes, setNotes] = useState(existing?.vehicle_service_notes ?? '')
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(existingFixedCodes)
  // Growable list: the last slot is always blank/ready-to-type. Typing into
  // it appends a new blank; blanking a non-last slot removes it - matches
  // urs-android's ServiceViewModel.setCustomTag exactly.
  const [customTags, setCustomTags] = useState<string[]>([...existingCustomLabels, ''])

  function toggleCategory(code: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function setCustomTag(index: number, value: string) {
    setCustomTags((prev) => {
      const updated = [...prev]
      if (index < updated.length) updated[index] = value
      else updated.push(value)
      if (updated[updated.length - 1].trim() !== '') updated.push('')
      return updated.filter((tag, i) => tag.trim() !== '' || i === updated.length - 1)
    })
  }

  const isValid = Boolean(vehicleId && date.trim() && !Number.isNaN(Number(odometer)) && !Number.isNaN(Number(costAmount)))

  const mutation = useMutation({
    mutationFn: () => {
      const tags: ServiceTag[] = [
        ...Array.from(selectedCategories).map((code) => ({ vehicle_service_tag_code: code, vehicle_service_tag_label: '' })),
        ...customTags
          .filter((t) => t.trim() !== '')
          .map((label) => ({ vehicle_service_tag_code: CUSTOM_TAG_CODE, vehicle_service_tag_label: label.trim() })),
      ]
      const input: VehicleServiceInput = {
        vehicle_service_vehicle_id: vehicleId,
        vehicle_service_date: date,
        vehicle_service_odometer: odometer,
        vehicle_service_provider: isDiy ? '' : provider,
        vehicle_service_is_diy: isDiy ? '1' : '0',
        vehicle_service_notes: notes,
        vehicle_service_cost_amount: costAmount,
        vehicle_service_currency_code: currencyCode,
        tags,
      }
      return isEditing && existing ? updateVehicleServiceRecord(existing.vehicle_service_id, input) : createVehicleServiceRecord(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-service'] })
      navigate('/service')
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
        <h1 className="mb-6 text-base font-bold">{isEditing ? 'Edit record' : 'New record'}</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="vehicle">Vehicle</Label>
            <VehiclePicker id="vehicle" vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="odometer">Odometer (km)</Label>
            <Input id="odometer" type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} required />
          </div>

          <label className="flex items-center justify-between gap-2">
            <span className="text-sm">DIY</span>
            <input
              type="checkbox"
              checked={isDiy}
              onChange={(e) => setIsDiy(e.target.checked)}
              className="size-4 accent-primary"
            />
          </label>
          {!isDiy && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="provider">Provider</Label>
              <Input id="provider" value={provider} onChange={(e) => setProvider(e.target.value)} />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="cost">Cost</Label>
              <Input id="cost" type="number" step="0.01" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} required />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              >
                {currencies.length === 0 && <option value="CHF">CHF</option>}
                {currencies.map((c) => (
                  <option key={c.currency_code} value={c.currency_code}>
                    {c.currency_code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((category) => (
                <button
                  key={category.code}
                  type="button"
                  onClick={() => toggleCategory(category.code)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    selectedCategories.has(category.code)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-transparent text-foreground'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Custom tags</Label>
            {customTags.map((tag, i) => (
              <Input
                key={i}
                value={tag}
                onChange={(e) => setCustomTag(i, e.target.value)}
                placeholder="Type a tag"
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={!isValid || mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/service')}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
