import type { Balance } from './balances'

export interface Transfer {
  from: string
  to: string
  /** paise */
  amount: number
}

/**
 * Who should pay whom to clear every balance, in at most (people - 1)
 * payments: the person who owes most pays the person owed most, and so on.
 * Balances add up to zero, so everyone ends exactly at zero.
 */
export function suggestSettlements(balances: Balance[]): Transfer[] {
  const owing = balances
    .filter((b) => b.amount < 0)
    .map((b) => ({ id: b.memberId, left: -b.amount }))
    .sort((a, b) => b.left - a.left)
  const owed = balances
    .filter((b) => b.amount > 0)
    .map((b) => ({ id: b.memberId, left: b.amount }))
    .sort((a, b) => b.left - a.left)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < owing.length && j < owed.length) {
    const payer = owing[i]
    const payee = owed[j]
    if (!payer || !payee) break
    const amount = Math.min(payer.left, payee.left)
    transfers.push({ from: payer.id, to: payee.id, amount })
    payer.left -= amount
    payee.left -= amount
    if (payer.left === 0) i++
    if (payee.left === 0) j++
  }
  return transfers
}
