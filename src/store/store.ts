import { configureStore } from '@reduxjs/toolkit'
import type { TripData } from '../types'
import draftReducer from './draftSlice'
import noticeReducer from './noticeSlice'
import { sampleData } from './sample'
import { loadExpenses, saveExpenses } from './storage'
import tripReducer from './tripSlice'

interface StoreOptions {
  /** Where expenses are saved; omit to keep everything in memory (tests). */
  storage?: Storage
  /** Replaces the sample data as the starting point. */
  initial?: TripData
}

/**
 * Persistence lives here, as a subscriber, so reducers stay pure and any
 * state change is saved without every component having to remember to.
 */
export function makeStore({ storage, initial = sampleData }: StoreOptions = {}) {
  const expenses = (storage && loadExpenses(storage, initial.members)) ?? initial.expenses

  const store = configureStore({
    reducer: { trip: tripReducer, notice: noticeReducer, draft: draftReducer },
    preloadedState: { trip: { members: initial.members, expenses } },
  })

  if (storage) {
    let saved = store.getState().trip.expenses
    store.subscribe(() => {
      const current = store.getState().trip.expenses
      if (current === saved) return
      saved = current
      saveExpenses(storage, current)
    })
  }

  return store
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
