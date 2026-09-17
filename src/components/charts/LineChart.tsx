export type LineSeries = { label: string; color: string; points: { x: string; y: number }[] }

type LineChartProps = {
  series: LineSeries[]
  height?: number
}

// Dependency-free multi-series line chart with auto-scaled Y axis
// (0/half-max/max reference marks), matching this batch's BarChart's
// no-library approach (see cross-cutting decision in batch_work_2.md).
// Only series with >= 2 points are rendered as a line - a single point has
// no meaningful trend to draw.
export default function LineChart({ series, height = 160 }: LineChartProps) {
  const renderable = series.filter((s) => s.points.length >= 2)
  const allValues = renderable.flatMap((s) => s.points.map((p) => p.y))
  const maxValue = Math.max(1, ...allValues)
  const labels = renderable[0]?.points.map((p) => p.x) ?? []
  const width = Math.max(200, labels.length * 40)

  if (renderable.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough data yet.</p>
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between text-xs text-muted-foreground" style={{ height }}>
        <span>{maxValue.toFixed(1)}</span>
        <span>{(maxValue / 2).toFixed(1)}</span>
        <span>0</span>
      </div>
      <div className="flex-1 overflow-x-auto">
        <svg width={width} height={height} className="overflow-visible">
          {renderable.map((s) => {
            const points = s.points
              .map((p, i) => {
                const x = (i / (s.points.length - 1)) * width
                const y = height - (p.y / maxValue) * height
                return `${x},${y}`
              })
              .join(' ')
            return <polyline key={s.label} points={points} fill="none" stroke={s.color} strokeWidth={2} />
          })}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          {labels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
