import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { getCurrentPosition } from '@/lib/geolocation'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'

// A plain divIcon sidesteps the well-known Leaflet-in-a-bundler issue where
// the default marker image URLs don't resolve without extra webpack/vite
// asset config - simpler than fixing that up for one pin.
const PIN_ICON = L.divIcon({
  className: '',
  html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:var(--color-primary,#3b82f6);transform:rotate(-45deg);border:2px solid white"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
})

const SWITZERLAND_CENTER: [number, number] = [46.8182, 8.2275]

type MapDraftState = { stationId?: string; name: string; address: string; lat: string; lng: string }

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function RecenterOnce({ position, zoom }: { position: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(position, zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function FuelStationMapPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const draft = location.state as MapDraftState | undefined

  const initialPin: [number, number] | null =
    draft?.lat && draft?.lng ? [Number(draft.lat), Number(draft.lng)] : null

  const [pin, setPin] = useState<[number, number] | null>(initialPin)
  const [center, setCenter] = useState<[number, number]>(initialPin ?? SWITZERLAND_CENTER)
  const [zoom, setZoom] = useState(initialPin ? 17 : 7)

  // Fallback chain: a pending position from the form -> the browser's
  // current position -> a Switzerland-wide overview - matches urs-android's
  // FuelStationMapScreen exactly.
  useEffect(() => {
    if (initialPin) return
    getCurrentPosition()
      .then(({ lat, lng }) => {
        setCenter([lat, lng])
        setZoom(17)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function confirm() {
    if (!pin) return
    navigate('/fuel/stations', {
      replace: true,
      state: { stationId: draft?.stationId, name: draft?.name ?? '', address: draft?.address ?? '', lat: String(pin[0]), lng: String(pin[1]) },
    })
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-10">
        <h1 className="text-base font-bold">Set station position</h1>
        <div className="overflow-hidden rounded-xl border border-border">
          <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-[60svh] w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterOnce position={center} zoom={zoom} />
            <ClickToPlace onPlace={(lat, lng) => setPin([lat, lng])} />
            {pin && (
              <Marker
                position={pin}
                icon={PIN_ICON}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target as L.Marker
                    const { lat, lng } = marker.getLatLng()
                    setPin([lat, lng])
                  },
                }}
              />
            )}
          </MapContainer>
        </div>
        <p className="text-sm text-muted-foreground">Tap the map to place the pin, or drag it to adjust.</p>
        <div className="flex gap-2">
          <Button disabled={!pin} onClick={confirm}>
            Confirm
          </Button>
          <Button variant="outline" onClick={() => navigate('/fuel/stations')}>
            Cancel
          </Button>
        </div>
      </main>
    </div>
  )
}
