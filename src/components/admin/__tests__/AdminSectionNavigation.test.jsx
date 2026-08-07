import { fireEvent, render, screen } from '@testing-library/react'
import AdminSectionNavigation from '../AdminSectionNavigation'

const sections = [
  { id: 'birds', label: 'Birds', group: 'Maintenance' },
  { id: 'zones', label: 'Zones', group: 'Maintenance' },
  { id: 'nodes', label: 'Nodes', group: 'Maintenance' },
  { id: 'tours', label: 'Tours', group: 'Maintenance' },
  { id: 'commercial', label: 'Users and billing', group: 'Administration' },
  { id: 'ai_operations', label: 'AI operations', group: 'Administration' },
]

test('groups sections into collapsible categories and expands the active category', () => {
  const onSelect = jest.fn()
  const { rerender } = render(<AdminSectionNavigation sections={sections} activeSection="tours" onSelect={onSelect} />)
  expect(screen.getByRole('button', { name: 'Maintenance' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('button', { name: 'Tours' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('button', { name: 'Users and billing' })).not.toBeInTheDocument()
  expect(screen.queryByText('Countries')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nodes' })).toBeInTheDocument()
  expect(screen.queryByText('Birds by node')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Administration' }))
  fireEvent.click(screen.getByRole('button', { name: 'Users and billing' }))
  expect(onSelect).toHaveBeenCalledWith('commercial')

  rerender(<AdminSectionNavigation sections={sections} activeSection="commercial" onSelect={onSelect} />)
  expect(screen.getByRole('button', { name: 'Administration' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('button', { name: 'Users and billing' })).toHaveAttribute('aria-current', 'page')
})

test('category toggles are native keyboard-accessible buttons', () => {
  render(<AdminSectionNavigation sections={sections} activeSection="tours" onSelect={jest.fn()} />)
  const maintenance = screen.getByRole('button', { name: 'Maintenance' })
  maintenance.focus()
  fireEvent.keyDown(maintenance, { key: 'Enter' })
  fireEvent.click(maintenance)
  expect(maintenance).toHaveAttribute('aria-expanded', 'false')
})
