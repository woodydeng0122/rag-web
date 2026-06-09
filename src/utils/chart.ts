import { computed } from 'vue'

export interface ChartPoint {
  x: number
  y: number
}

export function computePointList(
  items: any[],
  valueGetter: (item: any) => number,
  chartWidth: number,
  chartHeight: number,
  chartPadding: number,
  xStep: number,
): ChartPoint[] {
  const points: ChartPoint[] = []
  const h = chartHeight - 2 * chartPadding
  items.forEach((item, i) => {
    points.push({
      x: chartPadding + i * xStep,
      y: chartPadding + h * (1 - valueGetter(item)),
    })
  })
  return points
}

export function pointsToString(points: ChartPoint[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ')
}

export function areaPointsToString(points: ChartPoint[], chartHeight: number, chartPadding: number): string {
  if (points.length === 0) return ''
  const h = chartHeight - chartPadding
  const first = points[0]
  const last = points[points.length - 1]
  return `${first.x},${h} ${pointsToString(points)} ${last.x},${h}`
}
