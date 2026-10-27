import type { Expense } from '../types'

/** How many expenses the member paid for or takes a share of. */
export function countExpensesInvolving(memberId: string, expenses: Expense[]): number {
  return expenses.filter(
    (e) =>
      e.paidBy === memberId ||
      (e.split.type === 'equal'
        ? e.split.memberIds.includes(memberId)
        : memberId in e.split.shares),
  ).length
}
