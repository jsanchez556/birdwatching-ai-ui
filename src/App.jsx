import ChatInput from './components/ChatInput'
import ChatMessages from './components/ChatMessages'
import useChat from './hooks/useChat'

function App() {
  const {
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopGenerating,
  } = useChat()

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">BW</div>
        <div>
          <h1>Birdwatching AI</h1>
          <p>Your Costa Rica bird expert</p>
        </div>
      </header>
      <div className="chat-container">
        {error && (
          <div className="chat-alert" role="status">
            {error}
          </div>
        )}
        <ChatMessages messages={messages} isLoading={isLoading} />
        <ChatInput
          onSendMessage={sendMessage}
          onStopGenerating={stopGenerating}
          isLoading={isLoading}
          isStreaming={isStreaming}
        />
      </div>
    </main>
  )
}

export default App
