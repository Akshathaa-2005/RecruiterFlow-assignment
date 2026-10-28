import { configureStore } from '@reduxjs/toolkit'
import type { TripData } from '../types'
import draftReducer from './draftSlice'
import noticeReducer from './noticeSlice'
import { sampleData } from './sample'
import { loadExpenses, loadMembers, saveExpenses, saveMembers } from './storage'
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
  const members = (storage && loadMembers(storage)) ?? initial.members
  const expenses = (storage && loadExpenses(storage, members)) ?? initial.expenses

  const store = configureStore({
    reducer: { trip: tripReducer, notice: noticeReducer, draft: draftReducer },
    preloadedState: { trip: { members, expenses } },
  })

  if (storage) {
    let savedExpenses = store.getState().trip.expenses
    let savedMembers = store.getState().trip.members
    store.subscribe(() => {
      const trip = store.getState().trip
      if (trip.members !== savedMembers) {
        savedMembers = trip.members
        saveMembers(storage, trip.members)
      }
      if (trip.expenses !== savedExpenses) {
        savedExpenses = trip.expenses
        saveExpenses(storage, trip.expenses)
      }
    })
  }

  return store
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
