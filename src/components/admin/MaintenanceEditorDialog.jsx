import { useEffect, useRef, useState } from 'react'

function MaintenanceEditorDialog({
  title, description, dirty, pending, suspended = false, error, onClose, onSubmit,
  onDirty, returnFocusRef, children, submitLabel,
  submitDisabled = false,
}) {
  const dialogRef = useRef(null)
  const keepEditingRef = useRef(null)
  const dirtyRef = useRef(dirty)
  const pendingRef = useRef(pending)
  const suspendedRef = useRef(suspended)
  const confirmDiscardRef = useRef(false)
  const closeRef = useRef(onClose)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  dirtyRef.current = dirty
  pendingRef.current = pending
  suspendedRef.current = suspended
  confirmDiscardRef.current = confirmDiscard
  closeRef.current = onClose

  useEffect(() => {
    dialogRef.current?.querySelector('input, select, textarea, button')?.focus()
    const handleKeyDown = (event) => {
      if (suspendedRef.current) return
      if (event.key === 'Escape' && !pendingRef.current) {
        event.preventDefault()
        if (confirmDiscardRef.current) setConfirmDiscard(false)
        else if (dirtyRef.current) setConfirmDiscard(true)
        else closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusScope = dialogRef.current?.querySelector('[role="alertdialog"]') || dialogRef.current
      const controls = [...(focusScope?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      ) || [])]
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      returnFocusRef.current?.focus()
    }
  }, [returnFocusRef])

  useEffect(() => {
    if (confirmDiscard) keepEditingRef.current?.focus()
  }, [confirmDiscard])

  const requestClose = () => {
    if (pending || suspended || confirmDiscard) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  return <div className="admin-operation-backdrop maintenance-editor-backdrop" role="presentation"
    onClick={(event) => { if (event.target === event.currentTarget) requestClose() }}>
    <section ref={dialogRef} className="admin-operation-dialog maintenance-editor-dialog"
      role="dialog" aria-modal="true" aria-labelledby="maintenance-editor-title"
      aria-describedby="maintenance-editor-description" aria-busy={pending}
      aria-hidden={suspended ? 'true' : undefined}>
      <header className="maintenance-dialog-header"><div><p className="admin-eyebrow">Data maintenance</p>
        <h2 id="maintenance-editor-title">{title}</h2>
        <p id="maintenance-editor-description">{description}</p></div>
        <button type="button" onClick={requestClose} disabled={pending}>Close</button></header>
      <form onSubmit={onSubmit} onChange={onDirty} noValidate>
        {children}
        {error && <div className="admin-alert maintenance-dialog-error" role="alert"><strong>Unable to save</strong><p>{error}</p></div>}
        <div className="maintenance-dialog-actions"><button type="button" onClick={requestClose} disabled={pending}>Cancel</button>
          <button type="submit" className="maintenance-save" disabled={pending || submitDisabled}>{pending ? 'Saving…' : submitLabel}</button></div>
      </form>
      {confirmDiscard && <div className="node-inline-confirm maintenance-discard-confirm" role="alertdialog"
        aria-modal="true" aria-labelledby="maintenance-discard-title"><h3 id="maintenance-discard-title">Discard unsaved changes?</h3>
        <p>The record will keep its previously saved values.</p><div><button ref={keepEditingRef} type="button" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
          <button type="button" className="admin-danger-action" onClick={onClose}>Discard changes</button></div></div>}
    </section>
  </div>
}

export default MaintenanceEditorDialog
