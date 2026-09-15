import { apiFetch } from './api'
import { currentUserId } from './users'

export type WorkTimeBreak = {
  work_time_break_id?: string
  work_time_break_start_time: string
  work_time_break_end_time: string
}

export type WorkTimeEntry = {
  work_time_entry_id: string
  work_time_entry_user_id: string
  work_time_entry_date: string
  work_time_entry_work_start: string
  work_time_entry_work_end: string
  work_time_entry_target_daily_hours: string
  work_time_entry_paid_break: string
  work_time_entry_meal_allowance: string
  work_time_entry_comment: string
  breaks: WorkTimeBreak[]
  daily_total_hours: string
  over_undertime_hours: string
  created_at: string
  updated_at: string
}

export type WorkTimeEntryInput = {
  work_time_entry_date: string
  work_time_entry_work_start: string
  work_time_entry_work_end: string
  work_time_entry_target_daily_hours: string
  work_time_entry_paid_break: string
  work_time_entry_meal_allowance: string
  work_time_entry_comment: string
  breaks: WorkTimeBreak[]
}

export type WorkTimeMonthOverride = {
  work_time_month_override_id: string
  work_time_month_override_user_id: string
  work_time_month_override_year: string
  work_time_month_override_month: string
  work_time_month_override_days_worked: string
  work_time_month_override_bvg_amount: string
}

export type WageRules = {
  vacation_pay_surcharge_percent: string
  holiday_surcharge_percent: string
  thirteenth_month_surcharge_percent: string
  ahv_iv_eo_deduction_percent: string
  alv_deduction_percent: string
  suva_nbu_deduction_percent: string
  ktg_deduction_percent: string
}

export type WorkSettings = {
  default_daily_target_hours: string
  employment_percent: string
  hourly_wage: string
  wageRules: WageRules
}

// Same defaults urs-android pre-fills the first time a user's wage rules
// are read blank (see GitHub issue #11's worked example there). AHV/ALV
// match current official Swiss employee-share rates. BVG isn't a rate here
// - it's a per-month franc amount on the month override.
export const DEFAULT_WAGE_RULES: WageRules = {
  vacation_pay_surcharge_percent: '10.6',
  holiday_surcharge_percent: '3.8',
  thirteenth_month_surcharge_percent: '8.33',
  ahv_iv_eo_deduction_percent: '5.3',
  alv_deduction_percent: '1.1',
  suva_nbu_deduction_percent: '1.76',
  ktg_deduction_percent: '1.621',
}

function withWageRuleDefaults(rules: WageRules): WageRules {
  const withDefault = (v: string, d: string) => (v.trim() ? v : d)
  return {
    vacation_pay_surcharge_percent: withDefault(rules.vacation_pay_surcharge_percent, DEFAULT_WAGE_RULES.vacation_pay_surcharge_percent),
    holiday_surcharge_percent: withDefault(rules.holiday_surcharge_percent, DEFAULT_WAGE_RULES.holiday_surcharge_percent),
    thirteenth_month_surcharge_percent: withDefault(
      rules.thirteenth_month_surcharge_percent,
      DEFAULT_WAGE_RULES.thirteenth_month_surcharge_percent,
    ),
    ahv_iv_eo_deduction_percent: withDefault(rules.ahv_iv_eo_deduction_percent, DEFAULT_WAGE_RULES.ahv_iv_eo_deduction_percent),
    alv_deduction_percent: withDefault(rules.alv_deduction_percent, DEFAULT_WAGE_RULES.alv_deduction_percent),
    suva_nbu_deduction_percent: withDefault(rules.suva_nbu_deduction_percent, DEFAULT_WAGE_RULES.suva_nbu_deduction_percent),
    ktg_deduction_percent: withDefault(rules.ktg_deduction_percent, DEFAULT_WAGE_RULES.ktg_deduction_percent),
  }
}

async function json<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  return res.json()
}

// The backend encodes an empty result set as JSON `null`, not `[]`.
async function jsonOrEmpty<T>(res: Response, action: string): Promise<T[]> {
  if (!res.ok) throw new Error(`${action} failed (${res.status})`)
  const data = await res.json()
  return (data ?? []) as T[]
}

// A single call well under the endpoint's 10000-row hard cap - a daily
// work-time log for years still lands far short of that, unlike location
// history's much higher capture cadence.
const ENTRY_FETCH_LIMIT = '10000'

export async function fetchWorkTimeEntries(): Promise<WorkTimeEntry[]> {
  const userId = currentUserId()
  if (!userId) return []
  const res = await apiFetch(`/api/v1/work-time-entry/${userId}/${ENTRY_FETCH_LIMIT}/DESC`)
  return jsonOrEmpty<WorkTimeEntry>(res, 'load work time entries')
}

