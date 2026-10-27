import { describe, expect, it } from 'vitest'
import type { Member } from '../types'
import { describeSplitStatus, previewSplit } from './preview'
import type { ExpenseFormValues } from './validation'

const members: Member[] = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
  { id: 'c', name: 'C' },
]

function form(overrides: Partial<ExpenseFormValues>): ExpenseFormValues {
  return {
    description: '',
    amount: '100',
    paidBy: '',
    date: '',
    category: '',
    splitType: 'equal',
    equalMemberIds: ['a', 'b', 'c'],
    exact: {},
    percent: {},
    ...overrides,
  }
}

describe('previewSplit: equal', () => {
  it('shows ₹100 between 3 as 33.34 + 33.33 + 33.33', () => {
    expect(previewSplit(form({}), members)).toEqual({
      type: 'equal',
      total: 10_000,
      rows: [
        { memberId: 'a', amount: 3334 },
        { memberId: 'b', amount: 3333 },
        { memberId: 'c', amount: 3333 },
      ],
    })
  })

  it('only includes selected members, in trip order', () => {
    const preview = previewSplit(form({ equalMemberIds: ['c', 'a'] }), members)
    expect(preview.type === 'equal' && preview.rows.map((r) => r.memberId)).toEqual(['a', 'c'])
  })

  it('shows nothing until there is a usable amount and a member', () => {
    for (const overrides of [{ amount: '' }, { amount: 'x' }, { amount: '-5' }, { equalMemberIds: [] }]) {
      const preview = previewSplit(form(overrides), members)
      expect(preview.type === 'equal' && preview.rows).toEqual([])
    }
  })
})

describe('previewSplit: percent', () => {
  it('shows rupees per member and the running total', () => {
    const preview = previewSplit(form({ splitType: 'percent', percent: { a: '50', b: '25' } }), members)
    expect(preview).toEqual({
      type: 'percent',
      assigned: 7500,
      rows: [
        { memberId: 'a', amount: 5000 },
        { memberId: 'b', amount: 2500 },
        { memberId: 'c', amount: 0 },
      ],
    })
    expect(describeSplitStatus(preview)).toEqual({
      text: '75% assigned · 25% remaining',
      tone: 'pending',
    })
  })

  it('shares add up to the amount once percentages reach 100', () => {
    const preview = previewSplit(
      form({ splitType: 'percent', amount: '1499.99', percent: { a: '33.33', b: '33.33', c: '33.34' } }),
      members,
    )
    expect(preview.type === 'percent' && preview.rows.map((r) => r.amount)).toEqual([49_995, 49_995, 50_009])
    expect(describeSplitStatus(preview)?.text).toBe('100% assigned')
  })

  it('reports being over 100 and ignores unreadable inputs', () => {
    const preview = previewSplit(
      form({ splitType: 'percent', percent: { a: '70', b: '45.5', c: 'abc' } }),
      members,
    )
    expect(describeSplitStatus(preview)).toEqual({
      text: '115.5% assigned · 15.5% over',
      tone: 'over',
    })
  })

  it('shows no rupee amounts without an amount', () => {
    const preview = previewSplit(form({ splitType: 'percent', amount: '', percent: { a: '50' } }), members)
    expect(preview.type === 'percent' && preview.rows).toEqual([])
  })
})

describe('previewSplit: exact', () => {
  const exact = (shares: Record<string, string>, amount = '100') =>
    describeSplitStatus(previewSplit(form({ splitType: 'exact', amount, exact: shares }), members))

  it('shows what is left to assign', () => {
    expect(exact({ a: '50', b: '37.50' })).toEqual({ text: '₹12.50 left to assign', tone: 'pending' })
  })

  it('shows what is over', () => {
    expect(exact({ a: '80', b: '30.25' })).toEqual({ text: '₹10.25 over', tone: 'over' })
  })

  it('shows when everything is assigned', () => {
    expect(exact({ a: '60', b: '40' })).toEqual({ text: 'Fully assigned', tone: 'ok' })
  })

  it('asks for the amount first', () => {
    expect(exact({ a: '10' }, '')?.tone).toBe('pending')
  })
})
