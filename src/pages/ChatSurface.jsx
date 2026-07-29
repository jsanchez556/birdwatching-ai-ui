import { useEffect } from 'react'
import ChatInput from '../components/ChatInput'
import ChatMessages from '../components/ChatMessages'
import CustomerContextForm from '../components/CustomerContextForm'
import { FEATURE_FLAGS } from '../featureFlags/flags'
import useChat from '../hooks/useChat'
import useFeatureAvailability from '../hooks/useFeatureAvailability'
import useFeatureFlag from '../hooks/useFeatureFlag'

export function ChatSurface({ auth, chatEntry = null }) {
  const voiceFlagEnabled = useFeatureFlag(FEATURE_FLAGS.VOICE_AI)
  const { getFeature } = useFeatureAvailability()
  const voiceAvailability = getFeature(FEATURE_FLAGS.VOICE_AI)
  const voiceEnabled = voiceFlagEnabled && voiceAvailability.enabled
  const viewerRole = auth.user?.role || (auth.isVisitor ? 'visitor' : 'customer')
  const isReservationEntry = Boolean(chatEntry)
  const chat = useChat({
    token: auth.token,
    getAccessToken: auth.getValidToken,
    user: auth.user,
    role: viewerRole,
  }, {
    isEphemeral: isReservationEntry,
    initialCustomerContext: chatEntry?.customerContext,
    initialConversationContext: chatEntry?.conversationContext,
    initialEntryId: chatEntry?.id,
    initialMessage: chatEntry?.initialMessage,
  })
  const isVisitor = viewerRole === 'visitor'

  return (
    <div className="chat-container">
      {isVisitor && (
        <div className="chat-notice" role="status">
          Visitor mode is for bird questions only. Log in to plan or reserve tours.
        </div>
      )}
      {!isVisitor && !chat.customerContext ? (
        <CustomerContextForm onSubmit={chat.setCustomerContext} authUser={auth.user} />
      ) : (
        <>
          {chat.error && <div className="chat-alert" role="status">{chat.error}</div>}
          <ChatMessages
            messages={chat.messages}
            isLoading={chat.isLoading}
            customerContext={chat.customerContext}
            conversationContext={chat.conversationContext}
            onAction={chat.sendMessage}
            viewerRole={viewerRole}
          />
          <ChatInput
            onSendMessage={chat.sendMessage}
            onStopGenerating={chat.stopGenerating}
            onStartVoiceRecording={chat.startVoiceRecording}
            onStopVoiceRecording={chat.stopVoiceRecording}
            onCancelVoiceRecording={chat.cancelVoiceRecording}
            isLoading={chat.isLoading}
            isStreaming={chat.isStreaming}
            isRecording={chat.isRecording}
            voiceStatus={chat.voiceStatus}
            voiceEnabled={voiceEnabled}
            voiceUnavailableMessage={!voiceAvailability.enabled
              ? `${voiceAvailability.message}${voiceAvailability.disabledUntil
                ? ` Re-enables at ${new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(voiceAvailability.disabledUntil))}.`
                : ''}`
              : ''}
          />
        </>
      )}
    </div>
  )
}

export function HomeChatDrawer({ auth, chatEntry = null, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="home-chat-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="home-chat-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-chat-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="home-chat-drawer-header">
          <div>
            <p className="home-kicker">Birdwatching AI</p>
            <h2 id="home-chat-title">{chatEntry?.title || 'Plan your birding chat'}</h2>
          </div>
          <button type="button" className="auth-modal-close" aria-label="Close chat" onClick={onClose}>
            x
          </button>
        </header>
        <ChatSurface auth={auth} chatEntry={chatEntry} />
      </section>
    </div>
  )
}

export function AuthenticatedChatSurface({ auth, onHome }) {
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
        <div className="header-actions">
          <button type="button" className="logout-action" onClick={onHome}>Home</button>
          <button type="button" className="logout-action" onClick={auth.logout}>
            {auth.isVisitor ? 'Exit visitor chat' : 'Log out'}
          </button>
        </div>
      </header>
      <ChatSurface auth={auth} />
    </main>
  )
}
