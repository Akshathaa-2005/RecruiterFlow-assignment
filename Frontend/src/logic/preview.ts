import type { Member } from '../types'
import { formatINR, formatPercent, MAX_AMOUNT, parseDecimal } from './money'
import { FULL_PERCENT, splitByPercent, splitEqually } from './split'
import type { ExpenseFormValues } from './validation'

export interface ShareRow {
  memberId: string
  /** paise */
  amount: number
}

/**
 * What the form can tell the user about the split while they are still
 * typing. Unlike validation it never fails: unreadable inputs count as 0.
 */
export type SplitPreview =
  | { type: 'equal'; rows: ShareRow[]; total: number }
  | { type: 'exact'; assigned: number; remaining: number | undefined }
  | { type: 'percent'; assigned: number; rows: ShareRow[] }

function readAmount(input: string): number | undefined {
  const parsed = parseDecimal(input)
  return parsed.kind === 'ok' && parsed.value > 0 && parsed.value <= MAX_AMOUNT
    ? parsed.value
    : undefined
}

/** Parsed value of one share input, or 0 when blank, invalid or out of range. */
function readShare(input: string | undefined, max: number): number {
  const parsed = parseDecimal(input ?? '')
  return parsed.kind === 'ok' && parsed.value >= 0 && parsed.value <= max
    ? parsed.value
    : 0
}

/**
 * `expenseId` is the id the expense will be saved with, so the extra paise are
 * shown on the same people they will be saved on.
 */
export function previewSplit(
  values: ExpenseFormValues,
  members: Member[],
  expenseId = '',
): SplitPreview {
  const amount = readAmount(values.amount)

  switch (values.splitType) {
    case 'equal': {
      const chosen = new Set(values.equalMemberIds)
      const ids = members.map((m) => m.id).filter((id) => chosen.has(id))
      if (amount === undefined || ids.length === 0) {
        return { type: 'equal', rows: [], total: 0 }
      }
      const shares = splitEqually(amount, ids, expenseId)
      return {
        type: 'equal',
        rows: ids.map((memberId) => ({ memberId, amount: shares[memberId] ?? 0 })),
        total: amount,
      }
    }

    case 'exact': {
      const assigned = members.reduce(
        (total, m) => total + readShare(values.exact[m.id], MAX_AMOUNT),
        0,
      )
      return {
        type: 'exact',
        assigned,
        remaining: amount === undefined ? undefined : amount - assigned,
      }
    }

    case 'percent': {
      const entries: [string, number][] = members.map((m) => [
        m.id,
        readShare(values.percent[m.id], FULL_PERCENT),
      ])
      const assigned = entries.reduce((total, [, bp]) => total + bp, 0)

      let rows: ShareRow[] = []
      if (amount !== undefined) {
        // At exactly 100% use the same rule as saving, so what is shown is
        // what is stored. Before that, show plain rounded-down amounts.
        // Saving leaves out members at 0%, and who gets the extra paisa depends
        // on how many members take part, so leave them out here too.
        const exact =
          assigned === FULL_PERCENT
            ? splitByPercent(
                amount,
                entries.filter(([, bp]) => bp > 0),
                expenseId,
              )
            : undefined
        rows = entries.map(([memberId, bp]) => ({
          memberId,
          amount: exact?.[memberId] ?? Math.floor((amount * bp) / FULL_PERCENT),
        }))
      }
      return { type: 'percent', assigned, rows }
    }
  }
}

export interface SplitStatusText {
  text: string
  tone: 'pending' | 'ok' | 'over'
}

/** The running-total line under exact amounts and percentages. */
export function describeSplitStatus(preview: SplitPreview): SplitStatusText | undefined {
  switch (preview.type) {
    case 'equal':
      return undefined

    case 'exact': {
      const { remaining } = preview
      if (remaining === undefined) {
        return { text: 'Enter the amount to see what is left to assign', tone: 'pending' }
      }
      if (remaining === 0) return { text: 'Fully assigned', tone: 'ok' }
      return remaining > 0
        ? { text: `${formatINR(remaining)} left to assign`, tone: 'pending' }
        : { text: `${formatINR(-remaining)} over`, tone: 'over' }
    }

    case 'percent': {
      const { assigned } = preview
      const difference = FULL_PERCENT - assigned
      if (difference === 0) return { text: '100% assigned', tone: 'ok' }
      return difference > 0
        ? {
            text: `${formatPercent(assigned)}% assigned · ${formatPercent(difference)}% remaining`,
            tone: 'pending',
          }
        : {
            text: `${formatPercent(assigned)}% assigned · ${formatPercent(-difference)}% over`,
            tone: 'over',
          }
    }
  }
}
