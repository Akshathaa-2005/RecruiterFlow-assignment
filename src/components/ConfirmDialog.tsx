import { useEffect, useRef, type KeyboardEvent } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Move focus into the dialog, and give it back to the opener when it closes.
  useEffect(() => {
    const opener = document.activeElement
    cancelRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onCancel()
    } else if (event.key === 'Tab') {
      // Two buttons only: keep Tab / Shift+Tab inside the dialog.
      const first = cancelRef.current
      const last = confirmRef.current
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }

  return (
    <div className="backdrop">
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
        onKeyDown={handleKeyDown}
      >
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-message">{message}</p>
        <div className="actions">
          <button type="button" className="secondary" ref={cancelRef} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger" ref={confirmRef} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
