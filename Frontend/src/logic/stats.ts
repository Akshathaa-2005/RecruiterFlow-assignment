import { CATEGORIES, type Category, type Expense, type Member } from '../types'
import { computeShares } from './split'

export interface CategoryTotal {
  category: Category
  /** paise */
  amount: number
}

/** Spend per category in the fixed category order; categories with no spend are left out. */
export function categoryTotals(expenses: Expense[]): CategoryTotal[] {
  return CATEGORIES.map((category) => ({
    category,
    amount: expenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + expense.amount, 0),
  })).filter((row) => row.amount > 0)
}

export interface MemberTotal {
  memberId: string
  /** paise this member paid out */
  paid: number
  /** paise of the expenses this member is responsible for */
  share: number
}

export function memberTotals(members: Member[], expenses: Expense[]): MemberTotal[] {
  const paid = new Map<string, number>()
  const share = new Map<string, number>()

  for (const expense of expenses) {
    paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + expense.amount)
    for (const [id, amount] of Object.entries(computeShares(expense, members))) {
      share.set(id, (share.get(id) ?? 0) + amount)
    }
  }

  return members.map((m) => ({
    memberId: m.id,
    paid: paid.get(m.id) ?? 0,
    share: share.get(m.id) ?? 0,
  }))
}

export interface MonthTotal {
  /** YYYY-MM */
  month: string
  amount: number
}

/** Spend per calendar month, oldest first. */
export function monthlyTotals(expenses: Expense[]): MonthTotal[] {
  const months = new Map<string, number>()
  for (const expense of expenses) {
    const month = expense.date.slice(0, 7)
    months.set(month, (months.get(month) ?? 0) + expense.amount)
  }
  return [...months.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
}

/** "56.8%" for 2400000 out of 4224999. Whole-number share when it is exact. */
export function formatShare(part: number, whole: number): string {
  if (whole <= 0) return '0%'
  const tenths = Math.round((part * 1000) / whole) / 10
  return `${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)}%`
}
