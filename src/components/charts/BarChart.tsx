import type { Bucket } from '@/lib/beer-stats'

type BarChartProps = {
  buckets: Bucket[]
  barWidth?: number
}

// Dependency-free horizontal-scroll bar chart, auto-scaled with 0/half-max/
// max reference marks - matches urs-android's Beer/Fuel stats chart
// treatment (Canvas-free custom drawing, no charting library).
export default function BarChart({ buckets, barWidth = 24 }: BarChartProps) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count))
  const chartHeight = 80

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between text-xs text-muted-foreground" style={{ height: chartHeight }}>
        <span>{maxCount}</span>
        <span>{Math.round(maxCount / 2)}</span>
        <span>0</span>
      </div>
      <div className="flex flex-1 gap-1 overflow-x-auto">
        {buckets.map((bucket, i) => (
          <div key={i} className="flex flex-col items-center justify-end gap-1" style={{ width: barWidth }}>
            <div
              className="w-full rounded-t-sm bg-primary"
              style={{ height: Math.max(1, (bucket.count / maxCount) * chartHeight) }}
            />
            <span className="text-[10px] text-muted-foreground">{bucket.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
