import { formatINR } from '../logic/money'
import type { Transfer } from '../logic/settle'
import type { Member } from '../types'

interface SettleUpProps {
  members: Member[]
  transfers: Transfer[]
}

export function SettleUp({ members, transfers }: SettleUpProps) {
  const names = new Map(members.map((m) => [m.id, m.name]))
  const nameOf = (id: string) => names.get(id) ?? id

  // One card per person who has to pay, listing everyone they pay.
  const byPayer = new Map<string, Transfer[]>()
  for (const t of transfers) byPayer.set(t.from, [...(byPayer.get(t.from) ?? []), t])

  return (
    <section aria-labelledby="settle-heading">
      <h2 id="settle-heading">Settle up</h2>
      {transfers.length === 0 ? (
        <p className="settle-empty">Everyone is settled up.</p>
      ) : (
        <>
          <p className="settle-summary">
            {transfers.length} {transfers.length === 1 ? 'payment' : 'payments'} settle
            everything:
          </p>
          <ul className="settle-list">
            {[...byPayer].map(([payerId, payments]) => (
              <li key={payerId}>
                <div className="settle-head">
                  <strong>{nameOf(payerId)}</strong> pays
                  <span className="amount">
                    {formatINR(payments.reduce((sum, t) => sum + t.amount, 0))}
                  </span>
                </div>
                <ul className="settle-steps">
                  {payments.map((t) => (
                    <li key={t.to}>
                      <span>
                        to <strong>{nameOf(t.to)}</strong>
                      </span>
                      <span className="amount">{formatINR(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
