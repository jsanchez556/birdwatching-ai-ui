import { fireEvent, render, screen } from '@testing-library/react'
import UserAdministration from '../UserAdministration'

const users = {
  data: [
    { id: '1', name: 'Current Admin', email: 'admin@example.com', role: 'admin', plan: 'PRO', status: 'active' },
    { id: '7', name: 'Ana Guide', email: 'ana@example.com', role: 'customer', plan: 'FREE', status: 'active' },
  ],
  meta: { page: 1, limit: 25, total: 2, totalPages: 1 },
}

test('selects a supported role and requests confirmation while protecting current admin', () => {
  const onChangeRole = jest.fn()
  render(<UserAdministration users={users} currentUserId="1" getAccessToken={jest.fn()} getOperationState={() => ({ status: 'idle' })} onChangeRole={onChangeRole} onSuspend={jest.fn()} onUnsuspend={jest.fn()} />)
  expect(screen.getByLabelText(/role for current admin/i)).toBeDisabled()
  fireEvent.change(screen.getByLabelText(/role for ana guide/i), { target: { value: 'tour guide' } })
  fireEvent.click(screen.getAllByRole('button', { name: /change role/i })[1])
  expect(onChangeRole).toHaveBeenCalledWith(expect.objectContaining({ id: '7' }), 'tour guide', expect.any(HTMLElement))
  expect(screen.getByText(/account: active · authorization role: customer/i)).toBeInTheDocument()
})