export async function createWorkTimeEntry(input: WorkTimeEntryInput): Promise<WorkTimeEntry> {
  const res = await apiFetch('/api/v1/work-time-entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, work_time_entry_user_id: currentUserId() }),
  })
  return json(res, 'create work time entry')
}

export async function updateWorkTimeEntry(id: string, input: WorkTimeEntryInput): Promise<WorkTimeEntry> {
  const res = await apiFetch(`/api/v1/work-time-entry/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, work_time_entry_user_id: currentUserId() }),
  })
  return json(res, 'update work time entry')
}

export async function deleteWorkTimeEntry(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/work-time-entry/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete work time entry failed (${res.status})`)
}

export async function fetchMonthOverrides(): Promise<WorkTimeMonthOverride[]> {
  const userId = currentUserId()
  if (!userId) return []
  const res = await apiFetch(`/api/v1/work-time-month-override/${userId}`)
  return jsonOrEmpty<WorkTimeMonthOverride>(res, 'load month overrides')
}

export async function setMonthOverride(year: number, month: number, daysWorked: string, bvgAmount: string): Promise<void> {
  const userId = currentUserId()
  if (!userId) return
  const res = await apiFetch(`/api/v1/work-time-month-override/${userId}/${year}/${month}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      work_time_month_override_days_worked: daysWorked,
      work_time_month_override_bvg_amount: bvgAmount,
    }),
  })
  if (!res.ok) throw new Error(`save month override failed (${res.status})`)
}

export async function clearMonthOverride(year: number, month: number): Promise<void> {
  const userId = currentUserId()
  if (!userId) return
  const res = await apiFetch(`/api/v1/work-time-month-override/${userId}/${year}/${month}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`clear month override failed (${res.status})`)
}

// Filtered down to the caller's own user_id here, same approach
// lib/users.ts's fetchHouseholdUsers already uses to narrow this
// endpoint's response for ShareSheet. Only the caller's own work
// settings are ever read into state or rendered.
export async function fetchWorkSettings(): Promise<WorkSettings> {
  const userId = currentUserId()
  const res = await apiFetch('/api/v1/getuser')
  const users = await jsonOrEmpty<Record<string, string>>(res, 'load work settings')
  const me = users.find((u) => u.user_id === userId)
  return {
    default_daily_target_hours: me?.user_default_daily_target_hours ?? '',
    employment_percent: me?.user_employment_percent ?? '',
    hourly_wage: me?.user_hourly_wage ?? '',
    wageRules: withWageRuleDefaults({
      vacation_pay_surcharge_percent: me?.user_vacation_pay_surcharge_percent ?? '',
      holiday_surcharge_percent: me?.user_holiday_surcharge_percent ?? '',
      thirteenth_month_surcharge_percent: me?.user_thirteenth_month_surcharge_percent ?? '',
      ahv_iv_eo_deduction_percent: me?.user_ahv_iv_eo_deduction_percent ?? '',
      alv_deduction_percent: me?.user_alv_deduction_percent ?? '',
      suva_nbu_deduction_percent: me?.user_suva_nbu_deduction_percent ?? '',
      ktg_deduction_percent: me?.user_ktg_deduction_percent ?? '',
    }),
  }
}

export async function updateDefaultDailyTargetHours(hours: string): Promise<void> {
  const userId = currentUserId()
  if (!userId) return
  const res = await apiFetch(`/api/v1/user/${userId}/default-daily-target-hours`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_default_daily_target_hours: hours }),
  })
  if (!res.ok) throw new Error(`save target hours failed (${res.status})`)
}

export async function updateEmploymentPercent(percent: string): Promise<void> {
  const userId = currentUserId()
  if (!userId) return
  const res = await apiFetch(`/api/v1/user/${userId}/employment-percent`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_employment_percent: percent }),
  })
  if (!res.ok) throw new Error(`save employment percent failed (${res.status})`)
}

export async function updateHourlyWage(wage: string): Promise<void> {
  const userId = currentUserId()
  if (!userId) return
  const res = await apiFetch(`/api/v1/user/${userId}/hourly-wage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_hourly_wage: wage }),
  })
  if (!res.ok) throw new Error(`save hourly wage failed (${res.status})`)
}

export async function updateWageRules(rules: WageRules): Promise<void> {
  const userId = currentUserId()
  if (!userId) return
  const res = await apiFetch(`/api/v1/user/${userId}/wage-rules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_vacation_pay_surcharge_percent: rules.vacation_pay_surcharge_percent,
      user_holiday_surcharge_percent: rules.holiday_surcharge_percent,
      user_thirteenth_month_surcharge_percent: rules.thirteenth_month_surcharge_percent,
      user_ahv_iv_eo_deduction_percent: rules.ahv_iv_eo_deduction_percent,
      user_alv_deduction_percent: rules.alv_deduction_percent,
      user_suva_nbu_deduction_percent: rules.suva_nbu_deduction_percent,
      user_ktg_deduction_percent: rules.ktg_deduction_percent,
    }),
  })
  if (!res.ok) throw new Error(`save wage rules failed (${res.status})`)
}

