import { describe, expect, it } from 'vitest'
import { sampleData } from '../store/sample'
import { categoryTotals, formatShare, memberTotals, monthlyTotals } from './stats'

const { members, expenses } = sampleData

describe('categoryTotals', () => {
  it('totals per category in the fixed order and skips empty ones', () => {
    expect(categoryTotals(expenses)).toEqual([
      { category: 'Food', amount: 425_000 },
      { category: 'Travel', amount: 349_999 },
      { category: 'Stay', amount: 2_400_000 },
      { category: 'Activities', amount: 1_050_000 },
    ])
  })

  it('is empty without expenses', () => {
    expect(categoryTotals([])).toEqual([])
  })
})

describe('memberTotals', () => {
  it('splits what each member paid from what they are responsible for', () => {
    const totals = memberTotals(members, expenses)
    expect(totals.find((t) => t.memberId === 'm1')).toEqual({
      memberId: 'm1',
      paid: 2_549_999,
      share: 694_579,
    })
    expect(totals.find((t) => t.memberId === 'm4')).toEqual({
      memberId: 'm4',
      paid: 100_000,
      share: 911_250,
    })
  })

  it('paid and share both add up to the total spent', () => {
    const totals = memberTotals(members, expenses)
    const spent = expenses.reduce((sum, e) => sum + e.amount, 0)
    expect(totals.reduce((sum, t) => sum + t.paid, 0)).toBe(spent)
    expect(totals.reduce((sum, t) => sum + t.share, 0)).toBe(spent)
  })
})

describe('monthlyTotals', () => {
  it('adds up each calendar month, oldest first', () => {
    const [villa, , , , , cab] = expenses
    if (!villa || !cab) throw new Error('sample data changed')
    const extra = [
      { ...villa, id: 'x1', date: '2026-01-31', amount: 10_000 },
      { ...cab, id: 'x2', date: '2026-04-01', amount: 5000 },
    ]
    expect(monthlyTotals([...expenses, ...extra])).toEqual([
      { month: '2026-01', amount: 10_000 },
      { month: '2026-03', amount: 4_224_999 },
      { month: '2026-04', amount: 5000 },
    ])
  })

  it('is empty without expenses', () => {
    expect(monthlyTotals([])).toEqual([])
  })
})

describe('formatShare', () => {
  it('rounds to one decimal and drops a trailing .0', () => {
    expect(formatShare(2_400_000, 4_224_999)).toBe('56.8%')
    expect(formatShare(1, 2)).toBe('50%')
    expect(formatShare(0, 0)).toBe('0%')
  })
})
