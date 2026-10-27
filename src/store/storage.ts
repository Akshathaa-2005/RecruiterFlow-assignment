import type { Expense, Member } from '../types'
import { parseExpenses } from './parse'

export const STORAGE_KEY = 'trip-splitter:expenses'

/**
 * Saved expenses, or undefined when nothing is saved or what is saved cannot
 * be read (storage blocked, invalid JSON, wrong shape, inconsistent splits).
 */
export function loadExpenses(
  storage: Storage,
  members: Member[],
): Expense[] | undefined {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return undefined
    const parsed: unknown = JSON.parse(raw)
    return parseExpenses(parsed, members)
  } catch {
    return undefined
  }
}

export function saveExpenses(storage: Storage, expenses: Expense[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(expenses))
  } catch {
    // Storage full or blocked: the app keeps working, changes just won't persist.
  }
}
