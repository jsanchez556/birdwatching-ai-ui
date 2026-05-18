import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AuthForm from '../AuthForm'

describe('AuthForm', () => {
  test('submits login credentials', async () => {
    const onLogin = jest.fn().mockResolvedValue({})

    render(
      <AuthForm
        mode="login"
        onLogin={onLogin}
        onSignup={jest.fn()}
        onSwitchMode={jest.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secure-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith({
        email: 'ana@example.com',
        password: 'secure-password',
      })
    })
  })

  test('submits signup credentials', async () => {
    const onSignup = jest.fn().mockResolvedValue({})

    render(
      <AuthForm
        mode="signup"
        onLogin={jest.fn()}
        onSignup={onSignup}
        onSwitchMode={jest.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Ana Gomez' },
    })
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'secure-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => {
      expect(onSignup).toHaveBeenCalledWith({
        name: 'Ana Gomez',
        email: 'ana@example.com',
        password: 'secure-password',
      })
    })
  })
})
