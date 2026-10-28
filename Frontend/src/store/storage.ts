import type { Expense, Member } from '../types'
import { parseExpenses, parseMembers } from './parse'

export const STORAGE_KEY = 'trip-splitter:expenses'
export const MEMBERS_KEY = 'trip-splitter:members'

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

/** Saved members, or undefined when nothing valid is saved. */
export function loadMembers(storage: Storage): Member[] | undefined {
  try {
    const raw = storage.getItem(MEMBERS_KEY)
    if (raw === null) return undefined
    return parseMembers(JSON.parse(raw))
  } catch {
    return undefined
  }
}

export function saveMembers(storage: Storage, members: Member[]): void {
  try {
    storage.setItem(MEMBERS_KEY, JSON.stringify(members))
  } catch {
    // Same as expenses: keep working without persistence.
  }
}
