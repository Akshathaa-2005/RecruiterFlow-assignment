import { describe, expect, it } from 'vitest'
import { suggestSettlements } from './settle'

describe('suggestSettlements', () => {
  it('has the biggest debtor pay the biggest creditor', () => {
    expect(
      suggestSettlements([
        { memberId: 'aarav', amount: 1610470 },
        { memberId: 'diya', amount: -614528 },
        { memberId: 'kabir', amount: 55408 },
        { memberId: 'meera', amount: -321350 },
        { memberId: 'rohan', amount: -730000 },
      ]),
    ).toEqual([
      { from: 'rohan', to: 'aarav', amount: 730000 },
      { from: 'diya', to: 'aarav', amount: 614528 },
      { from: 'meera', to: 'aarav', amount: 265942 },
      { from: 'meera', to: 'kabir', amount: 55408 },
    ])
  })

  it('needs no payments when everyone is settled', () => {
    expect(
      suggestSettlements([
        { memberId: 'a', amount: 0 },
        { memberId: 'b', amount: 0 },
      ]),
    ).toEqual([])
  })

  it('leaves everyone at exactly zero', () => {
    const balances = [
      { memberId: 'a', amount: 3334 },
      { memberId: 'b', amount: -3333 },
      { memberId: 'c', amount: -1 },
    ]
    const net = new Map(balances.map((b) => [b.memberId, b.amount]))
    for (const t of suggestSettlements(balances)) {
      net.set(t.from, (net.get(t.from) ?? 0) + t.amount)
      net.set(t.to, (net.get(t.to) ?? 0) - t.amount)
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true)
  })
})
