import { useLayoutEffect, useRef } from 'react'
import ReservationConfirmationCard from './ReservationConfirmationCard'
import {
  extractReservationConfirmation,
  normalizeReservationConfirmation,
} from '../utils/reservationConfirmation'

function MessageContent({ message }) {
  const reservation = message.role === 'assistant' && !message.isError
    ? normalizeReservationConfirmation(message.reservation)
      || normalizeReservationConfirmation(message.metadata?.reservation)
      || extractReservationConfirmation(message.content)
    : null

  if (!reservation) {
    return message.content
  }

  return (
    <>
      {message.content && (
        <div className="message-text">{message.content}</div>
      )}
      <ReservationConfirmationCard reservation={reservation} />
    </>
  )
}

function ChatMessages({ messages, isLoading }) {
  const messagesRef = useRef(null)

  useLayoutEffect(() => {
    const messagesElement = messagesRef.current

    if (!messagesElement) return

    if (typeof messagesElement.scrollTo === 'function') {
      messagesElement.scrollTo({
        top: messagesElement.scrollHeight,
        behavior: 'smooth',
      })
    } else {
      messagesElement.scrollTop = messagesElement.scrollHeight
    }
  }, [messages, isLoading])

  const getMessageMeta = (role) => {
    if (role === 'user') {
      return {
        rowClass: 'user',
        label: 'You',
        avatar: 'Y',
      }
    }

    return {
      rowClass: 'assistant',
      label: 'Birdwatching AI',
      avatar: 'BW',
    }
  }

  if (messages.length === 0 && !isLoading) {
    return (
      <section className="messages is-empty" ref={messagesRef} aria-label="Chat messages">
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">BW</div>
          <h3>Welcome to Birdwatching AI</h3>
          <p>Ask me about birds, locations, and tours in Costa Rica.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="messages" ref={messagesRef} aria-label="Chat messages" aria-live="polite">
      <div className="message-list">
        {messages.map((message, index) => {
          const meta = getMessageMeta(message.role)

          return (
            <article
              key={index}
              className={`message-row ${meta.rowClass}`}
            >
              <div className="avatar" aria-hidden="true">
                {meta.avatar}
              </div>
              <div className="message-stack">
                <div className="message-label">
                  {meta.label}
                </div>
                <div className={`message-bubble${message.isError ? ' error' : ''}${message.role === 'assistant' ? ' assistant-content' : ''}`}>
                  <MessageContent message={message} />
                </div>
              </div>
            </article>
          )
        })}

        {isLoading && (
          <article className="message-row assistant">
            <div className="avatar" aria-hidden="true">BW</div>
            <div className="message-stack">
              <div className="message-label">Birdwatching AI</div>
              <div className="message-bubble loading-bubble" aria-label="Birdwatching AI is thinking">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}

export default ChatMessages
