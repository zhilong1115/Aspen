import React, { useMemo } from 'react'

interface DataPoint {
  time: string
  value: number
}

interface PortfolioChartProps {
  data: DataPoint[]
  isPositive?: boolean
  height?: number
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({
  data,
  isPositive = true,
  height = 200,
}) => {
  const { path, areaPath } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', areaPath: '' }
    }

    const values = data.map((d) => d.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue || 1

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100
      const y = 100 - ((d.value - minValue) / range) * 100
      return { x, y }
    })

    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')

    const area =
      linePath +
      ` L 100 100 L 0 100 Z`

    return { path: linePath, areaPath: area }
  }, [data])

  const strokeColor = isPositive ? '#00C805' : '#FF5000'
  const gradientId = isPositive ? 'greenGradient' : 'redGradient'

  return (
    <div className="w-full" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="greenGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#00C805" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00C805" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="redGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FF5000" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FF5000" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export default PortfolioChart