// --- Calculations, ported from urs-android's WorkTimeCalculations.kt ------
// The backend computes daily_total_hours/over_undertime_hours for a saved
// entry (urs-backend's computeDailyTotals) - dailyHoursWorked/computeTotals
// below exist only for the add/edit form's live preview, before the row
// exists server-side. Both sides must be changed together if the formula
// ever changes.

function rangeHours(start: string, end: string): number | null {
  const [h1, m1, s1] = start.split(':').map(Number)
  const [h2, m2, s2] = end.split(':').map(Number)
  if ([h1, m1, s1, h2, m2, s2].some((n) => Number.isNaN(n))) return null
  return (h2 * 3600 + m2 * 60 + s2 - (h1 * 3600 + m1 * 60 + s1)) / 3600
}

const PAID_BREAK_HOURS = 0.25

export function dailyHoursWorked(
  workStart: string,
  workEnd: string,
  paidBreak: boolean,
  breaks: { start: string; end: string }[],
): number | null {
  const span = rangeHours(workStart, workEnd)
  if (span === null) return null
  const withoutBreaks = breaks.reduce((acc, b) => acc - (rangeHours(b.start, b.end) ?? 0), span)
  return paidBreak ? withoutBreaks + PAID_BREAK_HOURS : withoutBreaks
}

export type WorkTimeTotals = { dailyTotalHours: number | null; overUndertimeHours: number | null }

export function computeTotals(dailyTotalHours: number | null, targetDailyHours: string, userDefaultTargetHours: string): WorkTimeTotals {
  if (dailyTotalHours === null) return { dailyTotalHours: null, overUndertimeHours: null }
  // `||` would treat a legitimate 0-hour target as "unset" and fall through
  // to the default - only fall back when the per-entry value doesn't parse.
  const perEntryTarget = parseFloat(targetDailyHours)
  const target = Number.isNaN(perEntryTarget) ? parseFloat(userDefaultTargetHours) : perEntryTarget
  return { dailyTotalHours, overUndertimeHours: Number.isNaN(target) ? null : dailyTotalHours - target }
}

// Monday-Friday calendar days in a given month.
export function possibleWeekdaysInMonth(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

export type WageLineItemType = 'vacation_pay' | 'holiday_pay' | 'thirteenth_month' | 'ahv_iv_eo' | 'alv' | 'suva_nbu' | 'ktg' | 'bvg'

export type WageLineItem = { type: WageLineItemType; percent: number | null; amount: number }

export const MEAL_ALLOWANCE_PER_DAY = 18

export type WageBreakdown = {
  baseWage: number
  surcharges: WageLineItem[]
  gross: number
  deductions: WageLineItem[]
  totalDeductions: number
  net: number
  mealAllowanceDays: number
  mealAllowanceAmount: number
}

function applyPercent(base: number, percent: string): number {
  const p = parseFloat(percent)
  return base * (Number.isNaN(p) ? 0 : p) / 100
}

function roundToNearestFiveRappen(value: number): number {
  return Math.round(value * 20) / 20
}

/**
 * Chained surcharges (each a % of a running subtotal), then the meal
 * allowance added into gross, then chained deductions (each a % of the
 * gross *before* the meal allowance, plus BVG's fixed amount) - matches
 * the payslip layout urs-android's computeWage mirrors (GitHub issue #11's
 * worked example there). The meal allowance carries no surcharge or
 * deduction, so it passes straight through to net. Every line is rounded
 * to 5 Rappen and totals are the sum of the rounded lines.
 */
export function computeWage(baseWage: number, rules: WageRules, mealAllowanceDays = 0, bvgDeduction = 0): WageBreakdown {
  const surcharge = (type: WageLineItemType, percent: string, base: number): WageLineItem => ({
    type,
    percent: parseFloat(percent) || 0,
    amount: roundToNearestFiveRappen(applyPercent(base, percent)),
  })

  const vacationPay = surcharge('vacation_pay', rules.vacation_pay_surcharge_percent, baseWage)
  const holidayPay = surcharge('holiday_pay', rules.holiday_surcharge_percent, baseWage)
  const beforeThirteenthMonth = baseWage + vacationPay.amount + holidayPay.amount
  const thirteenthMonth = surcharge('thirteenth_month', rules.thirteenth_month_surcharge_percent, beforeThirteenthMonth)
  const grossBeforeMealAllowance = beforeThirteenthMonth + thirteenthMonth.amount

  const mealAllowanceAmount = mealAllowanceDays * MEAL_ALLOWANCE_PER_DAY
  const gross = grossBeforeMealAllowance + mealAllowanceAmount

  const deduction = (type: WageLineItemType, percent: string): WageLineItem => ({
    type,
    percent: parseFloat(percent) || 0,
    amount: roundToNearestFiveRappen(applyPercent(grossBeforeMealAllowance, percent)),
  })

  const ahv = deduction('ahv_iv_eo', rules.ahv_iv_eo_deduction_percent)
  const alv = deduction('alv', rules.alv_deduction_percent)
  const suva = deduction('suva_nbu', rules.suva_nbu_deduction_percent)
  const bvg: WageLineItem = { type: 'bvg', percent: null, amount: roundToNearestFiveRappen(bvgDeduction) }
  const ktg = deduction('ktg', rules.ktg_deduction_percent)

  const deductions = [ahv, alv, suva, bvg, ktg]
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0)
  const net = roundToNearestFiveRappen(gross - totalDeductions)

  return {
    baseWage,
    surcharges: [vacationPay, holidayPay, thirteenthMonth],
    gross,
    deductions,
    totalDeductions,
    net,
    mealAllowanceDays,
    mealAllowanceAmount,
  }
}

