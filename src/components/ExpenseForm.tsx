import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { formatINR, MAX_AMOUNT } from '../logic/money'
import { describeSplitStatus, previewSplit } from '../logic/preview'
import {
  emptyErrors,
  MAX_DESCRIPTION_LENGTH,
  validateExpenseForm,
  type ExpenseFormValues,
} from '../logic/validation'
import { CATEGORIES, type Member, type NewExpense, type SplitType } from '../types'
import { Field, GroupMessage, fieldA11y } from './Field'

interface ExpenseFormProps {
  members: Member[]
  /** YYYY-MM-DD; the latest date that may be chosen */
  today: string
  /** Values to start from, e.g. a draft saved when the user left the page */
  initialValues?: ExpenseFormValues | undefined
  /** Called whenever the user changes something */
  onValuesChange?: ((values: ExpenseFormValues) => void) | undefined
  /** Saves a new member and returns it, so the form can select them. */
  onAddMember: (name: string) => Member
  onSubmit: (expense: NewExpense) => void
  onCancel: () => void
}

const MAX_MEMBER_NAME_LENGTH = 30
/** Choosing this in the Paid by list opens the new-member box. */
const ADD_MEMBER_OPTION = '__add_member__'
const AMOUNT_HINT = `Up to ${formatINR(MAX_AMOUNT)}, with at most 2 decimals`

const SPLIT_OPTIONS: { type: SplitType; label: string }[] = [
  { type: 'equal', label: 'Equally' },
  { type: 'exact', label: 'Exact amounts' },
  { type: 'percent', label: 'Percentages' },
]

function blankValues(members: Member[], today: string): ExpenseFormValues {
  return {
    description: '',
    amount: '',
    paidBy: '',
    date: today,
    category: '',
    splitType: 'equal',
    equalMemberIds: members.map((m) => m.id),
    exact: {},
    percent: {},
  }
}

