import { useEffect } from 'react'
import AuthForm from '../AuthForm'

function LoginModal({
  authMode,
  error,
  isLoading,
  onClose,
  onEnterAsVisitor,
  onLogin,
  onSignup,
  onSwitchMode,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal-close"
          aria-label="Close login"
          onClick={onClose}
        >
          x
        </button>
        <AuthForm
          mode={authMode}
          error={error}
          isLoading={isLoading}
          onLogin={onLogin}
          onSignup={onSignup}
          onSwitchMode={onSwitchMode}
          onEnterAsVisitor={onEnterAsVisitor}
        />
      </div>
    </div>
  )
}

export default LoginModal
