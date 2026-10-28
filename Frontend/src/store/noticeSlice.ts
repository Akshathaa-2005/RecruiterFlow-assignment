import { createSlice } from '@reduxjs/toolkit'
import { expenseAdded, expenseDeleted, expenseUpdated, memberRemoved } from './tripSlice'

interface NoticeState {
  message: string | null
}

const initialState: NoticeState = { message: null }

/** The one-line confirmation shown on the Expenses page. */
const noticeSlice = createSlice({
  name: 'notice',
  initialState,
  reducers: {
    noticeDismissed(state) {
      state.message = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(expenseAdded, (state, action) => {
        state.message = `Expense “${action.payload.description}” was added.`
      })
      .addCase(expenseUpdated, (state, action) => {
        state.message = `Expense “${action.payload.description}” was updated.`
      })
      .addCase(expenseDeleted, (state) => {
        state.message = 'Expense was deleted.'
      })
      .addCase(memberRemoved, (state, action) => {
        state.message = `${action.payload.name} was removed from the trip.`
      })
  },
})

export const { noticeDismissed } = noticeSlice.actions
export default noticeSlice.reducer
