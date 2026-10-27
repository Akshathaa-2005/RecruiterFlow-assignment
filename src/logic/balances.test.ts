import { describe, expect, it } from 'vitest'
import { sampleData } from '../store/sample'
import type { Expense, Member } from '../types'
import {
  balanceStatus,
  computeBalances,
  filterByCategory,
  sortExpenses,
  totalAmount,
} from './balances'

const members: Member[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
]

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'x',
    description: 'Thing',
    amount: 10_000,
    paidBy: 'a',
    date: '2026-03-12',
    category: 'Other',
    split: { type: 'equal', memberIds: ['a', 'b', 'c'] },
    ...overrides,
  }
}

const amountOf = (balances: ReturnType<typeof computeBalances>, id: string) =>
  balances.find((b) => b.memberId === id)?.amount

describe('computeBalances', () => {
  it('is paid minus share, positive meaning gets money back', () => {
    const balances = computeBalances(members, [expense({ amount: 9000 })])
    expect(amountOf(balances, 'a')).toBe(6000)
    expect(amountOf(balances, 'b')).toBe(-3000)
    expect(amountOf(balances, 'c')).toBe(-3000)
  })

  it('handles ₹100 split between 3 without losing a paisa', () => {
    const balances = computeBalances(members, [expense({ amount: 10_000 })])
    // a paid 10,000 and owes their own share; b and c just owe theirs
    const shares = [
      10_000 - (amountOf(balances, 'a') ?? 0),
      -(amountOf(balances, 'b') ?? 0),
      -(amountOf(balances, 'c') ?? 0),
    ]
    expect(shares.sort()).toEqual([3333, 3333, 3334])
    expect(balances.reduce((sum, b) => sum + b.amount, 0)).toBe(0)
  })

  it('lets the payer sit out of the split', () => {
    const balances = computeBalances(members, [
      expense({ amount: 5000, split: { type: 'equal', memberIds: ['b', 'c'] } }),
    ])
    expect(amountOf(balances, 'a')).toBe(5000)
    expect(amountOf(balances, 'b')).toBe(-2500)
    expect(amountOf(balances, 'c')).toBe(-2500)
  })

  it('returns zero for everyone when there are no expenses', () => {
    expect(computeBalances(members, []).map((b) => b.amount)).toEqual([0, 0, 0])
  })

  it('matches hand-worked balances for the sample trip and sums to zero', () => {
    const balances = computeBalances(sampleData.members, sampleData.expenses)
    expect(balances.map((b) => [b.memberId, b.amount])).toEqual([
      ['m1', 1_855_421],
      ['m2', -369_579],
      ['m3', 55_408],
      ['m4', -811_250],
      ['m5', -730_000],
    ])
    expect(balances.reduce((sum, b) => sum + b.amount, 0)).toBe(0)
  })
})

describe('balanceStatus', () => {
  it('classifies balances', () => {
    expect(balanceStatus(150)).toEqual({ kind: 'gets-back', amount: 150 })
    expect(balanceStatus(-150)).toEqual({ kind: 'owes', amount: 150 })
    expect(balanceStatus(0)).toEqual({ kind: 'settled' })
  })
})

describe('sortExpenses', () => {
  it('puts the newest date first, latest added first within a date', () => {
    const list = [
      expense({ id: '1', date: '2026-03-12' }),
      expense({ id: '2', date: '2026-03-14' }),
      expense({ id: '3', date: '2026-03-12' }),
    ]
    expect(sortExpenses(list).map((e) => e.id)).toEqual(['2', '3', '1'])
  })

  it('does not change the input', () => {
    const list = [
      expense({ id: '1', date: '2026-01-01' }),
      expense({ id: '2', date: '2026-02-01' }),
    ]
    sortExpenses(list)
    expect(list.map((e) => e.id)).toEqual(['1', '2'])
  })
})

describe('filterByCategory and totalAmount', () => {
  const list = [
    expense({ id: '1', category: 'Food', amount: 100 }),
    expense({ id: '2', category: 'Travel', amount: 250 }),
    expense({ id: '3', category: 'Food', amount: 50 }),
  ]

  it('filters by category, or keeps all', () => {
    expect(filterByCategory(list, 'Food').map((e) => e.id)).toEqual(['1', '3'])
    expect(filterByCategory(list, 'All')).toHaveLength(3)
    expect(filterByCategory(list, 'Stay')).toEqual([])
  })

  it('totals what is given', () => {
    expect(totalAmount(filterByCategory(list, 'Food'))).toBe(150)
    expect(totalAmount([])).toBe(0)
  })
})
