import { useLayoutEffect, useRef } from 'react'
import BirdMatchesCarousel from './BirdMatchesCarousel'
import ReservationConfirmationCard from './ReservationConfirmationCard'
import MessageActions from './MessageActions'
import TourRecommendationCards from './TourRecommendationCards'
import { isTourRecommendation } from '../api/tourRecommendationContract'
import {
  extractReservationConfirmation,
  normalizeReservationConfirmation,
} from '../utils/reservationConfirmation'
import { normalizeText } from '../utils/normalizers'

function VoiceResponseAudio({ audioUrl }) {
  if (!audioUrl) {
    return null
  }

  return (
    <audio
      className="message-audio"
      controls
      src={audioUrl}
      aria-label="Voice response audio"
    />
  )
}

function MessageContent({ message, conversationContext, onAction, viewerRole }) {
  if (message.isStopped && !message.content) {
    return (
      <span className="stopped-message">
        Response stopped.
      </span>
    )
  }

  if (message.isStreaming && !message.content) {
    return (
      <span className="streaming-placeholder" aria-label="Birdwatching AI is typing">
        <span></span>
        <span></span>
        <span></span>
      </span>
    )
  }

  const shouldUseChatReservation = /\bconfirmed\b|\bconfirmation\s+code\b/i.test(message.content || '')
  const chatReservation = shouldUseChatReservation && conversationContext?.reservation
    ? {
        ...conversationContext.reservation,
        participants: conversationContext.reservation.participants ?? conversationContext.participants,
      }
    : null
  const reservation = message.role === 'assistant' && !message.isError
    ? normalizeReservationConfirmation(
      chatReservation || message.metadata?.reservation,
      (shouldUseChatReservation ? conversationContext?.selectedTransfer : null) || message.metadata?.selectedTransfer
    )
      || extractReservationConfirmation(message.content)
    : null
  const messageActions = [
    ...(message.metadata?.uiAction ? [message.metadata.uiAction] : []),
    ...(Array.isArray(message.metadata?.uiActions) ? message.metadata.uiActions : []),
  ]
  const birdMatches = message.role === 'assistant' && !message.isError && Array.isArray(message.metadata?.birdMatches)
    ? message.metadata.birdMatches
    : []
  const audioUrl = message.role === 'assistant' && !message.isError
    ? message.audioUrl
    : ''
  const tourRecommendation = message.role === 'assistant' && !message.isError
    && isTourRecommendation(message.metadata?.tourRecommendation)
    ? message.metadata.tourRecommendation
    : null

  if (!reservation) {
    return (
      <>
        {message.content}
        <TourRecommendationCards recommendation={tourRecommendation} />
        <VoiceResponseAudio audioUrl={audioUrl} />
        <BirdMatchesCarousel birds={birdMatches} />
        <MessageActions actions={messageActions} onAction={onAction} viewerRole={viewerRole} />
      </>
    )
  }

  return (
    <>
      {message.content && (
        <div className="message-text">{message.content}</div>
      )}
      <ReservationConfirmationCard reservation={reservation} />
      <TourRecommendationCards recommendation={tourRecommendation} />
      <VoiceResponseAudio audioUrl={audioUrl} />
      <BirdMatchesCarousel birds={birdMatches} />
      <MessageActions actions={messageActions} onAction={onAction} viewerRole={viewerRole} />
    </>
  )
}

function getCustomerInitials(customerName) {
  const normalizedName = normalizeText(customerName)

  if (!normalizedName) {
    return 'Y'
  }

  const parts = normalizedName.split(/\s+/).filter(Boolean)
  const selectedParts = parts.length > 1 ? [parts[0], parts[1]] : [parts[0]]

  return selectedParts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function ChatMessages({ messages, isLoading, customerContext, conversationContext, onAction, viewerRole }) {
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
        avatar: getCustomerInitials(customerContext?.customerName),
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
          const presentation = getMessageMeta(message.role)

          return (
            <article
              key={index}
              className={`message-row ${presentation.rowClass}`}
            >
              <div className="avatar" aria-hidden="true">
                {presentation.avatar}
              </div>
              <div className="message-stack">
                <div className="message-label">
                  {presentation.label}
                </div>
                <div className={`message-bubble${message.isError ? ' error' : ''}${message.role === 'assistant' ? ' assistant-content' : ''}${message.isStreaming ? ' streaming' : ''}`}>
                  <MessageContent message={message} conversationContext={conversationContext} onAction={onAction} viewerRole={viewerRole} />
                </div>
              </div>
            </article>
          )
        })}

        {isLoading && !messages.some((message) => message.isStreaming) && (
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
