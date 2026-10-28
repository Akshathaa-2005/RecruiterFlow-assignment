import { describe, expect, it } from 'vitest'
import type { Member } from '../types'
import { validateExpenseForm, visibleErrors, type ExpenseFormValues } from './validation'

const members: Member[] = [
  { id: 'm1', name: 'Aarav' },
  { id: 'm2', name: 'Diya' },
  { id: 'm3', name: 'Kabir' },
]
const today = '2026-06-15'

function form(overrides: Partial<ExpenseFormValues> = {}): ExpenseFormValues {
  return {
    description: 'Dinner',
    amount: '300',
    paidBy: 'm1',
    date: '2026-06-01',
    category: 'Food',
    splitType: 'equal',
    equalMemberIds: ['m1', 'm2', 'm3'],
    exact: {},
    percent: {},
    ...overrides,
  }
}

function errorsFor(overrides: Partial<ExpenseFormValues>) {
  const result = validateExpenseForm(form(overrides), members, today)
  if (result.ok) throw new Error('expected validation to fail')
  return result.errors
}

describe('validateExpenseForm: basics', () => {
  it('accepts a valid equal split and returns paise', () => {
    const result = validateExpenseForm(form({ amount: '1250.50' }), members, today)
    expect(result).toEqual({
      ok: true,
      expense: {
        description: 'Dinner',
        amount: 125_050,
        paidBy: 'm1',
        date: '2026-06-01',
        category: 'Food',
        split: { type: 'equal', memberIds: ['m1', 'm2', 'm3'] },
      },
    })
  })

  it('requires a description of at most 60 characters', () => {
    expect(errorsFor({ description: '   ' }).description).toBe('Description is required')
    expect(errorsFor({ description: 'x'.repeat(61) }).description).toMatch(/at most 60/)
    const ok = validateExpenseForm(form({ description: 'x'.repeat(60) }), members, today)
    expect(ok.ok).toBe(true)
  })

  it('checks the amount rules', () => {
    expect(errorsFor({ amount: '' }).amount).toBe('Amount is required')
    expect(errorsFor({ amount: 'abc' }).amount).toMatch(/valid amount/)
    expect(errorsFor({ amount: '-50' }).amount).toBe('Amount must be more than ₹0')
    expect(errorsFor({ amount: '0' }).amount).toBe('Amount must be more than ₹0')
    expect(errorsFor({ amount: '10.999' }).amount).toBe('Amount can have at most 2 decimals')
    expect(errorsFor({ amount: '1000000.01' }).amount).toBe(
      'Amount must be at most ₹10,00,000.00',
    )
    expect(validateExpenseForm(form({ amount: '1000000' }), members, today).ok).toBe(true)
  })

  it('requires paid by, date and category', () => {
    const errors = errorsFor({ paidBy: '', date: '', category: '' })
    expect(errors.paidBy).toBe('Select who paid')
    expect(errors.date).toBe('Date is required')
    expect(errors.category).toBe('Select a category')
  })

  it('rejects dates in the future but allows today', () => {
    expect(errorsFor({ date: '2026-06-16' }).date).toBe('Date cannot be in the future')
    expect(errorsFor({ date: '2026-02-30' }).date).toBe('Enter a valid date')
    expect(validateExpenseForm(form({ date: today }), members, today).ok).toBe(true)
  })

  it('reports every broken field at once', () => {
    const result = validateExpenseForm(
      form({ description: '', amount: '', paidBy: '', category: '' }),
      members,
      today,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ['amount', 'category', 'description', 'paidBy', 'shares'].sort(),
      )
    }
  })
})

describe('validateExpenseForm: equal split', () => {
  it('needs at least one member', () => {
    expect(errorsFor({ equalMemberIds: [] }).split).toBe('Select at least one member')
  })

  it('stores selected members in trip order', () => {
    const result = validateExpenseForm(form({ equalMemberIds: ['m3', 'm1'] }), members, today)
    expect(result.ok && result.expense.split).toEqual({ type: 'equal', memberIds: ['m1', 'm3'] })
  })
})

describe('validateExpenseForm: exact split', () => {
  const exact = (shares: Record<string, string>, amount = '100') =>
    form({ splitType: 'exact', amount, exact: shares })

  it('accepts shares that add up exactly, treating blanks as 0', () => {
    const result = validateExpenseForm(exact({ m1: '60.50', m2: '39.50' }), members, today)
    expect(result.ok && result.expense.split).toEqual({
      type: 'exact',
      shares: { m1: 6050, m2: 3950 },
    })
  })

  it('says how much is left to assign', () => {
    const errors = errorsFor(exact({ m1: '50', m2: '37.50' }))
    expect(errors.split).toBe('₹12.50 left to assign')
  })

  it('says how much is over', () => {
    expect(errorsFor(exact({ m1: '80', m2: '30.25' })).split).toBe('₹10.25 over')
  })

  it('flags bad individual amounts next to their member', () => {
    const errors = errorsFor(exact({ m1: '-5', m2: 'abc', m3: '1.234' }))
    expect(errors.shares).toEqual({
      m1: 'Must be ₹0 or more',
      m2: 'Enter a valid number',
      m3: 'Use at most 2 decimals',
    })
  })
})

describe('validateExpenseForm: percentage split', () => {
  const percent = (shares: Record<string, string>) =>
    form({ splitType: 'percent', percent: shares })

  it('accepts percentages that total 100', () => {
    const result = validateExpenseForm(
      percent({ m1: '33.33', m2: '33.33', m3: '33.34' }),
      members,
      today,
    )
    expect(result.ok && result.expense.split).toEqual({
      type: 'percent',
      shares: { m1: 33.33, m2: 33.33, m3: 33.34 },
    })
  })

  it('rejects totals other than 100', () => {
    expect(errorsFor(percent({ m1: '50', m2: '40' })).split).toMatch(/10% left to assign/)
    expect(errorsFor(percent({ m1: '60', m2: '50.5' })).split).toMatch(/10.5% over/)
  })

  it('keeps each value between 0 and 100 with at most 2 decimals', () => {
    const errors = errorsFor(percent({ m1: '101', m2: '-1', m3: '10.123' }))
    expect(errors.shares).toEqual({
      m1: 'Must be between 0 and 100',
      m2: 'Must be between 0 and 100',
      m3: 'Use at most 2 decimals',
    })
  })
})

describe('visibleErrors', () => {
  it('keeps back errors for fields that are not shown yet', () => {
    const errors = errorsFor({ description: '', amount: '', paidBy: '' })
    const shown = visibleErrors(errors, (key) => key === 'amount')
    expect(shown.amount).toBe('Amount is required')
    expect(shown.description).toBeUndefined()
    expect(shown.paidBy).toBeUndefined()
  })

  it('filters per-member share errors by their own key', () => {
    const errors = errorsFor({ splitType: 'percent', percent: { m1: '150', m2: 'x' } })
    const shown = visibleErrors(errors, (key) => key === 'share:m1')
    expect(Object.keys(shown.shares)).toEqual(['m1'])
  })
})
