import type { Expense, Member, Split, TripData } from '../types'
import { isCategory } from '../types'
import { isValidISODate } from '../logic/date'
import { FULL_PERCENT, percentToBasisPoints } from '../logic/split'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function parseMember(value: unknown): Member | undefined {
  if (!isRecord(value)) return undefined
  const { id, name } = value
  if (typeof id !== 'string' || typeof name !== 'string') return undefined
  return { id, name }
}

function parseNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) return undefined
  const result: Record<string, number> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return undefined
    result[key] = entry
  }
  return result
}

function sum(numbers: number[]): number {
  return numbers.reduce((total, n) => total + n, 0)
}

/**
 * Reads a split and checks it is internally consistent: known members only,
 * and shares that add up to the expense amount (or to 100%).
 */
function parseSplit(
  value: unknown,
  amount: number,
  memberIds: Set<string>,
): Split | undefined {
  if (!isRecord(value)) return undefined

  if (value.type === 'equal') {
    const ids = asArray(value.memberIds)
    if (!ids || ids.length === 0) return undefined
    const memberIdList: string[] = []
    for (const id of ids) {
      if (typeof id !== 'string' || !memberIds.has(id)) return undefined
      memberIdList.push(id)
    }
    return { type: 'equal', memberIds: memberIdList }
  }

  if (value.type === 'exact' || value.type === 'percent') {
    const shares = parseNumberRecord(value.shares)
    if (!shares || Object.keys(shares).some((id) => !memberIds.has(id))) {
      return undefined
    }
    const values = Object.values(shares)
    if (values.some((share) => share < 0)) return undefined

    if (value.type === 'exact') {
      if (!values.every(Number.isInteger) || sum(values) !== amount) {
        return undefined
      }
      return { type: 'exact', shares }
    }
    const total = sum(values.map(percentToBasisPoints))
    if (total !== FULL_PERCENT) return undefined
    return { type: 'percent', shares }
  }

  return undefined
}

function parseExpense(value: unknown, memberIds: Set<string>): Expense | undefined {
  if (!isRecord(value)) return undefined
  const { id, description, amount, paidBy, date, category } = value

  if (
    typeof id !== 'string' ||
    typeof description !== 'string' ||
    !isPositiveInteger(amount) ||
    typeof paidBy !== 'string' ||
    !memberIds.has(paidBy) ||
    typeof date !== 'string' ||
    !isValidISODate(date) ||
    typeof category !== 'string' ||
    !isCategory(category)
  ) {
    return undefined
  }

  const split = parseSplit(value.split, amount, memberIds)
  if (!split) return undefined

  return { id, description, amount, paidBy, date, category, split }
}

/** Returns undefined unless every member and expense is valid. */
export function parseExpenses(
  value: unknown,
  members: Member[],
): Expense[] | undefined {
  const items = asArray(value)
  if (!items) return undefined
  const memberIds = new Set(members.map((m) => m.id))
  const expenses: Expense[] = []
  for (const item of items) {
    const expense = parseExpense(item, memberIds)
    if (!expense) return undefined
    expenses.push(expense)
  }
  return expenses
}

export function parseTripData(value: unknown): TripData | undefined {
  if (!isRecord(value)) return undefined
  const memberItems = asArray(value.members)
  if (!memberItems) return undefined
  const members: Member[] = []
  for (const item of memberItems) {
    const member = parseMember(item)
    if (!member) return undefined
    members.push(member)
  }
  const expenses = parseExpenses(value.expenses, members)
  return expenses ? { members, expenses } : undefined
}
