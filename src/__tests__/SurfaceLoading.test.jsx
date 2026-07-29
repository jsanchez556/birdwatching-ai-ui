import { render, screen } from '@testing-library/react'
import { SurfaceLoading } from '../App'

test('lazy product surfaces expose an accessible loading state', () => {
  render(<SurfaceLoading />)
  expect(screen.getByRole('status', { name: /loading application/i })).toBeInTheDocument()
})
