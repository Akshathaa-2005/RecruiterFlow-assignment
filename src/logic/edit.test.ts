import { describe, expect, it } from 'vitest'
import { sampleData } from '../store/sample'
import { expenseToFormValues } from './edit'
import { validateExpenseForm } from './validation'

describe('expenseToFormValues', () => {
  it('turns every saved expense back into a form that validates to the same expense', () => {
    for (const { id, ...expense } of sampleData.expenses) {
      const result = validateExpenseForm(
        expenseToFormValues({ id, ...expense }),
        sampleData.members,
        '2099-01-01',
      )
      expect(result.ok && result.expense).toEqual(expense)
    }
  })

  it('writes the amount the way a person would type it', () => {
    const [first] = sampleData.expenses
    if (!first) throw new Error('no sample expenses')
    expect(expenseToFormValues({ ...first, amount: 149999 }).amount).toBe('1499.99')
    expect(expenseToFormValues({ ...first, amount: 100000 }).amount).toBe('1000')
  })
})
