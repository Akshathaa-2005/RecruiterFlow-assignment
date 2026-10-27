import { describe, expect, it } from 'vitest'
import { formatINR, formatPercent, parseDecimal } from './money'

describe('formatINR', () => {
  it('uses Indian digit grouping with two decimals', () => {
    expect(formatINR(100_000_000)).toBe('₹10,00,000.00')
    expect(formatINR(10_000_000)).toBe('₹1,00,000.00')
    expect(formatINR(125_050)).toBe('₹1,250.50')
    expect(formatINR(5)).toBe('₹0.05')
    expect(formatINR(0)).toBe('₹0.00')
  })

  it('keeps the sign for negatives', () => {
    expect(formatINR(-125_050)).toBe('-₹1,250.50')
  })
})

describe('formatPercent', () => {
  it('drops trailing zeros', () => {
    expect(formatPercent(3333)).toBe('33.33')
    expect(formatPercent(5000)).toBe('50')
    expect(formatPercent(1250)).toBe('12.5')
  })
})

describe('parseDecimal', () => {
  it('parses to integer hundredths without floating point error', () => {
    expect(parseDecimal('1250.50')).toEqual({ kind: 'ok', value: 125_050 })
    expect(parseDecimal('0.29')).toEqual({ kind: 'ok', value: 29 })
    expect(parseDecimal('19.9')).toEqual({ kind: 'ok', value: 1990 })
    expect(parseDecimal(' 7 ')).toEqual({ kind: 'ok', value: 700 })
    expect(parseDecimal('.5')).toEqual({ kind: 'ok', value: 50 })
  })

  it('parses negatives', () => {
    expect(parseDecimal('-5')).toEqual({ kind: 'ok', value: -500 })
    expect(parseDecimal('-0')).toEqual({ kind: 'ok', value: 0 })
  })

  it('rejects bad input', () => {
    expect(parseDecimal('')).toEqual({ kind: 'empty' })
    expect(parseDecimal('   ')).toEqual({ kind: 'empty' })
    expect(parseDecimal('abc')).toEqual({ kind: 'invalid' })
    expect(parseDecimal('1,000')).toEqual({ kind: 'invalid' })
    expect(parseDecimal('1.2.3')).toEqual({ kind: 'invalid' })
    expect(parseDecimal('.')).toEqual({ kind: 'invalid' })
    expect(parseDecimal('1.234')).toEqual({ kind: 'too-many-decimals' })
    expect(parseDecimal('9999999999999')).toEqual({ kind: 'too-large' })
  })
})
