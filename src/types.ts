export interface Member {
  id: string
  name: string
}

export const CATEGORIES = [
  'Food',
  'Travel',
  'Stay',
  'Activities',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

export const SPLIT_TYPES = ['equal', 'exact', 'percent'] as const

export type SplitType = (typeof SPLIT_TYPES)[number]

export interface EqualSplit {
  type: 'equal'
  memberIds: string[]
}

export interface ExactSplit {
  type: 'exact'
  /** paise per member id */
  shares: Record<string, number>
}

export interface PercentSplit {
  type: 'percent'
  /** percent per member id, up to 2 decimals */
  shares: Record<string, number>
}

export type Split = EqualSplit | ExactSplit | PercentSplit

export interface Expense {
  id: string
  description: string
  /** paise: ₹1,250.50 is 125050 */
  amount: number
  paidBy: string
  /** YYYY-MM-DD */
  date: string
  category: Category
  split: Split
}

export type NewExpense = Omit<Expense, 'id'>

export interface TripData {
  members: Member[]
  expenses: Expense[]
}

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((category) => category === value)
}
