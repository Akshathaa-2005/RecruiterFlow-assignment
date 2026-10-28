import { describe, expect, it } from 'vitest'
import { describeSplit, computeShares, splitByPercent, splitEqually } from './split'
import type { Expense, Member } from '../types'

const members: Member[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
]

const total = (shares: Record<string, number>) =>
  Object.values(shares).reduce((sum, n) => sum + n, 0)

describe('splitEqually', () => {
  it('splits ₹100 between 3 as 33.34 + 33.33 + 33.33', () => {
    expect(splitEqually(10_000, ['a', 'b', 'c'])).toEqual({
      a: 3334,
      b: 3333,
      c: 3333,
    })
  })

  it('gives the extra paise to the first members in order', () => {
    expect(splitEqually(10, ['a', 'b', 'c', 'd'])).toEqual({ a: 3, b: 3, c: 2, d: 2 })
    expect(splitEqually(11, ['x', 'y', 'z'])).toEqual({ x: 4, y: 4, z: 3 })
  })

  it('never loses or invents a paisa', () => {
    for (let amount = 1; amount <= 500; amount++) {
      for (let count = 1; count <= 7; count++) {
        const ids = Array.from({ length: count }, (_, i) => `m${i}`)
        expect(total(splitEqually(amount, ids))).toBe(amount)
      }
    }
  })

  it('handles a single member and nobody', () => {
    expect(splitEqually(999, ['a'])).toEqual({ a: 999 })
    expect(splitEqually(999, [])).toEqual({})
  })
})

describe('splitByPercent', () => {
  it('splits the airport cab (₹1,499.99 at 33.33 / 33.33 / 33.34) exactly', () => {
    const shares = splitByPercent(149_999, [
      ['a', 3333],
      ['b', 3333],
      ['c', 3334],
    ])
    expect(shares).toEqual({ a: 49_995, b: 49_995, c: 50_009 })
    expect(total(shares)).toBe(149_999)
  })

  it('is exact when percentages divide evenly', () => {
    expect(
      splitByPercent(200_000, [
        ['a', 5000],
        ['b', 2500],
        ['c', 2500],
      ]),
    ).toEqual({ a: 100_000, b: 50_000, c: 50_000 })
  })

  it('always adds up to the amount', () => {
    for (const amount of [1, 7, 99, 10_001, 149_999, 100_000_000]) {
      const shares = splitByPercent(amount, [
        ['a', 3333],
        ['b', 3333],
        ['c', 3334],
      ])
      expect(total(shares)).toBe(amount)
    }
  })
})

const when = { id: 'expense-1' }

describe('computeShares', () => {
  it('does not depend on the order of keys in saved data', () => {
    const shares = computeShares(
      {
        ...when,
        amount: 200_000,
        split: { type: 'percent', shares: { c: 50, a: 25, b: 25 } },
      },
      members,
    )
    expect(shares).toEqual({ a: 50_000, b: 50_000, c: 100_000 })
  })

  it('splits equally between the selected members only', () => {
    const shares = computeShares(
      { ...when, amount: 10_000, split: { type: 'equal', memberIds: ['c', 'a'] } },
      members,
    )
    expect(shares).toEqual({ a: 5000, c: 5000 })
  })
})

describe('describeSplit', () => {
  it('describes each split type', () => {
    expect(describeSplit({ type: 'equal', memberIds: ['a', 'b', 'c', 'd'] })).toBe(
      'Equally, 4 people',
    )
    expect(describeSplit({ type: 'exact', shares: { a: 1, b: 2, c: 3 } })).toBe(
      'Exact amounts, 3 people',
    )
    expect(describeSplit({ type: 'percent', shares: { a: 100 } })).toBe(
      'Percentages, 1 person',
    )
  })
})

describe('who gets the leftover paise', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']

  it('is the same every time for the same expense id', () => {
    expect(splitEqually(10_001, ids, 'expense-1')).toEqual(
      splitEqually(10_001, ids, 'expense-1'),
    )
  })

  it('starts at different people for different expense ids, never changing the total', () => {
    const extras = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const amount = 10_001 + i * 5
      const shares = splitEqually(amount, ids, `expense-${i}`)
      expect(total(shares)).toBe(amount)
      const biggest = Math.max(...Object.values(shares))
      for (const [id, share] of Object.entries(shares)) {
        if (share === biggest) extras.add(id)
      }
    }
    // Across 30 expenses the extra paisa is not always the first member's.
    expect(extras.size).toBeGreaterThan(1)
  })

  it('gives each member at most one extra paisa, in a run that wraps around', () => {
    for (let i = 0; i < 20; i++) {
      const shares = splitEqually(10_002, ids, `seed-${i}`)
      const values = Object.values(shares)
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
      expect(total(shares)).toBe(10_002)
    }
  })

  it('breaks percentage ties from the seeded position too, still summing exactly', () => {
    for (let i = 0; i < 20; i++) {
      const shares = splitByPercent(
        10_000,
        [
          ['a', 3333],
          ['b', 3333],
          ['c', 3334],
        ],
        `seed-${i}`,
      )
      expect(total(shares)).toBe(10_000)
    }
  })
})

describe('extra paise follow the expense id', () => {
  const base: Expense = {
    id: 'expense-42',
    description: 'Beach chairs',
    amount: 10_000,
    paidBy: 'a',
    date: '2026-03-14',
    category: 'Other',
    split: { type: 'equal', memberIds: ['a', 'b', 'c'] },
  }

  it('does not move when the description or date is edited', () => {
    const before = computeShares(base, members)
    const edited: Expense = { ...base, description: 'Chairs', date: '2026-03-15' }
    expect(computeShares(edited, members)).toEqual(before)
  })

  it('gives different ids different people over many expenses', () => {
    const winners = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const shares = computeShares({ ...base, id: `id-${i}` }, members)
      for (const [id, share] of Object.entries(shares)) {
        if (share === 3334) winners.add(id)
      }
    }
    expect(winners.size).toBe(3)
  })
})
