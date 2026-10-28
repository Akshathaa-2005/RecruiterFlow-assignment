import type { Category, Expense, Member } from '../types'
import { computeShares } from './split'

export interface Balance {
  memberId: string
  /** paise; positive means the member gets money back, negative means owes */
  amount: number
}

/**
 * Balance = what the member paid - their share of every expense they are in.
 * Every expense adds `amount` to the payer and subtracts shares that sum to
 * `amount`, so the balances always add up to exactly zero.
 */
export function computeBalances(
  members: Member[],
  expenses: Expense[],
): Balance[] {
  const totals = new Map<string, number>(members.map((m) => [m.id, 0]))
  const add = (id: string, delta: number) => {
    totals.set(id, (totals.get(id) ?? 0) + delta)
  }

  for (const expense of expenses) {
    add(expense.paidBy, expense.amount)
    const shares = computeShares(expense, members)
    for (const [id, share] of Object.entries(shares)) add(id, -share)
  }

  return members.map((m) => ({ memberId: m.id, amount: totals.get(m.id) ?? 0 }))
}

export type BalanceStatus =
  | { kind: 'gets-back'; amount: number }
  | { kind: 'owes'; amount: number }
  | { kind: 'settled' }

export function balanceStatus(balance: number): BalanceStatus {
  if (balance > 0) return { kind: 'gets-back', amount: balance }
  if (balance < 0) return { kind: 'owes', amount: -balance }
  return { kind: 'settled' }
}

/** Newest date first; on the same date the most recently added comes first. */
export function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses]
    .reverse()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export type CategoryFilter = Category | 'All'

export function filterByCategory(
  expenses: Expense[],
  filter: CategoryFilter,
): Expense[] {
  return filter === 'All'
    ? expenses
    : expenses.filter((expense) => expense.category === filter)
}

export function totalAmount(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0)
}
