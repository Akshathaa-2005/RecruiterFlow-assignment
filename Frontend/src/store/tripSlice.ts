import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { countExpensesInvolving } from '../logic/members'
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
      prepare(expense: NewExpense, id: string = nanoid()) {
        return { payload: { ...expense, id } }
      },
    },
    memberAdded(state, action: PayloadAction<Member>) {
      state.members.push(action.payload)
    },
    memberRemoved(state, action: PayloadAction<Member>) {
      const id = action.payload.id
      const inUse = countExpensesInvolving(id, state.expenses) > 0
      // Removing someone who is in an expense would corrupt it, and the trip
      // always keeps at least one member.
      if (inUse || state.members.length <= 1) return
      state.members = state.members.filter((m) => m.id !== id)
    },
    expenseUpdated(state, action: PayloadAction<Expense>) {
      const index = state.expenses.findIndex((e) => e.id === action.payload.id)
      if (index !== -1) state.expenses[index] = action.payload
    },
    expenseDeleted(state, action: PayloadAction<string>) {
      state.expenses = state.expenses.filter((e) => e.id !== action.payload)
    },
  },
})

export const {
  expenseAdded,
  expenseDeleted,
  expenseUpdated,
  memberAdded,
  memberRemoved,
} = tripSlice.actions
export default tripSlice.reducer
