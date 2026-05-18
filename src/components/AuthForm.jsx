import { useState } from 'react'
import { normalizeText } from '../utils/normalizers'

function AuthForm({
  mode,
  error,
  isLoading,
  onLogin,
  onSignup,
  onSwitchMode,
  onEnterAsVisitor,
}) {
  const isSignup = mode === 'signup'
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const credentials = {
      email: normalizeText(form.email),
      password: form.password,
      ...(isSignup ? { name: normalizeText(form.name) } : {}),
    }

    try {
      if (isSignup) {
        await onSignup(credentials)
        return
      }

      await onLogin(credentials)
    } catch {
      // The auth hook owns the displayed error state.
    }
  }

  const isComplete = normalizeText(form.email)
    && form.password.length >= 8

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div>
          <h2 id="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p>
            {isSignup
              ? 'Save your birding trip planning and continue securely.'
              : 'Log in to continue your Costa Rica birding chat.'}
          </p>
        </div>
        {error && (
          <div className="chat-alert auth-alert" role="alert">
            {error}
          </div>
        )}
        {isSignup && (
          <label>
            Name (optional)
            <input
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            minLength={8}
            onChange={(event) => updateField('password', event.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
          />
        </label>
        <button type="submit" className="primary-action" disabled={!isComplete || isLoading}>
          {isLoading ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={onSwitchMode}
          disabled={isLoading}
        >
          {isSignup ? 'Already have an account? Log in' : 'Need an account? Sign up'}
        </button>
        <button
          type="button"
          className="visitor-action"
          onClick={onEnterAsVisitor}
          disabled={isLoading}
        >
          Continue as visitor
        </button>
      </form>
    </section>
  )
}

export default AuthForm
