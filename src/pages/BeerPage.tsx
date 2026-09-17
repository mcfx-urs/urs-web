import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import BarChart from '@/components/charts/BarChart'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { bathtubs, dailyCounts, monthlyCounts, totalLitersThisYear } from '@/lib/beer-stats'
import { createBeerLogEntry, deleteBeerLogEntry, fetchBeerLog, formatBeerAmount, updateBeerLogDate, type BeerLogEntry } from '@/lib/beer'
import { formatDateTimeLocal } from '@/lib/date-utils'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'

export default function BeerPage() {
  const queryClient = useQueryClient()
  const [editingEntry, setEditingEntry] = useState<BeerLogEntry | null>(null)

  const { data: entries, isLoading } = useQuery({ queryKey: ['beer-log'], queryFn: fetchBeerLog })

  const logMutation = useMutation({
    mutationFn: (amountMl: number) => createBeerLogEntry(amountMl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beer-log'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBeerLogEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['beer-log'] }),
  })

  const liters = totalLitersThisYear(entries ?? [])

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
        <h1 className="text-base font-bold">Beer log</h1>

        <div className="flex gap-3">
          <Button className="flex-1" disabled={logMutation.isPending} onClick={() => logMutation.mutate(500)}>
            5dl
          </Button>
          <Button className="flex-1" disabled={logMutation.isPending} onClick={() => logMutation.mutate(330)}>
            33cl
          </Button>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-bold">Daily (last 30 days)</h2>
          <BarChart buckets={dailyCounts(entries ?? [])} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Monthly (last 12 months)</h2>
          <BarChart buckets={monthlyCounts(entries ?? [])} barWidth={32} />
        </section>

        <section className={`rounded-xl p-4 ${GLASS_CARD_CLASS}`}>
          <p className="text-sm">
            {liters.toFixed(1)} L this year - that's about {bathtubs(liters).toFixed(2)} bathtubs.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">History</h2>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && (entries ?? []).length === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
          <div className="flex flex-col gap-2">
            {entries?.map((entry) => (
              <div key={entry.beer_log_id} className={`flex items-center justify-between gap-3 rounded-xl p-3 ${GLASS_CARD_CLASS}`}>
                <div>
                  <div className="text-sm font-bold">{formatBeerAmount(entry.beer_log_amount_ml)}</div>
                  <div className="text-xs text-muted-foreground">{entry.beer_log_date}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingEntry(entry)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(entry.beer_log_id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {editingEntry && <EditEntryDialog entry={editingEntry} onClose={() => setEditingEntry(null)} />}
    </div>
  )
}

function EditEntryDialog({ entry, onClose }: { entry: BeerLogEntry; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(entry.beer_log_date.slice(0, 10))
  const [time, setTime] = useState(entry.beer_log_date.slice(11, 16))
  const [isFuture, setIsFuture] = useState(false)

  // Checked in the change handlers (not derived during render) so the
  // impure `new Date()`/`Date.now()` read never happens in the render body.
  function checkFuture(nextDate: string, nextTime: string) {
    setIsFuture(Boolean(nextDate && nextTime && new Date(`${nextDate}T${nextTime}:00`).getTime() > Date.now()))
  }

  const isValid = Boolean(date && time && !isFuture)

  const mutation = useMutation({
    mutationFn: () => updateBeerLogDate(entry.beer_log_id, formatDateTimeLocal(new Date(`${date}T${time}:00`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beer-log'] })
      onClose()
    },
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit timestamp</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (isValid) mutation.mutate()
          }}
        >
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  checkFuture(e.target.value, time)
                }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="edit-time">Time</Label>
              <Input
                id="edit-time"
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value)
                  checkFuture(date, e.target.value)
                }}
              />
            </div>
          </div>
          {isFuture && <p className="text-sm text-destructive">Date must not be in the future.</p>}
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
