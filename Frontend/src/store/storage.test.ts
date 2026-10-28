import { beforeEach, describe, expect, it } from 'vitest'
import { sampleData } from './sample'
import { loadExpenses, saveExpenses, STORAGE_KEY } from './storage'
import { makeStore } from './store'
import { expenseAdded, expenseDeleted } from './tripSlice'

const { members } = sampleData

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips expenses', () => {
    saveExpenses(localStorage, sampleData.expenses)
    expect(loadExpenses(localStorage, members)).toEqual(sampleData.expenses)
  })

  it('returns undefined when nothing is saved', () => {
    expect(loadExpenses(localStorage, members)).toBeUndefined()
  })

  it('returns undefined for unreadable or inconsistent data', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadExpenses(localStorage, members)).toBeUndefined()

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }))
    expect(loadExpenses(localStorage, members)).toBeUndefined()

    const bad = [{ ...sampleData.expenses[2], amount: 1 }] // exact shares no longer add up
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bad))
    expect(loadExpenses(localStorage, members)).toBeUndefined()
  })
})

describe('store persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts from the sample data when nothing is saved', () => {
    const store = makeStore({ storage: localStorage })
    expect(store.getState().trip.expenses).toEqual(sampleData.expenses)
  })

  it('falls back to the sample data when saved data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, 'oops')
    const store = makeStore({ storage: localStorage })
    expect(store.getState().trip.expenses).toEqual(sampleData.expenses)
  })

  it('saves changes so a reload sees them', () => {
    const first = makeStore({ storage: localStorage })
    first.dispatch(expenseDeleted('e1'))
    first.dispatch(
      expenseAdded({
        description: 'Taxi',
        amount: 50_000,
        paidBy: 'm2',
        date: '2026-03-16',
        category: 'Travel',
        split: { type: 'equal', memberIds: ['m1', 'm2'] },
      }),
    )

    const reloaded = makeStore({ storage: localStorage })
    const expenses = reloaded.getState().trip.expenses
    expect(expenses.map((e) => e.description)).toEqual([
      'Beach shack dinner',
      'Scuba diving',
      'Scooter rental',
      'Groceries',
      'Airport cab',
      'Taxi',
    ])
    expect(expenses.at(-1)?.id).toBeTruthy()
  })
})
