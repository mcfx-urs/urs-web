import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createStation, fetchPendingStations, fetchStations, geocode, updateStation, type FillingStation } from '@/lib/fuel'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'

// Round-tripped through /fuel/stations/map's location.state - the station
// form is a real page (not a modal), so a map visit remounts this page;
// everything the dialog needs to reopen with survives via navigation state.
type StationDraftState = { stationId?: string; name: string; address: string; lat: string; lng: string }

export default function FuelStationsPage() {
  const { isSuperUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [editing, setEditing] = useState<FillingStation | 'new' | null>(null)

  const { data: stations, isLoading } = useQuery({ queryKey: ['fuel-stations'], queryFn: fetchStations })
  const { data: pending } = useQuery({
    queryKey: ['fuel-stations-pending'],
    queryFn: fetchPendingStations,
    enabled: isSuperUser,
  })

  const draft = location.state as StationDraftState | undefined
  // A returning map pick (draft present) reopens the dialog even though
  // `editing` itself was reset by the remount - restore which station (if
  // any) was being edited from the draft's stationId.
  const editingStation = draft
    ? ([...(stations ?? []), ...(pending ?? [])].find((s) => s.filling_station_id === draft.stationId) ?? undefined)
    : editing === 'new' || !editing
      ? undefined
      : editing
  const dialogOpen = Boolean(editing) || Boolean(draft)

  function closeDialog() {
    setEditing(null)
    navigate('.', { replace: true, state: undefined })
  }

  function openMap(stationId: string | undefined, name: string, address: string, lat: string, lng: string) {
    const state: StationDraftState = { stationId, name, address, lat, lng }
    navigate('/fuel/stations/map', { state })
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Fuel stations</h1>
          <Button onClick={() => setEditing('new')}>Add station</Button>
        </div>

        {isSuperUser && (pending ?? []).length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-bold">Pending review</h2>
            <div className="flex flex-col gap-2">
              {pending?.map((station) => (
                <button
                  key={station.filling_station_id}
                  onClick={() => setEditing(station)}
                  className={`rounded-xl p-3 text-left ${GLASS_CARD_CLASS}`}
                >
                  <div className="text-sm font-bold">{station.filling_station_name || 'Unnamed station'}</div>
                  <div className="text-xs text-muted-foreground">{station.filling_station_address || 'No address'}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          {isSuperUser && (pending ?? []).length > 0 && <h2 className="mb-2 text-sm font-bold">All stations</h2>}
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          <div className="flex flex-col gap-2">
            {stations?.map((station) =>
              isSuperUser ? (
                <button
                  key={station.filling_station_id}
                  onClick={() => setEditing(station)}
                  className={`rounded-xl p-3 text-left ${GLASS_CARD_CLASS}`}
                >
                  <div className="text-sm font-bold">{station.filling_station_name}</div>
                  {station.filling_station_address && (
                    <div className="text-xs text-muted-foreground">{station.filling_station_address}</div>
                  )}
                </button>
              ) : (
                <div key={station.filling_station_id} className={`rounded-xl p-3 ${GLASS_CARD_CLASS}`}>
                  <div className="text-sm font-bold">{station.filling_station_name}</div>
                  {station.filling_station_address && (
                    <div className="text-xs text-muted-foreground">{station.filling_station_address}</div>
                  )}
                </div>
              ),
            )}
          </div>
        </section>
      </main>

      {dialogOpen && (
        <StationDialog
          key={editingStation?.filling_station_id ?? 'new'}
          station={editingStation}
          draft={draft}
          onClose={closeDialog}
          onOpenMap={(name, address, lat, lng) => openMap(editingStation?.filling_station_id, name, address, lat, lng)}
        />
      )}
    </div>
  )
}

function StationDialog({
  station,
  draft,
  onClose,
  onOpenMap,
}: {
  station?: FillingStation
  draft?: StationDraftState
  onClose: () => void
  onOpenMap: (name: string, address: string, lat: string, lng: string) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(draft?.name ?? station?.filling_station_name ?? '')
  const [address, setAddress] = useState(draft?.address ?? station?.filling_station_address ?? '')
  const [latitude, setLatitude] = useState(draft?.lat ?? station?.filling_station_latitude ?? '')
  const [longitude, setLongitude] = useState(draft?.lng ?? station?.filling_station_longitude ?? '')
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeFailed, setGeocodeFailed] = useState(false)

  const isValid = Boolean(name.trim() && latitude && longitude)

  async function searchPosition() {
    setGeocoding(true)
    setGeocodeFailed(false)
    const result = await geocode(address)
    setGeocoding(false)
    if (result) {
      setLatitude(String(result.latitude))
      setLongitude(String(result.longitude))
    } else {
      setGeocodeFailed(true)
    }
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        filling_station_name: name,
        filling_station_address: address,
        filling_station_latitude: latitude,
        filling_station_longitude: longitude,
      }
      return station ? updateStation(station.filling_station_id, input) : createStation(input).then(() => undefined)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-stations'] })
      queryClient.invalidateQueries({ queryKey: ['fuel-stations-pending'] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{station ? 'Edit station' : 'Add station'}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValid) mutation.mutate()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="station-name">Name</Label>
            <Input id="station-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="station-address">Address</Label>
            <Input id="station-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          {latitude && longitude ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Position set</p>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenMap(name, address, latitude, longitude)}>
                Adjust
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={!address.trim() || geocoding} onClick={searchPosition}>
                {geocoding ? 'Searching...' : 'Search position'}
              </Button>
              {geocodeFailed && (
                <>
                  <p className="text-sm text-destructive">Position not found.</p>
                  <Button type="button" variant="outline" onClick={() => onOpenMap(name, address, '', '')}>
                    Set position manually
                  </Button>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
