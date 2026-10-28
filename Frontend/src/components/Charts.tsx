import { useState } from 'react'
import { formatINR } from '../logic/money'
import { formatShare, type CategoryTotal } from '../logic/stats'

/* ---------- Donut: part-to-whole ---------- */

const RADIUS = 70
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 2 // surface-coloured gap between slices, in SVG units

interface DonutChartProps {
  title: string
  rows: CategoryTotal[]
}

export function DonutChart({ title, rows }: DonutChartProps) {
  const [active, setActive] = useState<string | null>(null)
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const hovered = rows.find((row) => row.category === active)

  let offset = 0
  const slices = rows.map((row) => {
    const length = (row.amount / total) * CIRCUMFERENCE
    const dash = rows.length > 1 ? Math.max(length - GAP, 0.5) : length
    const slice = { row, dash, offset }
    offset += length
    return slice
  })

  const summary = rows
    .map((row) => `${row.category} ${formatINR(row.amount)}`)
    .join(', ')

  return (
    <div className="donut">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`${title}: ${summary}`}
        className="donut-svg"
      >
        <g transform="rotate(-90 100 100)">
          {slices.map(({ row, dash, offset: start }) => (
            <circle
              key={row.category}
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              strokeWidth={active === row.category ? 30 : 26}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-start}
              className={`slice cat-${row.category.toLowerCase()}`}
              opacity={active && active !== row.category ? 0.35 : 1}
              onMouseEnter={() => {
                setActive(row.category)
              }}
              onMouseLeave={() => {
                setActive(null)
              }}
            >
              <title>
                {row.category}: {formatINR(row.amount)} ({formatShare(row.amount, total)})
              </title>
            </circle>
          ))}
        </g>
        <text x="100" y="92" textAnchor="middle" className="donut-label">
          {hovered ? hovered.category : 'Total'}
        </text>
        <text x="100" y="114" textAnchor="middle" className="donut-value">
          {formatINR(hovered ? hovered.amount : total)}
        </text>
        {hovered && (
          <text x="100" y="130" textAnchor="middle" className="donut-label">
            {formatShare(hovered.amount, total)}
          </text>
        )}
      </svg>

      <ul className="legend">
        {rows.map((row) => (
          <li
            key={row.category}
            className={active === row.category ? 'active' : undefined}
            onMouseEnter={() => {
              setActive(row.category)
            }}
            onMouseLeave={() => {
              setActive(null)
            }}
          >
            <span className={`swatch cat-${row.category.toLowerCase()}`} aria-hidden="true" />
            <span className="legend-name">{row.category}</span>
            <span className="legend-amount">{formatINR(row.amount)}</span>
            <span className="legend-share">{formatShare(row.amount, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- Horizontal bars: comparison ---------- */

export interface BarSeries {
  name: string
  className: string
}

export interface BarRow {
  label: string
  /** one value per series, in paise */
  values: number[]
}

interface HorizontalBarsProps {
  title: string
  series: BarSeries[]
  rows: BarRow[]
}

/** Room kept free at the end of the track for the amount label. */
const LABEL_SPACE = '7.5rem'

export function HorizontalBars({ title, series, rows }: HorizontalBarsProps) {
  const max = Math.max(1, ...rows.flatMap((row) => row.values))

  return (
    <div className="hbars">
      {series.length > 1 && (
        <ul className="legend-inline" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name}>
              <span className={`swatch ${s.className}`} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <ul className="hbar-rows" aria-label={title}>
        {rows.map((row) => (
          <li key={row.label} className="hbar-row">
            <span className="hbar-label">{row.label}</span>
            <div className="hbar-tracks">
              {series.map((s, index) => {
                const value = row.values[index] ?? 0
                return (
                  <div
                    key={s.name}
                    className="hbar-track"
                    title={`${row.label}, ${s.name}: ${formatINR(value)}`}
                  >
                    <span
                      className={`hbar-fill ${s.className}`}
                      style={{
                        width: `max(4px, calc((100% - ${LABEL_SPACE}) * ${value / max}))`,
                      }}
                    />
                    <span className="hbar-value">
                      {series.length > 1 && (
                        <span className="visually-hidden">{s.name}: </span>
                      )}
                      {formatINR(value)}
                    </span>
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
