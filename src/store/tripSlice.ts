import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type { Expense, Member, NewExpense, TripData } from '../types'

// Real state is always supplied by makeStore; this is only a typed placeholder.
const initialState: TripData = { members: [], expenses: [] }

const tripSlice = createSlice({
  name: 'trip',
  initialState,
  reducers: {
    expenseAdded: {
      reducer(state, action: PayloadAction<Expense>) {
        state.expenses.push(action.payload)
      },
      prepare(expense: NewExpense) {
        return { payload: { ...expense, id: nanoid() } }
      },
    },
    memberAdded(state, action: PayloadAction<Member>) {
      state.members.push(action.payload)
    },
    memberRemoved(state, action: PayloadAction<Member>) {
      const id = action.payload.id
      const inUse = state.expenses.some(
        (e) =>
          e.paidBy === id ||
          (e.split.type === 'equal' ? e.split.memberIds.includes(id) : id in e.split.shares),
      )
      // Removing someone who is in an expense would corrupt it, and the trip
      // always keeps at least one member.
      if (inUse || state.members.length <= 1) return
      state.members = state.members.filter((m) => m.id !== id)
    },
    expenseDeleted(state, action: PayloadAction<string>) {
      state.expenses = state.expenses.filter((e) => e.id !== action.payload)
    },
  },
})

export const { expenseAdded, expenseDeleted, memberAdded, memberRemoved } = tripSlice.actions
export default tripSlice.reducer
