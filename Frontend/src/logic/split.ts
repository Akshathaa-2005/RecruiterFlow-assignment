import type { Expense, Member, Split } from '../types'

/** Basis points: 100.00% is 10000. */
export const FULL_PERCENT = 10_000

export type Shares = Record<string, number>

/**
 * Where in the member list the leftover paise start, worked out from the
 * expense's id (`seed`). Ids are random but never change, so the same expense
 * always splits the same way (balances are recomputed on every render and the
 * form preview must match what gets saved), while different expenses start at
 * different people, so nobody is always the one who pays the extra paisa.
 * No seed means no rotation: the first member in trip order.
 */
function startOffset(seed: string, count: number): number {
  if (seed === '' || count === 0) return 0
  let hash = 2_166_136_261 // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16_777_619) >>> 0
  }
  return hash % count
}

/**
 * Splits `amount` paise between `memberIds` as evenly as possible. The
 * leftover paise go one each to consecutive members in the order given
 * (callers pass trip-member order), wrapping around, starting at a position
 * chosen by `seed`. With no seed that is the first member, so ₹100 between 3
 * is 33.34 + 33.33 + 33.33.
 */
export function splitEqually(amount: number, memberIds: string[], seed = ''): Shares {
  const shares: Shares = {}
  const count = memberIds.length
  if (count === 0) return shares

  const base = Math.floor(amount / count)
  const extra = amount - base * count
  const offset = startOffset(seed, count)
  memberIds.forEach((id, index) => {
    const turn = (index - offset + count) % count
    shares[id] = base + (turn < extra ? 1 : 0)
  })
  return shares
}

/**
 * Splits `amount` paise by percentages given in basis points, using the
 * largest-remainder method so the shares add up to `amount` exactly. Ties go
 * to the member earliest in the order starting at the `seed` position, which
 * matches the equal-split rule.
 */
export function splitByPercent(
  amount: number,
  basisPoints: [id: string, basisPoints: number][],
  seed = '',
): Shares {
  const count = basisPoints.length
  const offset = startOffset(seed, count)
  const parts = basisPoints.map(([id, bp], index) => {
    const product = amount * bp
    const remainder = product % FULL_PERCENT
    return {
      id,
      index: (index - offset + count) % count,
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
  expense: Pick<Expense, 'id' | 'amount' | 'split'>,
  members: Member[],
): Shares {
  const { amount, split } = expense
  const seed = expense.id

  switch (split.type) {
    case 'equal': {
      const included = new Set(split.memberIds)
      const ids = members.map((m) => m.id).filter((id) => included.has(id))
      return splitEqually(amount, ids, seed)
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
      return splitByPercent(amount, entries, seed)
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

const SPLIT_LABELS: Record<Split['type'], string> = {
  equal: 'Equally',
  exact: 'Exact amounts',
  percent: 'Percentages',
}

/**
 * "Equally: Aarav, Meera, Rohan" for the table. Shows at most `max` names and
 * summarises the rest as "+2"; `full` always lists everyone, for a tooltip.
 */
export function describeSplitNames(
  split: Split,
  names: Map<string, string>,
  max = 3,
): { text: string; full: string } {
  const ids = split.type === 'equal' ? split.memberIds : Object.keys(split.shares)
  const people = ids.map((id) => names.get(id) ?? id)
  const label = SPLIT_LABELS[split.type]
  const rest = people.length - max
  const shown =
    rest > 0 ? `${people.slice(0, max).join(', ')} +${rest}` : people.join(', ')
  return { text: `${label}: ${shown}`, full: `${label}: ${people.join(', ')}` }
}
