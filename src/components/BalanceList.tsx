import { balanceStatus, type Balance } from '../logic/balances'
import { formatINR } from '../logic/money'
import type { Member } from '../types'

interface BalanceListProps {
  members: Member[]
  balances: Balance[]
}

export function BalanceList({ members, balances }: BalanceListProps) {
  const names = new Map(members.map((m) => [m.id, m.name]))

  return (
    <section aria-labelledby="balances-heading">
      <h2 id="balances-heading">Balances</h2>
      <ul className="balances">
        {balances.map(({ memberId, amount }) => {
          const status = balanceStatus(amount)
          const name = names.get(memberId) ?? memberId
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
            </li>
          )
        })}
      </ul>
    </section>
  )
}
