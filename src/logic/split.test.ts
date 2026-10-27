import { describe, expect, it } from 'vitest'
import { describeSplit, computeShares, splitByPercent, splitEqually } from './split'
import type { Member } from '../types'

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

describe('computeShares', () => {
  it('does not depend on the order of keys in saved data', () => {
    const shares = computeShares(
      { amount: 200_000, split: { type: 'percent', shares: { c: 50, a: 25, b: 25 } } },
      members,
    )
    expect(shares).toEqual({ a: 50_000, b: 50_000, c: 100_000 })
  })

  it('splits equally between the selected members only', () => {
    const shares = computeShares(
      { amount: 10_000, split: { type: 'equal', memberIds: ['c', 'a'] } },
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
