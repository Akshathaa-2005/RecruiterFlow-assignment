import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { ExpenseFormValues } from '../logic/validation'
import { expenseAdded } from './tripSlice'

interface DraftState {
  values: ExpenseFormValues | null
}

const initialState: DraftState = { values: null }

/**
 * The Add expense form as typed so far, so it survives navigating to another
 * page and back. In memory only: a page reload starts a fresh form.
 */
const draftSlice = createSlice({
  name: 'draft',
  initialState,
  reducers: {
    draftChanged(state, action: PayloadAction<ExpenseFormValues>) {
      state.values = action.payload
    },
    draftCleared(state) {
      state.values = null
    },
  },
  extraReducers: (builder) => {
    builder.addCase(expenseAdded, (state) => {
      state.values = null
    })
  },
})

export const { draftChanged, draftCleared } = draftSlice.actions
export default draftSlice.reducer
