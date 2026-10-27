import type { Member, NewExpense, Split, SplitType } from '../types'
import { isCategory } from '../types'
import { isValidISODate } from './date'
import {
  formatINR,
  formatPercent,
  MAX_AMOUNT,
  parseDecimal,
  type DecimalParse,
} from './money'
import { FULL_PERCENT } from './split'

export const MAX_DESCRIPTION_LENGTH = 60

/** Everything the form holds, exactly as typed by the user. */
export interface ExpenseFormValues {
  description: string
  amount: string
  paidBy: string
  date: string
  category: string
  splitType: SplitType
  equalMemberIds: string[]
  /** rupees typed per member id */
  exact: Record<string, string>
  /** percent typed per member id */
  percent: Record<string, string>
}

export interface ExpenseFormErrors {
  description?: string
  amount?: string
  paidBy?: string
  date?: string
  category?: string
  /** about the split as a whole: nobody selected, or totals that do not match */
  split?: string
  /** per-member problems in the exact / percent inputs, by member id */
  shares: Record<string, string>
}

export type ValidationResult =
  | { ok: true; expense: NewExpense }
  | { ok: false; errors: ExpenseFormErrors }

export function emptyErrors(): ExpenseFormErrors {
  return { shares: {} }
}

export function validateExpenseForm(
  values: ExpenseFormValues,
  members: Member[],
  today: string,
): ValidationResult {
  const errors = emptyErrors()

  const description = values.description.trim()
  if (description === '') {
    errors.description = 'Description is required'
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`
  }

  const amount = checkAmount(values.amount)
  if (amount.error) errors.amount = amount.error

  if (!members.some((m) => m.id === values.paidBy)) {
    errors.paidBy = 'Select who paid'
  }

  if (values.date === '') {
    errors.date = 'Date is required'
  } else if (!isValidISODate(values.date)) {
    errors.date = 'Enter a valid date'
  } else if (values.date > today) {
    errors.date = 'Date cannot be in the future'
  }

  if (!isCategory(values.category)) {
    errors.category = 'Select a category'
  }

  const split = checkSplit(values, members, amount.value, errors)

  if (
    hasErrors(errors) ||
    amount.value === undefined ||
    split === undefined ||
    !isCategory(values.category)
  ) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    expense: {
      description,
      amount: amount.value,
      paidBy: values.paidBy,
      date: values.date,
      category: values.category,
      split,
    },
  }
}

export function hasErrors(errors: ExpenseFormErrors): boolean {
  return (
    errors.description !== undefined ||
    errors.amount !== undefined ||
    errors.paidBy !== undefined ||
    errors.date !== undefined ||
    errors.category !== undefined ||
    errors.split !== undefined ||
    Object.keys(errors.shares).length > 0
  )
}

function checkAmount(input: string): { value?: number; error?: string } {
  const parsed = parseDecimal(input)
  switch (parsed.kind) {
    case 'empty':
      return { error: 'Amount is required' }
    case 'invalid':
      return { error: 'Enter a valid amount, for example 1250.50' }
    case 'too-many-decimals':
      return { error: 'Amount can have at most 2 decimals' }
    case 'too-large':
      return { error: `Amount must be at most ${formatINR(MAX_AMOUNT)}` }
    case 'ok':
      if (parsed.value <= 0) return { error: 'Amount must be more than ₹0' }
      if (parsed.value > MAX_AMOUNT) {
        return { error: `Amount must be at most ${formatINR(MAX_AMOUNT)}` }
      }
      return { value: parsed.value }
  }
}

/** Returns the split to save, or undefined after recording why in `errors`. */
function checkSplit(
  values: ExpenseFormValues,
  members: Member[],
  amount: number | undefined,
  errors: ExpenseFormErrors,
): Split | undefined {
  switch (values.splitType) {
    case 'equal': {
      const chosen = new Set(values.equalMemberIds)
      const memberIds = members.map((m) => m.id).filter((id) => chosen.has(id))
      if (memberIds.length === 0) {
        errors.split = 'Select at least one member'
        return undefined
      }
      return { type: 'equal', memberIds }
    }

    case 'exact': {
      const paise = parseShares(values.exact, members, errors, (parsed) => {
        if (parsed.value < 0) return 'Must be ₹0 or more'
        return undefined
      })
      if (paise === undefined) return undefined
      // Without a valid amount there is nothing to compare the total against.
      if (amount === undefined) return undefined

      const assigned = sum(Object.values(paise))
      if (assigned !== amount) {
        const difference = amount - assigned
        errors.split =
          difference > 0
            ? `${formatINR(difference)} left to assign`
            : `${formatINR(-difference)} over`
        return undefined
      }
      return { type: 'exact', shares: nonZero(paise) }
    }

    case 'percent': {
      const basisPoints = parseShares(
        values.percent,
        members,
        errors,
        (parsed) =>
          parsed.value < 0 || parsed.value > FULL_PERCENT
            ? 'Must be between 0 and 100'
            : undefined,
      )
      if (basisPoints === undefined) return undefined

      const assigned = sum(Object.values(basisPoints))
      if (assigned !== FULL_PERCENT) {
        const difference = FULL_PERCENT - assigned
        errors.split =
          difference > 0
            ? `Percentages must add up to 100. ${formatPercent(difference)}% left to assign`
            : `Percentages must add up to 100. ${formatPercent(-difference)}% over`
        return undefined
      }
      const percents: Record<string, number> = {}
      for (const [id, bp] of Object.entries(nonZero(basisPoints))) {
        percents[id] = bp / 100
      }
      return { type: 'percent', shares: percents }
    }
  }
}

/**
 * Parses one input per member. A blank input counts as 0. Problems are
 * written to `errors.shares`; undefined is returned if there were any.
 */
function parseShares(
  inputs: Record<string, string>,
  members: Member[],
  errors: ExpenseFormErrors,
  checkRange: (parsed: Extract<DecimalParse, { kind: 'ok' }>) => string | undefined,
): Record<string, number> | undefined {
  const values: Record<string, number> = {}
  let valid = true

  for (const { id } of members) {
    const parsed = parseDecimal(inputs[id] ?? '')
    let problem: string | undefined
    switch (parsed.kind) {
      case 'empty':
        values[id] = 0
        continue
      case 'ok':
        problem = checkRange(parsed)
        if (problem === undefined) values[id] = parsed.value
        break
      case 'too-many-decimals':
        problem = 'Use at most 2 decimals'
        break
      case 'too-large':
        problem = 'Number is too large'
        break
      case 'invalid':
        problem = 'Enter a valid number'
        break
    }
    if (problem !== undefined) {
      errors.shares[id] = problem
      valid = false
    }
  }

  return valid ? values : undefined
}

function sum(numbers: number[]): number {
  return numbers.reduce((total, n) => total + n, 0)
}

function nonZero(values: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== 0))
}
