import { describe, expect, it } from 'vitest'
import type { Expense } from '../types'
import { countExpensesInvolving } from './members'

const base = {
  description: 'x',
  amount: 100,
  date: '2026-01-01',
  category: 'Food',
} as const

const expenses: Expense[] = [
  { ...base, id: '1', paidBy: 'a', split: { type: 'equal', memberIds: ['a', 'b'] } },
  { ...base, id: '2', paidBy: 'b', split: { type: 'exact', shares: { a: 40, c: 60 } } },
  { ...base, id: '3', paidBy: 'a', split: { type: 'percent', shares: { a: 100 } } },
]

describe('countExpensesInvolving', () => {
  it('counts expenses a member paid for or is split into', () => {
    expect(countExpensesInvolving('a', expenses)).toBe(3)
    expect(countExpensesInvolving('b', expenses)).toBe(2)
    expect(countExpensesInvolving('c', expenses)).toBe(1)
  })

  it('is 0 for a member who is in no expense', () => {
    expect(countExpensesInvolving('z', expenses)).toBe(0)
  })
})
