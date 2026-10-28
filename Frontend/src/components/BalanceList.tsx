import { balanceStatus, type Balance } from '../logic/balances'
import { formatINR } from '../logic/money'
import type { Member } from '../types'

interface BalanceListProps {
  members: Member[]
  balances: Balance[]
  /** Expenses each member is part of, by member id */
  usage: Map<string, number>
  onRemove: (member: Member) => void
}

export function BalanceList({ members, balances, usage, onRemove }: BalanceListProps) {
  const byId = new Map(members.map((m) => [m.id, m]))

  return (
    <section aria-labelledby="balances-heading">
      <h2 id="balances-heading">Balances</h2>
      <ul className="balances">
        {balances.map(({ memberId, amount }) => {
          const status = balanceStatus(amount)
          const member = byId.get(memberId)
          const name = member?.name ?? memberId
          const used = usage.get(memberId) ?? 0
          return (
            <li key={memberId} className={`balance ${status.kind}`}>
              <span className="avatar" aria-hidden="true">
                {name.charAt(0)}
              </span>
              <span className="balance-name">{name}</span>
              <span className={`badge status-${status.kind}`}>
                {status.kind === 'gets-back' && `gets back ${formatINR(status.amount)}`}
                {status.kind === 'owes' && `owes ${formatINR(status.amount)}`}
                {status.kind === 'settled' && 'settled up'}
              </span>
              {member && used === 0 && members.length > 1 && (
                <button
                  type="button"
                  className="remove-member"
                  aria-label={`Remove ${name}`}
                  onClick={() => {
                    onRemove(member)
                  }}
                >
                  Remove
                </button>
              )}
              {used > 0 && (
                <span className="member-note">
                  In {used} {used === 1 ? 'expense' : 'expenses'}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
