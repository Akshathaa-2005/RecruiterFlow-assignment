import { nanoid } from '@reduxjs/toolkit'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExpenseForm } from '../components/ExpenseForm'
import { todayISO } from '../logic/date'
import type { ExpenseFormValues } from '../logic/validation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { draftChanged, draftCleared } from '../store/draftSlice'
import { noticeDismissed } from '../store/noticeSlice'
import { expenseAdded } from '../store/tripSlice'
import { useAddMember } from '../store/useAddMember'
import type { NewExpense } from '../types'

export function AddExpensePage() {
  const members = useAppSelector((state) => state.trip.members)
  const draft = useAppSelector((state) => state.draft.values)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  // Chosen now, not at save time, so the live preview shows the same extra
  // paisa that gets saved.
  const [expenseId] = useState(() => nanoid())
  const handleAddMember = useAddMember()

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
    dispatch(expenseAdded(expense, expenseId))
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
        onAddMember={handleAddMember}
        expenseId={expenseId}
        onSubmit={handleSubmit}
        onCancel={() => {
          dispatch(draftCleared())
          void navigate('/')
        }}
      />
    </section>
  )
}
