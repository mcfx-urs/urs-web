import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GLASS_BACKGROUND_GRADIENT_CLASS, GLASS_CARD_CLASS } from '@/lib/glass-style'
import {
  clearMonthOverride,
  computeMonthlySummary,
  deleteWorkTimeEntry,
  fetchMonthOverrides,
  fetchWorkSettings,
  fetchWorkTimeEntries,
  formatHours,
  formatSignedHours,
  setMonthOverride,
  type WageBreakdown,
  type WorkTimeMonthOverride,
} from '@/lib/worktime'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// The BVG amount carries forward: a month with no value of its own inherits
// the most recent earlier month that has one.
function carriedBvg(overrides: WorkTimeMonthOverride[], year: number, month: number): WorkTimeMonthOverride | undefined {
  return overrides
    .filter((o) => {
      const y = Number(o.work_time_month_override_year)
      const m = Number(o.work_time_month_override_month)
      return o.work_time_month_override_bvg_amount.trim() !== '' && (y < year || (y === year && m <= month))
    })
    .sort((a, b) => {
      const ya = Number(a.work_time_month_override_year)
      const yb = Number(b.work_time_month_override_year)
      if (ya !== yb) return yb - ya
      return Number(b.work_time_month_override_month) - Number(a.work_time_month_override_month)
    })[0]
}

