import type { Expense } from '../types'
import { toInputString } from './money'
import { percentToBasisPoints } from './split'
import type { ExpenseFormValues } from './validation'

/** A saved expense as the form holds it, so it can be edited. */
export function expenseToFormValues(expense: Expense): ExpenseFormValues {
  const { split } = expense
  const equalMemberIds: string[] = split.type === 'equal' ? [...split.memberIds] : []
  const exact: Record<string, string> = {}
  const percent: Record<string, string> = {}

  if (split.type === 'exact') {
    for (const [id, paise] of Object.entries(split.shares)) {
      exact[id] = toInputString(paise)
    }
  } else if (split.type === 'percent') {
    for (const [id, value] of Object.entries(split.shares)) {
      percent[id] = toInputString(percentToBasisPoints(value))
    }
  }

  return {
    description: expense.description,
    amount: toInputString(expense.amount),
    paidBy: expense.paidBy,
    date: expense.date,
    category: expense.category,
    splitType: split.type,
    equalMemberIds,
    exact,
    percent,
  }
}
