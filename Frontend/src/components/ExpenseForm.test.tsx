import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { sampleData } from '../store/sample'
import { ExpenseForm } from './ExpenseForm'

const today = '2026-06-15'

function setup() {
  const onSubmit = vi.fn()
  const onCancel = vi.fn()
  const user = userEvent.setup()
  render(
    <ExpenseForm
      members={sampleData.members}
      today={today}
      onAddMember={(name) => ({ id: 'new', name })}
      expenseId="test-expense"
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  )
  return { user, onSubmit, onCancel }
}

describe('ExpenseForm', () => {
  it('shows an error next to every broken field and saves nothing', async () => {
    const { user, onSubmit } = setup()

    await user.type(screen.getByLabelText('Amount (₹)'), '-20')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()

    const description = screen.getByLabelText('Description')
    expect(description).toBeInvalid()
    expect(description).toHaveAccessibleDescription('Description is required')

    expect(screen.getByLabelText('Amount (₹)')).toHaveAccessibleDescription(
      'Amount must be more than ₹0',
    )
    expect(screen.getByLabelText('Paid by')).toHaveAccessibleDescription(
      'Select who paid',
    )
    expect(screen.getByLabelText('Category')).toHaveAccessibleDescription(
      'Select a category',
    )
    // Date is pre-filled with today, so it is fine.
    expect(screen.getByLabelText('Date')).toBeValid()
    // First broken field gets keyboard focus.
    expect(description).toHaveFocus()
  })

  it("shows a field's error as soon as you leave it, and only that field's", async () => {
    const { user } = setup()

    await user.click(screen.getByLabelText('Description'))
    expect(screen.queryByText('Description is required')).not.toBeInTheDocument()

    await user.tab()
    expect(screen.getByText('Description is required')).toBeInTheDocument()
    expect(screen.queryByText('Amount is required')).not.toBeInTheDocument()
  })

  it('clears an error once the field is fixed', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Description is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Description'), 'Taxi')
    expect(screen.queryByText('Description is required')).not.toBeInTheDocument()
  })

  it('rejects a date in the future', async () => {
    const { user, onSubmit } = setup()
    const date = screen.getByLabelText('Date')
    await user.clear(date)
    await user.type(date, '2026-06-16')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(date).toHaveAccessibleDescription('Date cannot be in the future')
  })

  it('saves a valid equal split with the amount in paise', async () => {
    const { user, onSubmit } = setup()

    await user.type(screen.getByLabelText('Description'), 'Airport cab')
    await user.type(screen.getByLabelText('Amount (₹)'), '1250.50')
    await user.selectOptions(screen.getByLabelText('Paid by'), 'Diya')
    await user.selectOptions(screen.getByLabelText('Category'), 'Travel')
    await user.click(screen.getByRole('checkbox', { name: 'Rohan' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      description: 'Airport cab',
      amount: 125_050,
      paidBy: 'm2',
      date: today,
      category: 'Travel',
      split: { type: 'equal', memberIds: ['m1', 'm2', 'm3', 'm4'] },
    })
  })

  it('requires at least one member for an equal split', async () => {
    const { user, onSubmit } = setup()
    for (const member of sampleData.members) {
      await user.click(screen.getByRole('checkbox', { name: member.name }))
    }
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Select at least one member')).toBeInTheDocument()
  })

  it('shows how much is left to assign for exact amounts, then saves once it matches', async () => {
    const { user, onSubmit } = setup()

    await user.type(screen.getByLabelText('Description'), 'Scuba')
    await user.type(screen.getByLabelText('Amount (₹)'), '100')
    await user.selectOptions(screen.getByLabelText('Paid by'), 'Kabir')
    await user.selectOptions(screen.getByLabelText('Category'), 'Activities')
    await user.click(screen.getByRole('radio', { name: 'Exact amounts' }))

    await user.type(screen.getByLabelText('Kabir (₹)'), '50')
    await user.type(screen.getByLabelText('Meera (₹)'), '37.50')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('₹12.50 left to assign')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Rohan (₹)'), '12.50')
    expect(screen.queryByText(/left to assign/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10_000,
        split: { type: 'exact', shares: { m3: 5000, m4: 3750, m5: 1250 } },
      }),
    )
  })

  it('puts a per-member error next to a bad percentage', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    await user.type(screen.getByLabelText('Aarav (%)'), '150')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Aarav (%)')).toHaveAccessibleDescription(
      'Must be between 0 and 100',
    )
  })

  it('calls onCancel without saving', async () => {
    const { user, onSubmit, onCancel } = setup()
    await user.type(screen.getByLabelText('Description'), 'Something')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('has a visible label for every input', () => {
    setup()
    const form = screen.getByRole('button', { name: 'Save' }).closest('form')
    if (!form) throw new Error('form not found')
    for (const input of within(form).getAllByRole('textbox')) {
      expect(input).toHaveAccessibleName()
    }
  })

  describe('live breakdown', () => {
    it('shows each equal share, with the extra paisa going to one of them', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('checkbox', { name: 'Meera' }))
      await user.click(screen.getByRole('checkbox', { name: 'Rohan' }))
      expect(screen.getByText(/Enter an amount and pick members/)).toBeInTheDocument()

      await user.type(screen.getByLabelText('Amount (₹)'), '100')

      const list = screen.getByRole('list', { name: "Each person's share" })
      const rows = within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
      expect(
        rows
          .slice(0, 3)
          .map((row) => row.slice(-6))
          .sort(),
      ).toEqual(['₹33.33', '₹33.33', '₹33.34'])
      expect(rows[3]).toBe('Total₹100.00')
    })

    it('updates when members are deselected', async () => {
      const { user } = setup()
      await user.type(screen.getByLabelText('Amount (₹)'), '90')
      await user.click(screen.getByRole('checkbox', { name: 'Rohan' }))
      await user.click(screen.getByRole('checkbox', { name: 'Meera' }))
      await user.click(screen.getByRole('checkbox', { name: 'Kabir' }))

      const list = screen.getByRole('list', { name: "Each person's share" })
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(['Aarav₹45.00', 'Diya₹45.00', 'Total₹90.00'])
    })

    it('shows rupees under each percentage and a running total', async () => {
      const { user } = setup()
      await user.type(screen.getByLabelText('Amount (₹)'), '200')
      await user.click(screen.getByRole('radio', { name: 'Percentages' }))
      await user.type(screen.getByLabelText('Aarav (%)'), '50')
      await user.type(screen.getByLabelText('Diya (%)'), '25')

      expect(screen.getByLabelText('Aarav (%)')).toHaveAccessibleDescription('= ₹100.00')
      expect(screen.getByLabelText('Diya (%)')).toHaveAccessibleDescription('= ₹50.00')
      expect(screen.getByRole('status')).toHaveTextContent('75% assigned · 25% remaining')

      await user.type(screen.getByLabelText('Kabir (%)'), '25')
      expect(screen.getByRole('status')).toHaveTextContent('100% assigned')
    })

    it('shows the exact-amount counter and flips to over', async () => {
      const { user } = setup()
      await user.type(screen.getByLabelText('Amount (₹)'), '100')
      await user.click(screen.getByRole('radio', { name: 'Exact amounts' }))
      expect(screen.getByRole('status')).toHaveTextContent('₹100.00 left to assign')

      await user.type(screen.getByLabelText('Aarav (₹)'), '87.50')
      expect(screen.getByRole('status')).toHaveTextContent('₹12.50 left to assign')

      await user.type(screen.getByLabelText('Diya (₹)'), '20')
      expect(screen.getByRole('status')).toHaveTextContent('₹7.50 over')
    })
  })
})
