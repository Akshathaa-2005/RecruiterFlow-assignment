import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo-128.png'
import { BalanceList } from '../components/BalanceList'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Insights } from '../components/Insights'
import { ExpenseTable } from '../components/ExpenseTable'
import { SettleUp } from '../components/SettleUp'
import {
  computeBalances,
  filterByCategory,
  sortExpenses,
  totalAmount,
  type CategoryFilter,
} from '../logic/balances'
import { countExpensesInvolving } from '../logic/members'
import { formatINR } from '../logic/money'
import { suggestSettlements } from '../logic/settle'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { noticeDismissed } from '../store/noticeSlice'
import { expenseDeleted, memberRemoved } from '../store/tripSlice'
import { CATEGORIES, isCategory, type Expense, type Member } from '../types'

export function ExpensesPage() {
  const members = useAppSelector((state) => state.trip.members)
  const expenses = useAppSelector((state) => state.trip.expenses)
  const notice = useAppSelector((state) => state.notice.message)
  const dispatch = useAppDispatch()

  const [filter, setFilter] = useState<CategoryFilter>('All')
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null)

  const balances = useMemo(() => computeBalances(members, expenses), [members, expenses])
  const shown = useMemo(
    () => filterByCategory(sortExpenses(expenses), filter),
    [expenses, filter],
  )

  const transfers = useMemo(() => suggestSettlements(balances), [balances])

  const usage = useMemo(
    () => new Map(members.map((m) => [m.id, countExpensesInvolving(m.id, expenses)])),
    [members, expenses],
  )

  function handleFilterChange(value: string) {
    setFilter(isCategory(value) ? value : 'All')
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Expenses</h1>
          <p className="subtitle">Who paid, who owes, and where everyone stands.</p>
        </div>
        <Link to="/expenses/new" className="button primary">
          <span aria-hidden="true">+</span> New expense
        </Link>
      </div>

      <section className="hero" aria-label="Trip summary">
        <div className="hero-stat hero-main">
          <span className="hero-label">Total spent</span>
          <span className="hero-value">{formatINR(totalAmount(expenses))}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-label">Expenses</span>
          <span className="hero-value">{expenses.length}</span>
        </div>
        <div className="hero-stat">
          <span className="hero-label">Members</span>
          <span className="hero-value">{members.length}</span>
        </div>
      </section>

      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="link"
            onClick={() => {
              dispatch(noticeDismissed())
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <BalanceList
        members={members}
        balances={balances}
        usage={usage}
        onRemove={setPendingRemove}
      />

      {expenses.length > 0 && <SettleUp members={members} transfers={transfers} />}

      {expenses.length > 0 && <Insights members={members} expenses={expenses} />}

      <section aria-labelledby="list-heading">
        <div className="list-header">
          <h2 id="list-heading">All expenses</h2>
          <div className="filter">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              value={filter}
              onChange={(e) => {
                handleFilterChange(e.target.value)
              }}
            >
              <option value="All">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {expenses.length === 0 ? (
          <div className="empty">
            <img src={logo} alt="" width="72" height="72" />
            <p>No expenses yet.</p>
            <Link to="/expenses/new">Add the first expense</Link>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty">
            <p>No {filter} expenses.</p>
            <button
              type="button"
              className="link"
              onClick={() => {
                setFilter('All')
              }}
            >
              Show all categories
            </button>
          </div>
        ) : (
          <ExpenseTable
            expenses={shown}
            members={members}
            onDelete={setPendingDelete}
          />
        )}

        <p className="total">
          Total shown: <strong>{formatINR(totalAmount(shown))}</strong>
        </p>
      </section>

      {pendingRemove && (
        <ConfirmDialog
          title="Remove member?"
          message={`${pendingRemove.name} will be removed from the trip. They are not part of any expense.`}
          confirmLabel="Remove"
          onCancel={() => {
            setPendingRemove(null)
          }}
          onConfirm={() => {
            dispatch(memberRemoved(pendingRemove))
            setPendingRemove(null)
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete expense?"
          message={`“${pendingDelete.description}” (${formatINR(pendingDelete.amount)}) will be removed and balances will be recalculated.`}
          confirmLabel="Delete"
          onCancel={() => {
            setPendingDelete(null)
          }}
          onConfirm={() => {
            dispatch(expenseDeleted(pendingDelete.id))
            setPendingDelete(null)
          }}
        />
      )}
    </>
  )
}
