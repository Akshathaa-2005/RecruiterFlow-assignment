import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExpenseForm } from '../components/ExpenseForm'
import { todayISO } from '../logic/date'
import type { ExpenseFormValues } from '../logic/validation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { draftChanged, draftCleared } from '../store/draftSlice'
import { noticeDismissed } from '../store/noticeSlice'
import { expenseAdded } from '../store/tripSlice'
import type { NewExpense } from '../types'

export function AddExpensePage() {
  const members = useAppSelector((state) => state.trip.members)
  const draft = useAppSelector((state) => state.draft.values)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // Starting a new expense: the previous confirmation is no longer relevant.
  useEffect(() => {
    dispatch(noticeDismissed())
  }, [dispatch])

  const handleValuesChange = useCallback(
    (values: ExpenseFormValues) => {
      dispatch(draftChanged(values))
    },
    [dispatch],
  )

  function handleSubmit(expense: NewExpense) {
    dispatch(expenseAdded(expense))
    void navigate('/')
  }

  return (
    <section aria-labelledby="add-heading">
      <div className="page-header centered">
        <h1 id="add-heading">Add expense</h1>
        <p className="subtitle">Record a shared cost and choose how it is split.</p>
      </div>
      <ExpenseForm
        members={members}
        today={todayISO()}
        initialValues={draft ?? undefined}
        onValuesChange={handleValuesChange}
        onSubmit={handleSubmit}
        onCancel={() => {
          dispatch(draftCleared())
          void navigate('/')
        }}
      />
    </section>
  )
}
