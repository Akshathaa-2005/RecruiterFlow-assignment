import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExpenseForm } from '../components/ExpenseForm'
import { todayISO } from '../logic/date'
import { expenseToFormValues } from '../logic/edit'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { expenseUpdated } from '../store/tripSlice'
import { useAddMember } from '../store/useAddMember'
import type { NewExpense } from '../types'

export function EditExpensePage() {
  const { id } = useParams()
  const members = useAppSelector((state) => state.trip.members)
  const expense = useAppSelector((state) => state.trip.expenses.find((e) => e.id === id))
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const handleAddMember = useAddMember()

  if (!expense) {
    return (
      <section className="empty-page">
        <h1>Expense not found</h1>
        <p className="subtitle">It may have been deleted.</p>
        <Link to="/" className="button primary">
          Back to Expenses
        </Link>
      </section>
    )
  }

  function handleSubmit(changes: NewExpense) {
    if (!expense) return
    dispatch(expenseUpdated({ ...changes, id: expense.id }))
    void navigate('/')
  }

  return (
    <section aria-labelledby="edit-heading">
      <div className="page-header centered">
        <h1 id="edit-heading">Edit expense</h1>
        <p className="subtitle">
          Change anything, then save. Balances update right away.
        </p>
      </div>
      <ExpenseForm
        key={expense.id}
        members={members}
        today={todayISO()}
        initialValues={expenseToFormValues(expense)}
        onAddMember={handleAddMember}
        expenseId={expense.id}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => {
          void navigate('/')
        }}
      />
    </section>
  )
}