export function ExpenseForm({
  members,
  today,
  initialValues,
  onValuesChange,
  onAddMember,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const [values, setValues] = useState(() => initialValues ?? blankValues(members, today))
  const untouched = useRef(values)
  const [attempts, setAttempts] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const [addingMember, setAddingMember] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNameError, setNewNameError] = useState<string>()

  // Errors only appear after the first Save, then follow the input live.
  const result = validateExpenseForm(values, members, today)
  const errors = attempts > 0 && !result.ok ? result.errors : emptyErrors()

  // Live breakdown, shown from the first keystroke.
  const preview = previewSplit(values, members)
  const status = describeSplitStatus(preview)
  const names = new Map(members.map((m) => [m.id, m.name]))

  useEffect(() => {
    if (values !== untouched.current) onValuesChange?.(values)
  }, [values, onValuesChange])

  // After a failed Save, move focus to the first field that needs attention.
  useEffect(() => {
    if (attempts === 0) return
    formRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')
      ?.focus()
  }, [attempts])

  function update<K extends keyof ExpenseFormValues>(
    key: K,
    value: ExpenseFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function updateShare(key: 'exact' | 'percent', memberId: string, value: string) {
    setValues((current) => ({
      ...current,
      [key]: { ...current[key], [memberId]: value },
    }))
  }

  function toggleMember(memberId: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      equalMemberIds: checked
        ? [...current.equalMemberIds, memberId]
        : current.equalMemberIds.filter((id) => id !== memberId),
    }))
  }

  function addMember() {
    const name = newName.trim()
    if (name === '') {
      setNewNameError('Enter a name')
      return
    }
    if (name.length > MAX_MEMBER_NAME_LENGTH) {
      setNewNameError(`Name must be at most ${MAX_MEMBER_NAME_LENGTH} characters`)
      return
    }
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      setNewNameError('A member with this name already exists')
      return
    }
    const member = onAddMember(name)
    setValues((current) => ({
      ...current,
      paidBy: member.id,
      equalMemberIds: [...current.equalMemberIds, member.id],
    }))
    setNewName('')
    setNewNameError(undefined)
    setAddingMember(false)
  }

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault()
    if (result.ok) {
      onSubmit(result.expense)
    } else {
      setAttempts((count) => count + 1)
    }
  }

  const splitHasError = errors.split !== undefined
  const groupProps = {
    'data-invalid': splitHasError ? true : undefined,
    tabIndex: splitHasError ? -1 : undefined,
    'aria-describedby': splitHasError ? 'split-error' : undefined,
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="form">
      <Field
        id="description"
        label="Description"
        error={errors.description}
        hint={`Up to ${MAX_DESCRIPTION_LENGTH} characters`}
      >
        <input
          {...fieldA11y(
            'description',
            errors.description,
            `Up to ${MAX_DESCRIPTION_LENGTH} characters`,
          )}
          type="text"
          value={values.description}
          onChange={(e) => {
            update('description', e.target.value)
          }}
        />
      </Field>

      <div className="field-row">
        <Field id="amount" label="Amount (₹)" error={errors.amount} hint={AMOUNT_HINT}>
          <input
            {...fieldA11y('amount', errors.amount, AMOUNT_HINT)}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={values.amount}
            onChange={(e) => {
              update('amount', e.target.value)
            }}
          />
        </Field>

        <Field id="date" label="Date" error={errors.date}>
          <input
            {...fieldA11y('date', errors.date)}
            type="date"
            max={today}
            value={values.date}
            onChange={(e) => {
              update('date', e.target.value)
            }}
          />
        </Field>
      </div>

      <div className="field-row">
        <Field id="paidBy" label="Paid by" error={errors.paidBy}>
          <select
            {...fieldA11y('paidBy', errors.paidBy)}
            value={addingMember ? ADD_MEMBER_OPTION : values.paidBy}
            onChange={(e) => {
              if (e.target.value === ADD_MEMBER_OPTION) {
                setAddingMember(true)
              } else {
                setAddingMember(false)
                update('paidBy', e.target.value)
              }
            }}
          >
            <option value="">Select a member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value={ADD_MEMBER_OPTION}>+ Add new member…</option>
          </select>
        </Field>

        <Field id="category" label="Category" error={errors.category}>
          <select
            {...fieldA11y('category', errors.category)}
            value={values.category}
            onChange={(e) => {
              update('category', e.target.value)
            }}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {addingMember && (
        <div className="add-member">
          <div className="add-member-row">
            <input
              type="text"
              aria-label="New member name"
              placeholder="New member name"
              value={newName}
              autoFocus
              onChange={(e) => {
                setNewName(e.target.value)
                setNewNameError(undefined)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addMember()
                }
              }}
            />
            <button type="button" className="primary" onClick={addMember}>
              Add
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setAddingMember(false)
                setNewName('')
                setNewNameError(undefined)
              }}
            >
              Cancel
            </button>
          </div>
          {newNameError ? (
            <p className="error" role="alert">
              {newNameError}
            </p>
          ) : (
            <p className="hint">Up to {MAX_MEMBER_NAME_LENGTH} characters</p>
          )}
        </div>
      )}
      <fieldset className="split-type">
        <legend>Split</legend>
        <div className="segmented">
          {SPLIT_OPTIONS.map(({ type, label }) => (
            <label key={type} className="segment">
              <input
                type="radio"
                name="splitType"
                value={type}
                checked={values.splitType === type}
                onChange={() => {
                  update('splitType', type)
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {preview.type === 'equal' && (
        <fieldset className="members" {...groupProps}>
          <legend>Split between</legend>
          <div className="choices">
            {members.map((m) => (
              <label key={m.id} className="choice">
                <input
                  type="checkbox"
                  checked={values.equalMemberIds.includes(m.id)}
                  onChange={(e) => {
                    toggleMember(m.id, e.target.checked)
                  }}
                />
                {m.name}
              </label>
            ))}
          </div>

          {preview.rows.length > 0 ? (
            <ul className="breakdown" aria-label="Each person's share">
              {preview.rows.map((row) => (
                <li key={row.memberId}>
                  <span>{names.get(row.memberId) ?? row.memberId}</span>
                  <span className="amount">{formatINR(row.amount)}</span>
                </li>
              ))}
              <li className="breakdown-total">
                <span>Total</span>
                <span className="amount">{formatINR(preview.total)}</span>
              </li>
            </ul>
          ) : (
            <p className="hint">Enter an amount and pick members to see each share.</p>
          )}
          <GroupMessage id="split" error={errors.split} />
        </fieldset>
      )}

      {preview.type !== 'equal' && (
        <fieldset className="members" {...groupProps}>
          <legend>
            {preview.type === 'exact'
              ? 'Amount per member (₹)'
              : 'Percentage per member (%)'}
          </legend>

          {members.map((m) => {
            const key = preview.type === 'exact' ? 'exact' : 'percent'
            const id = `${key}-${m.id}`
            const error = errors.shares[m.id]
            const rupees =
              preview.type === 'percent'
                ? preview.rows.find((row) => row.memberId === m.id)
                : undefined
            const hint = rupees ? `= ${formatINR(rupees.amount)}` : undefined
            return (
              <Field
                key={m.id}
                id={id}
                label={preview.type === 'exact' ? `${m.name} (₹)` : `${m.name} (%)`}
                error={error}
                hint={hint}
              >
                <input
                  {...fieldA11y(id, error, hint)}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={values[key][m.id] ?? ''}
                  onChange={(e) => {
                    updateShare(key, m.id, e.target.value)
                  }}
                />
              </Field>
            )
          })}

          <GroupMessage id="split" error={errors.split}>
            {status && (
              <p className={`status ${status.tone}`} role="status">
                {status.text}
              </p>
            )}
          </GroupMessage>
        </fieldset>
      )}
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary">
          Save
        </button>
      </div>
    </form>
  )
}
