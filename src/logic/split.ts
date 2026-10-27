import type { Expense, Member, Split } from '../types'

/** Basis points: 100.00% is 10000. */
export const FULL_PERCENT = 10_000

export type Shares = Record<string, number>

/**
 * Splits `amount` paise between `memberIds` as evenly as possible.
 * Rule used everywhere: the leftover paise go one each to the first members
 * in the order given (callers pass trip-member order), so ₹100 between 3 is
 * 33.34 + 33.33 + 33.33.
 */
export function splitEqually(amount: number, memberIds: string[]): Shares {
  const shares: Shares = {}
  const count = memberIds.length
  if (count === 0) return shares

  const base = Math.floor(amount / count)
  const extra = amount - base * count
  memberIds.forEach((id, index) => {
    shares[id] = base + (index < extra ? 1 : 0)
  })
  return shares
}

/**
 * Splits `amount` paise by percentages given in basis points, using the
 * largest-remainder method so the shares add up to `amount` exactly. Ties go
 * to the earlier member, which matches the equal-split rule.
 */
export function splitByPercent(
  amount: number,
  basisPoints: [id: string, basisPoints: number][],
): Shares {
  const parts = basisPoints.map(([id, bp], index) => {
    const product = amount * bp
    const remainder = product % FULL_PERCENT
    return {
      id,
      index,
      floor: (product - remainder) / FULL_PERCENT,
      remainder,
    }
  })

  const leftover = amount - parts.reduce((sum, part) => sum + part.floor, 0)
  const byRemainder = [...parts].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  )
  const bonus = new Set(byRemainder.slice(0, leftover).map((part) => part.id))

  const shares: Shares = {}
  for (const part of parts) {
    shares[part.id] = part.floor + (bonus.has(part.id) ? 1 : 0)
  }
  return shares
}

/** "33.33" (as stored in the data) -> 3333 basis points. */
export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100)
}

/**
 * How many paise each member owes for one expense. Members are visited in
 * trip order so results never depend on key order in the saved data.
 */
export function computeShares(
  expense: Pick<Expense, 'amount' | 'split'>,
  members: Member[],
): Shares {
  const { amount, split } = expense

  switch (split.type) {
    case 'equal': {
      const included = new Set(split.memberIds)
      const ids = members.map((m) => m.id).filter((id) => included.has(id))
      return splitEqually(amount, ids)
    }
    case 'exact': {
      const shares: Shares = {}
      for (const { id } of members) {
        const share = split.shares[id]
        if (share !== undefined) shares[id] = share
      }
      return shares
    }
    case 'percent': {
      const entries: [string, number][] = []
      for (const { id } of members) {
        const percent = split.shares[id]
        if (percent !== undefined) {
          entries.push([id, percentToBasisPoints(percent)])
        }
      }
      return splitByPercent(amount, entries)
    }
  }
}

/** Number of members taking part in the split, for display. */
export function splitParticipantCount(split: Split): number {
  return split.type === 'equal'
    ? split.memberIds.length
    : Object.keys(split.shares).length
}

/** "Equally, 4 people", "Exact amounts, 3 people", "Percentages, 1 person" */
export function describeSplit(split: Split): string {
  const count = splitParticipantCount(split)
  const people = `${count} ${count === 1 ? 'person' : 'people'}`
  switch (split.type) {
    case 'equal':
      return `Equally, ${people}`
    case 'exact':
      return `Exact amounts, ${people}`
    case 'percent':
      return `Percentages, ${people}`
  }
}