export type MonthlySummary = {
  actualHours: number
  overUndertimeHours: number | null
  wageBreakdown: WageBreakdown | null
  percentOfContractSoll: number | null
}

/**
 * Two deliberately independent measures, ported from
 * computeMonthlySummary: Plus/Minus is self-referential ("on the days I
 * logged, did I hit my daily target?" - always meaningful, including for
 * the active month), percentOfContractSoll answers "of my full month's
 * contractual obligation, what fraction did I work?" (only meaningful once
 * a month has fully ended - null while isCurrentMonth).
 */
export function computeMonthlySummary(
  entries: WorkTimeEntry[],
  year: number,
  month: number,
  employmentPercent: string,
  targetHoursPerDay: string,
  hourlyWage: string,
  wageRules: WageRules,
  overrideDaysWorked: string,
  bvgAmountForMonth: string,
  isCurrentMonth: boolean,
): MonthlySummary {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const monthEntries = entries.filter((e) => e.work_time_entry_date.startsWith(monthPrefix))
  const actualHours = monthEntries.reduce((sum, e) => {
    const hours = dailyHoursWorked(
      e.work_time_entry_work_start,
      e.work_time_entry_work_end,
      e.work_time_entry_paid_break === '1',
      e.breaks.map((b) => ({ start: b.work_time_break_start_time, end: b.work_time_break_end_time })),
    )
    return sum + (hours ?? 0)
  }, 0)

  const dailyTarget = parseFloat(targetHoursPerDay)
  const hasDailyTarget = !Number.isNaN(dailyTarget)
  // `||` would treat a legitimate 0-days override (e.g. a vacation month)
  // as "unset" and fall through to the raw entry count - only fall back
  // when the override doesn't parse.
  const parsedOverride = parseFloat(overrideDaysWorked)
  const daysWorked = Number.isNaN(parsedOverride) ? monthEntries.length : parsedOverride
  const plusMinusSoll = hasDailyTarget ? daysWorked * dailyTarget : null

  let percentOfContractSoll: number | null = null
  if (!isCurrentMonth) {
    const percent = parseFloat(employmentPercent)
    const contractSollHours =
      !Number.isNaN(percent) && hasDailyTarget ? possibleWeekdaysInMonth(year, month) * (percent / 100) * dailyTarget : null
    percentOfContractSoll = contractSollHours && contractSollHours !== 0 ? (actualHours / contractSollHours) * 100 : null
  }

  // Capped at one flagged day per calendar date, not per entry - a split
  // shift logged as two entries the same day must not double the allowance.
  const mealAllowanceDays = new Set(
    monthEntries.filter((e) => e.work_time_entry_meal_allowance === '1').map((e) => e.work_time_entry_date),
  ).size
  const wage = parseFloat(hourlyWage)
  const wageBreakdown = Number.isNaN(wage)
    ? null
    : computeWage(actualHours * wage, wageRules, mealAllowanceDays, parseFloat(bvgAmountForMonth) || 0)

  return {
    actualHours,
    overUndertimeHours: plusMinusSoll === null ? null : actualHours - plusMinusSoll,
    wageBreakdown,
    percentOfContractSoll,
  }
}

export function formatHours(hours: number): string {
  return hours.toFixed(2)
}

export function formatSignedHours(hours: number): string {
  return `${hours >= 0 ? '+' : ''}${hours.toFixed(2)}`
}
