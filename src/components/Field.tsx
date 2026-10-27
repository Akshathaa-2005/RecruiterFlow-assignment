import type { ReactNode } from 'react'

interface FieldProps {
  id: string
  label: string
  error?: string | undefined
  /** Shown in the message slot while there is no error */
  hint?: string | undefined
  children: ReactNode
}

/**
 * Label above, input in the middle, message below. The message slot always
 * takes up its space, so showing or clearing an error never moves the form.
 */
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      <div className="field-message">
        {error ? (
          <p className="error" id={`${id}-error`}>
            {error}
          </p>
        ) : hint ? (
          <p className="hint" id={`${id}-hint`}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** Error line for a group of inputs (a fieldset), with the same reserved space. */
export function GroupMessage({
  id,
  error,
  children,
}: {
  id: string
  error?: string | undefined
  children?: ReactNode
}) {
  return (
    <div className="field-message">
      {error ? (
        <p className="error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        children
      )}
    </div>
  )
}

/** Attributes that connect an input to its error or hint. */
export function fieldA11y(id: string, error?: string, hint?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  }
}
