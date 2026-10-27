import { createSlice } from '@reduxjs/toolkit'
import { expenseAdded, expenseDeleted } from './tripSlice'

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
      .addCase(expenseDeleted, (state) => {
        state.message = 'Expense was deleted.'
      })
  },
})

export const { noticeDismissed } = noticeSlice.actions
export default noticeSlice.reducer
