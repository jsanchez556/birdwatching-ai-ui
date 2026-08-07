import { fireEvent, render, screen, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import MaintenanceEditorDialog from '../MaintenanceEditorDialog'

function DialogHarness({ dirty = false, pending = false }) {
  const [open, setOpen] = useState(false)
  const openerRef = useRef(null)
  return <>
    <button ref={openerRef} type="button" onClick={() => setOpen(true)}>Open editor</button>
    {open && <MaintenanceEditorDialog title="Edit bird" description="Update this bird." dirty={dirty}
      pending={pending} error="" onClose={() => setOpen(false)} onSubmit={(event) => event.preventDefault()}
      onDirty={() => {}} returnFocusRef={openerRef} submitLabel="Save changes">
      <label>Bird name<input defaultValue="Quetzal" /></label>
    </MaintenanceEditorDialog>}
  </>
}

test('a clean dialog closes from its backdrop, not inside clicks, and restores focus', () => {
  render(<DialogHarness />)
  const opener = screen.getByRole('button', { name: 'Open editor' })
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Edit bird' })
  fireEvent.click(dialog)
  expect(dialog).toBeInTheDocument()
  fireEvent.click(document.querySelector('.maintenance-editor-backdrop'))
  expect(screen.queryByRole('dialog', { name: 'Edit bird' })).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

test('a dirty backdrop request offers keep editing or discard', () => {
  render(<DialogHarness dirty />)
  fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))
  fireEvent.click(document.querySelector('.maintenance-editor-backdrop'))
  const confirmation = screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })
  expect(within(confirmation).getByRole('button', { name: 'Keep editing' })).toHaveFocus()
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Keep editing' }))
  expect(screen.getByRole('dialog', { name: 'Edit bird' })).toBeInTheDocument()

  fireEvent.click(document.querySelector('.maintenance-editor-backdrop'))
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(screen.queryByRole('dialog', { name: 'Edit bird' })).not.toBeInTheDocument()
})

test('pending dialogs ignore backdrop clicks and Escape', () => {
  render(<DialogHarness pending />)
  fireEvent.click(screen.getByRole('button', { name: 'Open editor' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit bird' })
  expect(dialog).toHaveAttribute('aria-busy', 'true')
  fireEvent.click(document.querySelector('.maintenance-editor-backdrop'))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(dialog).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
