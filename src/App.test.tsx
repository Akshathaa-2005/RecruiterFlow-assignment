import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { makeStore } from './store/store'

function renderApp(route = '/') {
  const store = makeStore({ storage: localStorage })
  const user = userEvent.setup()
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </Provider>,
  )
  return { user, store }
}

const balanceOf = (name: string) => {
  const item = screen
    .getAllByRole('listitem')
    .find((li) => li.classList.contains('balance') && within(li).queryByText(name))
  if (!item) throw new Error(`no balance for ${name}`)
  // name + status badge, without the decorative avatar initial
  return `${item.querySelector('.balance-name')?.textContent ?? ''}${item.querySelector('.badge')?.textContent ?? ''}`
}

describe('navigation', () => {
  it('marks the current page in the navbar', () => {
    renderApp('/expenses/new')
    expect(screen.getByRole('link', { name: 'Add expense' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Expenses' })).not.toHaveAttribute('aria-current')
  })

  it('shows Page not found with a link back for unknown URLs', () => {
    renderApp('/nope/at/all')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Expenses' })).toHaveAttribute('href', '/')
  })
})

describe('Expenses page', () => {
  it('shows balances and the table, newest date first', () => {
    renderApp()
    expect(balanceOf('Aarav')).toBe('Aaravgets back ₹18,554.20')
    expect(balanceOf('Diya')).toBe('Diyaowes ₹3,695.78')

    const [, first, , , , , last] = screen.getAllByRole('row')
    if (!first || !last) throw new Error('expected 6 expense rows')
    expect(screen.getAllByRole('row')).toHaveLength(7) // header + 6
    expect(within(first).getByText('Airport cab')).toBeInTheDocument()
    expect(within(first).getByText('₹1,499.99')).toBeInTheDocument()
    expect(within(last).getByText('Villa booking')).toBeInTheDocument()
    expect(within(last).getByText('Equally, 5 people')).toBeInTheDocument()
  })

  it('filters by category and totals what is shown', async () => {
    const { user } = renderApp()
    expect(screen.getByText('Total shown:').textContent).toBe('Total shown: ₹42,249.99')

    await user.selectOptions(screen.getByLabelText('Category'), 'Food')
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + 2
    expect(screen.getByText('Total shown:').textContent).toBe('Total shown: ₹4,250.00')

    await user.selectOptions(screen.getByLabelText('Category'), 'Other')
    expect(screen.getByText('No Other expenses.')).toBeInTheDocument()
    expect(screen.getByText('Total shown:').textContent).toBe('Total shown: ₹0.00')

    await user.click(screen.getByRole('button', { name: 'Show all categories' }))
    expect(screen.getAllByRole('row')).toHaveLength(7)
  })

  it('asks before deleting, then updates balances straight away', async () => {
    const { user } = renderApp()

    await user.click(screen.getByRole('button', { name: 'Delete Villa booking' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('Villa booking')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Villa booking' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    expect(screen.queryByText('Villa booking')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Expense was deleted.')
    // Aarav paid the villa: 18,554.20 - (24,000 - 4,800 share) = -645.80
    expect(balanceOf('Aarav')).toBe('Aaravowes ₹645.80')
  })

  it('shows an empty state when there are no expenses', async () => {
    const { user } = renderApp()
    for (const name of [
      'Airport cab',
      'Groceries',
      'Scooter rental',
      'Scuba diving',
      'Beach shack dinner',
      'Villa booking',
    ]) {
      await user.click(screen.getByRole('button', { name: `Delete ${name}` }))
      await user.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
      )
    }
    expect(screen.getByText('No expenses yet.')).toBeInTheDocument()
    expect(screen.getAllByText('settled up')).toHaveLength(5)
  })
})

describe('adding an expense', () => {
  it('saves, returns to Expenses with a message, and updates balances', async () => {
    const { user, store } = renderApp('/expenses/new')

    await user.type(screen.getByLabelText('Description'), 'Beach chairs')
    await user.type(screen.getByLabelText('Amount (₹)'), '100')
    await user.selectOptions(screen.getByLabelText('Paid by'), 'Aarav')
    await user.selectOptions(screen.getByLabelText('Category'), 'Other')
    await user.click(screen.getByRole('checkbox', { name: 'Meera' }))
    await user.click(screen.getByRole('checkbox', { name: 'Rohan' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Beach chairs')
    expect(screen.getByRole('status')).toHaveTextContent('was added')
    expect(screen.getByText('Beach chairs')).toBeInTheDocument()
    expect(store.getState().trip.expenses).toHaveLength(7)
    // ₹100 between 3: Aarav pays 100, owes 33.34 -> +66.66 on top of 18,554.20
    expect(balanceOf('Aarav')).toBe('Aaravgets back ₹18,620.86')
  })

  it('keeps what was typed when you visit another page and come back', async () => {
    const { user } = renderApp('/expenses/new')
    await user.type(screen.getByLabelText('Description'), 'Half typed')
    await user.type(screen.getByLabelText('Amount (₹)'), '450')
    await user.selectOptions(screen.getByLabelText('Paid by'), 'Meera')
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    await user.type(screen.getByLabelText('Aarav (%)'), '40')

    await user.click(screen.getByRole('link', { name: 'Expenses' }))
    expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Add expense' }))

    expect(screen.getByLabelText('Description')).toHaveValue('Half typed')
    expect(screen.getByLabelText('Amount (₹)')).toHaveValue('450')
    expect(screen.getByLabelText('Paid by')).toHaveValue('m4')
    expect(screen.getByRole('radio', { name: 'Percentages' })).toBeChecked()
    expect(screen.getByLabelText('Aarav (%)')).toHaveValue('40')
  })

  it('starts a fresh form after Cancel', async () => {
    const { user } = renderApp('/expenses/new')
    await user.type(screen.getByLabelText('Description'), 'Discard me')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('link', { name: 'Add expense' }))
    expect(screen.getByLabelText('Description')).toHaveValue('')
  })

  it('goes back without saving on Cancel', async () => {
    const { user, store } = renderApp('/expenses/new')
    await user.type(screen.getByLabelText('Description'), 'Never saved')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(store.getState().trip.expenses).toHaveLength(6)
  })
})

describe('Insights charts', () => {
  it('shows spending by category with amounts and shares', () => {
    renderApp()
    const card = screen.getByRole('article', { name: 'Spending by category' })
    const rows = within(card).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows).toEqual([
      'Food₹4,250.0010.1%',
      'Travel₹3,499.998.3%',
      'Stay₹24,000.0056.8%',
      'Activities₹10,500.0024.9%',
    ])
    expect(within(card).getByRole('img')).toHaveAccessibleName(/Stay ₹24,000.00/)
  })

  it('compares what each person paid with their share', () => {
    renderApp()
    const card = screen.getByRole('article', { name: 'Paid vs. share, per person' })
    const aarav = within(card).getByText('Aarav').closest('li')
    if (!aarav) throw new Error('row not found')
    expect(aarav).toHaveTextContent('Paid: ₹25,499.99')
    expect(aarav).toHaveTextContent('Share: ₹6,945.79')
  })

  it('shows spending per month', () => {
    renderApp()
    const card = screen.getByRole('article', { name: 'Spending by month' })
    const months = within(card)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(months).toEqual(['Mar 2026₹42,249.99'])
  })

  it('hides the charts when there are no expenses', async () => {
    const { user } = renderApp()
    for (const name of [
      'Airport cab',
      'Groceries',
      'Scooter rental',
      'Scuba diving',
      'Beach shack dinner',
      'Villa booking',
    ]) {
      await user.click(screen.getByRole('button', { name: `Delete ${name}` }))
      await user.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
      )
    }
    expect(screen.queryByRole('heading', { name: 'Insights' })).not.toBeInTheDocument()
  })
})
