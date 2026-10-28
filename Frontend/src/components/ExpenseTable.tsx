import { formatDate } from '../logic/date'
import { formatINR } from '../logic/money'
import { Link } from 'react-router-dom'
import { describeSplitNames } from '../logic/split'
import type { Expense, Member } from '../types'

interface ExpenseTableProps {
  expenses: Expense[]
  members: Member[]
  onDelete: (expense: Expense) => void
}

/**
 * A real table on wide screens. Below the breakpoint the CSS turns each row
 * into a card; the data-label attributes provide the labels on those cards.
 */
export function ExpenseTable({ expenses, members, onDelete }: ExpenseTableProps) {
  const names = new Map(members.map((m) => [m.id, m.name]))

  return (
    <table className="expenses">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Description</th>
          <th scope="col">Category</th>
          <th scope="col">Paid by</th>
          <th scope="col" className="num">
            Amount
          </th>
          <th scope="col">Split</th>
          <th scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {expenses.map((expense) => {
          const split = describeSplitNames(expense.split, names)
          return (
            <tr key={expense.id}>
              <td className="c-date">{formatDate(expense.date)}</td>
              <td className="c-desc">{expense.description}</td>
              <td className="c-cat">
                <span className={`badge cat-${expense.category.toLowerCase()}`}>
                  {expense.category}
                </span>
              </td>
              <td className="c-paid" data-label="Paid by">
                {names.get(expense.paidBy) ?? expense.paidBy}
              </td>
              <td className="c-amount num">{formatINR(expense.amount)}</td>
              <td className="c-split" data-label="Split" title={split.full}>
                {split.text}
              </td>
              <td className="row-actions">
                <Link
                  to={`/expenses/${expense.id}/edit`}
                  className="edit-btn"
                  aria-label={`Edit ${expense.description}`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  className="delete-btn"
                  aria-label={`Delete ${expense.description}`}
                  onClick={() => {
                    onDelete(expense)
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
