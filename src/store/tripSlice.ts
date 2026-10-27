import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type { Expense, NewExpense, TripData } from '../types'

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
    expenseDeleted(state, action: PayloadAction<string>) {
      state.expenses = state.expenses.filter((e) => e.id !== action.payload)
    },
  },
})

export const { expenseAdded, expenseDeleted } = tripSlice.actions
export default tripSlice.reducer