export default function WorkTimePage() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [wageBreakdownOpen, setWageBreakdownOpen] = useState(false)

  const { data: entries, isLoading } = useQuery({ queryKey: ['worktime-entries'], queryFn: fetchWorkTimeEntries })
  const { data: overrides } = useQuery({ queryKey: ['worktime-overrides'], queryFn: fetchMonthOverrides })
  const { data: settings } = useQuery({ queryKey: ['worktime-settings'], queryFn: fetchWorkSettings })

  const deleteMutation = useMutation({
    mutationFn: deleteWorkTimeEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worktime-entries'] }),
  })

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const monthEntries = useMemo(
    () => (entries ?? []).filter((e) => e.work_time_entry_date.startsWith(monthPrefix)),
    [entries, monthPrefix],
  )

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const currentOverride = overrides?.find(
    (o) => Number(o.work_time_month_override_year) === year && Number(o.work_time_month_override_month) === month,
  )
  const bvgForMonth = carriedBvg(overrides ?? [], year, month)?.work_time_month_override_bvg_amount ?? ''

  const summary = useMemo(
    () =>
      computeMonthlySummary(
        entries ?? [],
        year,
        month,
        settings?.employment_percent ?? '',
        settings?.default_daily_target_hours ?? '',
        settings?.hourly_wage ?? '',
        settings?.wageRules ?? {
          vacation_pay_surcharge_percent: '',
          holiday_surcharge_percent: '',
          thirteenth_month_surcharge_percent: '',
          ahv_iv_eo_deduction_percent: '',
          alv_deduction_percent: '',
          suva_nbu_deduction_percent: '',
          ktg_deduction_percent: '',
        },
        currentOverride?.work_time_month_override_days_worked ?? '',
        bvgForMonth,
        isCurrentMonth,
      ),
    [entries, year, month, settings, currentOverride, bvgForMonth, isCurrentMonth],
  )

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setYear(y)
    setMonth(m)
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-base font-bold">Work Time</h1>
          <div className="flex gap-2">
            <Link to="/worktime/settings" className={buttonVariants({ variant: 'outline' })}>
              Settings
            </Link>
            <Link to="/worktime/new" className={buttonVariants({ variant: 'default' })}>
              New entry
            </Link>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
            Prev
          </Button>
          <span className="text-sm font-bold">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="outline" size="sm" onClick={() => shiftMonth(1)} disabled={isCurrentMonth}>
            Next
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <StatTile label="Hours" value={formatHours(summary.actualHours)} />
          <StatTile
            label="Plus/Minus"
            value={summary.overUndertimeHours !== null ? formatSignedHours(summary.overUndertimeHours) : '–'}
            negative={summary.overUndertimeHours !== null && summary.overUndertimeHours < 0}
            onClick={() => setOverrideOpen(true)}
          />
          <EarningsTile
            breakdown={summary.wageBreakdown}
            onClick={() => summary.wageBreakdown && setWageBreakdownOpen(true)}
          />
          <StatTile
            label="% of monthly Soll"
            value={summary.percentOfContractSoll !== null ? `${formatHours(summary.percentOfContractSoll)}%` : '–'}
            negative={summary.percentOfContractSoll !== null && summary.percentOfContractSoll < 100}
          />
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && monthEntries.length === 0 && <p className="text-sm text-muted-foreground">No work-time entries yet.</p>}

        <div className="flex flex-col gap-3">
          {monthEntries.map((entry) => {
            const overUnder = parseFloat(entry.over_undertime_hours)
            const hasOverUnder = !Number.isNaN(overUnder)
            return (
              <div key={entry.work_time_entry_id} className={`rounded-xl p-4 ${GLASS_CARD_CLASS}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">{entry.work_time_entry_date}</span>
                  <div className="flex items-center gap-2">
                    {entry.work_time_entry_meal_allowance === '1' && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Meal allowance</span>
                    )}
                    <span className="text-sm font-bold">{formatHours(Number(entry.daily_total_hours))} h</span>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {entry.work_time_entry_work_start.slice(0, 5)} – {entry.work_time_entry_work_end.slice(0, 5)}
                  </span>
                  {hasOverUnder && (
                    <span className={`text-sm ${overUnder < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {formatSignedHours(overUnder)}
                    </span>
                  )}
                </div>
                {entry.breaks.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">{entry.breaks.length} break(s)</p>
                )}
                {entry.work_time_entry_comment && (
                  <p className="mt-1 text-xs text-muted-foreground">{entry.work_time_entry_comment}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Link
                    to={`/worktime/${entry.work_time_entry_id}`}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Edit
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(entry.work_time_entry_id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <MonthOverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        year={year}
        month={month}
        existing={currentOverride}
        carriedBvgHint={
          !currentOverride?.work_time_month_override_bvg_amount && bvgForMonth
            ? `Carried from an earlier month: ${bvgForMonth}`
            : undefined
        }
        onSave={async (daysWorked, bvgAmount) => {
          if (!daysWorked && !bvgAmount) {
            await clearMonthOverride(year, month)
          } else {
            await setMonthOverride(year, month, daysWorked, bvgAmount)
          }
          queryClient.invalidateQueries({ queryKey: ['worktime-overrides'] })
        }}
      />

      <Dialog open={wageBreakdownOpen} onOpenChange={setWageBreakdownOpen}>
        {summary.wageBreakdown && (
          <DialogContent>
            <WageBreakdownContent breakdown={summary.wageBreakdown} hourlyWage={settings?.hourly_wage ?? ''} actualHours={summary.actualHours} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function StatTile({
  label,
  value,
  negative,
  onClick,
}: {
  label: string
  value: string
  negative?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col gap-1 rounded-xl p-3 text-left ${onClick ? 'hover:border-primary' : ''} ${GLASS_CARD_CLASS}`}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-base font-bold ${negative ? 'text-destructive' : ''}`}>{value}</span>
    </button>
  )
}

function EarningsTile({ breakdown, onClick }: { breakdown: WageBreakdown | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!breakdown}
      className={`flex flex-col gap-1 rounded-xl p-3 text-left ${breakdown ? 'hover:border-primary' : ''} ${GLASS_CARD_CLASS}`}
    >
      <span className="text-xs text-muted-foreground">Earnings</span>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Gross</span>
        <span className="font-mono text-sm">{breakdown ? formatHours(breakdown.gross) : '–'}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">Net</span>
        <span className="font-mono text-sm">{breakdown ? formatHours(breakdown.net) : '–'}</span>
      </div>
    </button>
  )
}

function MonthOverrideDialog({
  open,
  onOpenChange,
  year,
  month,
  existing,
  carriedBvgHint,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  month: number
  existing?: WorkTimeMonthOverride
  carriedBvgHint?: string
  onSave: (daysWorked: string, bvgAmount: string) => Promise<void>
}) {
  const [daysWorked, setDaysWorked] = useState(existing?.work_time_month_override_days_worked ?? '')
  const [bvgAmount, setBvgAmount] = useState(existing?.work_time_month_override_bvg_amount ?? '')
  const [saving, setSaving] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDaysWorked(existing?.work_time_month_override_days_worked ?? '')
          setBvgAmount(existing?.work_time_month_override_bvg_amount ?? '')
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Month adjustments — {MONTH_NAMES[month - 1]} {year}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="days-worked">Days worked this month</Label>
            <Input id="days-worked" value={daysWorked} onChange={(e) => setDaysWorked(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bvg-amount">BVG deduction (CHF)</Label>
            <Input id="bvg-amount" value={bvgAmount} onChange={(e) => setBvgAmount(e.target.value)} />
            {carriedBvgHint && !bvgAmount && <p className="text-xs text-muted-foreground">{carriedBvgHint}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true)
                await onSave(daysWorked.trim(), bvgAmount.trim())
                setSaving(false)
                onOpenChange(false)
              }}
            >
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const LINE_ITEM_LABELS: Record<string, string> = {
  vacation_pay: 'Vacation pay',
  holiday_pay: 'Holiday compensation',
  thirteenth_month: '13th-month salary',
  ahv_iv_eo: 'AHV/IV/EO',
  alv: 'ALV',
  suva_nbu: 'SUVA/NBU',
  ktg: 'KTG',
  bvg: 'BVG',
}

function WageBreakdownContent({ breakdown, hourlyWage, actualHours }: { breakdown: WageBreakdown; hourlyWage: string; actualHours: number }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Wage breakdown</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-1.5 text-sm">
        <Row label="Base wage" detail={`${formatHours(actualHours)} h × CHF ${hourlyWage}/h`} amount={breakdown.baseWage} />
        {breakdown.mealAllowanceDays > 0 && (
          <Row label={`Meal allowance (${breakdown.mealAllowanceDays} × CHF 18.–)`} amount={breakdown.mealAllowanceAmount} />
        )}
        {breakdown.surcharges.map((item) => (
          <Row key={item.type} label={`${LINE_ITEM_LABELS[item.type]} (${item.percent}%)`} amount={item.amount} />
        ))}
        <TotalRow label="Gross" amount={breakdown.gross} />
        {breakdown.deductions.map((item) => (
          <Row
            key={item.type}
            label={item.percent !== null ? `${LINE_ITEM_LABELS[item.type]} (${item.percent}%)` : LINE_ITEM_LABELS[item.type]}
            amount={-item.amount}
          />
        ))}
        <Row label="Total deductions" amount={-breakdown.totalDeductions} />
        <TotalRow label="Net" amount={breakdown.net} />
      </div>
    </>
  )
}

function Row({ label, detail, amount }: { label: string; detail?: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">
        {label}
        {detail && <span className="block text-xs">{detail}</span>}
      </span>
      <span className="font-mono">{formatHours(amount)}</span>
    </div>
  )
}

function TotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-border pt-1.5 font-bold">
      <span>{label}</span>
      <span className="font-mono">{formatHours(amount)}</span>
    </div>
  )
}
