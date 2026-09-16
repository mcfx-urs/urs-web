import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'
import {
  fetchWorkSettings,
  updateDefaultDailyTargetHours,
  updateEmploymentPercent,
  updateHourlyWage,
  updateWageRules,
  type WageRules,
  type WorkSettings,
} from '@/lib/worktime'

const WAGE_RULE_FIELDS: { key: keyof WageRules; label: string }[] = [
  { key: 'vacation_pay_surcharge_percent', label: 'Vacation pay surcharge % (Feriengeldanspruch)' },
  { key: 'holiday_surcharge_percent', label: 'Holiday compensation surcharge % (Feiertagsentschädigung)' },
  { key: 'thirteenth_month_surcharge_percent', label: '13th-month salary surcharge % (13. Monatslohnanspruch)' },
  { key: 'ahv_iv_eo_deduction_percent', label: 'AHV/IV/EO deduction %' },
  { key: 'alv_deduction_percent', label: 'ALV deduction %' },
  { key: 'suva_nbu_deduction_percent', label: 'SUVA/NBU deduction %' },
  { key: 'ktg_deduction_percent', label: 'KTG deduction %' },
]

export default function WorkTimeSettingsPage() {
  const { data: settings, isLoading } = useQuery({ queryKey: ['worktime-settings'], queryFn: fetchWorkSettings })

  if (isLoading || !settings) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }

  return <SettingsForm settings={settings} />
}

function SettingsForm({ settings }: { settings: WorkSettings }) {
  const [targetHours, setTargetHours] = useState(settings.default_daily_target_hours)
  const [employmentPercent, setEmploymentPercent] = useState(settings.employment_percent)
  const [hourlyWage, setHourlyWage] = useState(settings.hourly_wage)
  const [wageRules, setWageRules] = useState<WageRules>(settings.wageRules)

  const saveMutation = useMutation({
    mutationFn: () =>
      Promise.all([
        updateDefaultDailyTargetHours(targetHours),
        updateEmploymentPercent(employmentPercent),
        updateHourlyWage(hourlyWage),
        updateWageRules(wageRules),
      ]),
  })

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto max-w-lg px-6 py-10">
        <h1 className="mb-6 text-base font-bold">Work Time settings</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            saveMutation.mutate()
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="target-hours">Default daily target hours</Label>
            <Input id="target-hours" type="number" step="0.25" value={targetHours} onChange={(e) => setTargetHours(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="employment-percent">Employment percentage</Label>
            <Input
              id="employment-percent"
              type="number"
              step="1"
              value={employmentPercent}
              onChange={(e) => setEmploymentPercent(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">% of a full-time week (e.g. 40 = 2 days/week)</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hourly-wage">Hourly wage</Label>
            <Input id="hourly-wage" type="number" step="0.05" value={hourlyWage} onChange={(e) => setHourlyWage(e.target.value)} />
          </div>

          <div className="mt-2 border-t border-border pt-4">
            <h2 className="mb-1 text-sm font-bold">Surcharges &amp; deductions</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Configures how the monthly net wage is derived from the gross figure — each rate applies automatically to every
              month's summary. A rate of 0 disables that surcharge or deduction.
            </p>
            <div className="flex flex-col gap-3">
              {WAGE_RULE_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    step="0.001"
                    value={wageRules[key]}
                    onChange={(e) => setWageRules((r) => ({ ...r, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
          {saveMutation.isSuccess && <p className="text-sm text-muted-foreground">Saved</p>}
          {saveMutation.isError && <p className="text-sm text-destructive">Save failed.</p>}
        </form>
      </main>
    </div>
  )
}
