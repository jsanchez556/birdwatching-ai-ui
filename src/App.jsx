import { useState } from 'react'
import AuthForm from './components/AuthForm'
import ChatInput from './components/ChatInput'
import ChatMessages from './components/ChatMessages'
import CustomerContextForm from './components/CustomerContextForm'
import useAuth from './hooks/useAuth'
import useChat from './hooks/useChat'

function AuthenticatedChat({ auth }) {
  const viewerRole = auth.user?.role || (auth.isVisitor ? 'visitor' : 'customer')
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    customerContext,
    conversationMeta,
    setCustomerContext,
    sendMessage,
    stopGenerating,
  } = useChat({
    token: auth.token,
    user: auth.user,
    role: viewerRole,
  })
  const isVisitor = viewerRole === 'visitor'

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-group">
          <div className="brand-mark" aria-hidden="true">BW</div>
          <div>
            <h1>Birdwatching AI</h1>
            <p>Your Costa Rica bird expert</p>
          </div>
        </div>
        <button type="button" className="logout-action" onClick={auth.logout}>
          {isVisitor ? 'Exit visitor chat' : 'Log out'}
        </button>
      </header>
      <div className="chat-container">
        {isVisitor && (
          <div className="chat-notice" role="status">
            Visitor mode is for bird questions only. Log in to plan or reserve tours.
          </div>
        )}
        {!isVisitor && !customerContext ? (
          <CustomerContextForm onSubmit={setCustomerContext} authUser={auth.user} />
        ) : (
          <>
        {error && (
          <div className="chat-alert" role="status">
            {error}
          </div>
        )}
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          customerContext={customerContext}
          conversationMeta={conversationMeta}
          onAction={sendMessage}
          viewerRole={viewerRole}
        />
        <ChatInput
          onSendMessage={sendMessage}
          onStopGenerating={stopGenerating}
          isLoading={isLoading}
          isStreaming={isStreaming}
        />
          </>
        )}
      </div>
    </main>
  )
}

function App() {
  const [authMode, setAuthMode] = useState('login')
  const auth = useAuth()

  if (!auth.isAuthenticated && !auth.isVisitor) {
    return (
      <main className="app-shell auth-shell">
        <header className="app-header">
          <div className="brand-group">
            <div className="brand-mark" aria-hidden="true">BW</div>
            <div>
              <h1>Birdwatching AI</h1>
              <p>Your Costa Rica bird expert</p>
            </div>
          </div>
        </header>
        <AuthForm
          mode={authMode}
          error={auth.error}
          isLoading={auth.isLoading}
          onLogin={auth.login}
          onSignup={auth.signup}
          onSwitchMode={() => setAuthMode((mode) => (mode === 'login' ? 'signup' : 'login'))}
          onEnterAsVisitor={auth.enterAsVisitor}
        />
      </main>
    )
  }

  return <AuthenticatedChat auth={auth} />
}

export default App
