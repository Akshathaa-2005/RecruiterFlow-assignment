import { formatMonth } from '../logic/date'
import {
  categoryTotals,
  memberTotals,
  monthlyTotals,
} from '../logic/stats'
import type { Expense, Member } from '../types'
import { DonutChart, HorizontalBars } from './Charts'

interface InsightsProps {
  members: Member[]
  expenses: Expense[]
}

/** Most recent months shown in the monthly chart. */
const MAX_MONTHS = 12

export function Insights({ members, expenses }: InsightsProps) {
  const categories = categoryTotals(expenses)
  const names = new Map(members.map((m) => [m.id, m.name]))
  const people = memberTotals(members, expenses)
  const months = monthlyTotals(expenses).slice(-MAX_MONTHS)

  return (
    <section aria-labelledby="insights-heading">
      <h2 id="insights-heading">Insights</h2>
      <div className="charts">
        <article className="chart-card" aria-labelledby="chart-category">
          <h3 id="chart-category">Spending by category</h3>
          <DonutChart title="Spending by category" rows={categories} />
        </article>

        <article className="chart-card" aria-labelledby="chart-members">
          <h3 id="chart-members">Paid vs. share, per person</h3>
          <HorizontalBars
            title="Paid versus share per person"
            series={[
              { name: 'Paid', className: 'series-paid' },
              { name: 'Share', className: 'series-share' },
            ]}
            rows={people.map((p) => ({
              label: names.get(p.memberId) ?? p.memberId,
              values: [p.paid, p.share],
            }))}
          />
        </article>

        <article className="chart-card wide" aria-labelledby="chart-months">
          <h3 id="chart-months">
            Spending by month{months.length === MAX_MONTHS ? ` (latest ${MAX_MONTHS})` : ''}
          </h3>
          <HorizontalBars
            title="Spending by month"
            series={[{ name: 'Spent', className: 'series-day' }]}
            rows={months.map((m) => ({ label: formatMonth(m.month), values: [m.amount] }))}
          />
        </article>
      </div>
    </section>
  )
}
