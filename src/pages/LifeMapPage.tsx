import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import TopBar from '@/components/TopBar'
import { fetchLocationHistory, sinceDate, TIME_RANGES, type LifeMapPoint, type TimeRangeKey } from '@/lib/lifemap'

// Default life-map track gradient, oldest -> newest: cyan -> blue -> magenta.
// Same default stops as urs-android's LocationHistorySettingsStore - chosen
// there to sit outside the hue family OSM Carto's own tiles use.
const GRADIENT_STOPS = ['#00e5ff', '#2962ff', '#d500f9']

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

// Interpolates piecewise across `stops` by `fraction` in 0..1 - one segment
// per consecutive point pair gets its own blended colour, approximating a
// multi-colour polyline the same way urs-android's LifeMapView does (Leaflet
// has no native per-segment-colour polyline either).
function blendGradientStops(stops: string[], fraction: number): string {
  const clamped = Math.min(1, Math.max(0, fraction))
  const scaled = clamped * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(scaled))
  const t = scaled - index
  const [r1, g1, b1] = hexToRgb(stops[index])
  const [r2, g2, b2] = hexToRgb(stops[index + 1])
  return rgbToHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t])
}

function FitBounds({ points }: { points: LifeMapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 14)
      return
    }
    map.fitBounds(
      points.map((p) => [p.latitude, p.longitude]),
      { padding: [40, 40] },
    )
  }, [points, map])
  return null
}

export default function LifeMapPage() {
  const [rangeKey, setRangeKey] = useState<TimeRangeKey>('last_day')
  const [muted, setMuted] = useState(false)

  const { data: allPoints, isLoading } = useQuery({
    queryKey: ['lifemap'],
    queryFn: fetchLocationHistory,
  })

  const points = useMemo(() => {
    if (!allPoints) return []
    const since = sinceDate(rangeKey)
    return since ? allPoints.filter((p) => p.capturedAt >= since) : allPoints
  }, [allPoints, rangeKey])

  return (
    <div className="min-h-svh bg-background">
      <TopBar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Life Map</h1>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value as TimeRangeKey)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold ${!muted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setMuted(false)}
            >
              Standard
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-semibold ${muted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              onClick={() => setMuted(true)}
            >
              Muted
            </button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && points.length === 0 && <p className="text-sm text-muted-foreground">No location history yet.</p>}

        {/* The muted toggle class lives on this wrapper, not on MapContainer's own
            className prop - react-leaflet's MapContainer reads className only once
            at initial mount (via a useState initializer) and never re-applies it on
            prop changes, so toggling it directly there has no visible effect. */}
        {!isLoading && points.length > 0 && (
          <div className={`overflow-hidden rounded-xl border border-border ${muted ? 'life-map-muted' : ''}`}>
            <MapContainer
              center={[points[points.length - 1].latitude, points[points.length - 1].longitude]}
              zoom={12}
              scrollWheelZoom
              className="h-[70svh] w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {points.length >= 2 &&
                points.slice(1).map((point, i) => {
                  const fraction = (i + 1) / (points.length - 1)
                  return (
                    <Polyline
                      key={point.id}
                      positions={[
                        [points[i].latitude, points[i].longitude],
                        [point.latitude, point.longitude],
                      ]}
                      pathOptions={{ color: blendGradientStops(GRADIENT_STOPS, fraction), weight: 3 }}
                    />
                  )
                })}
              <FitBounds points={points} />
            </MapContainer>
          </div>
        )}
      </main>
    </div>
  )
}
