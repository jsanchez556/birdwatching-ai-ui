import { useEffect, useRef, useState } from 'react'
import { normalizeText } from '../utils/normalizers'

function MicrophoneIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M18 11a6 6 0 0 1-12 0" />
      <path d="M12 17v4" />
      <path d="M8.5 21h7" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m5 12 14-7-4 14-3-6-7-1Z" />
      <path d="m12 13 7-8" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m7 7 10 10" />
      <path d="m17 7-10 10" />
    </svg>
  )
}

function formatElapsedTime(seconds) {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function ChatInput({
  onSendMessage,
  onStopGenerating,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onCancelVoiceRecording,
  isLoading,
  isStreaming = false,
  isRecording = false,
  voiceStatus = 'idle',
  voiceEnabled = true,
}) {
  const [input, setInput] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const textareaRef = useRef(null)
  const voiceStatusLabel = {
    recording: `Recording ${formatElapsedTime(recordingSeconds)}`,
    processing: 'Preparing voice message',
    uploading: 'Sending voice message',
  }[voiceStatus]
  const isVoiceBusy = voiceStatus === 'processing' || voiceStatus === 'uploading'

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0)
      return undefined
    }

    setRecordingSeconds(0)
    const intervalId = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1)
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isRecording])

  const resizeTextarea = (textarea) => {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const message = normalizeText(input)
    if (!message || isLoading || isRecording) return
    
    onSendMessage(message)
    setInput('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleVoiceClick = () => {
    onStartVoiceRecording?.()
  }

  const handleCancelVoice = () => {
    onCancelVoiceRecording?.()
  }

  const handleSendVoice = () => {
    onStopVoiceRecording?.()
  }

  return (
    <div className="input-container">
      <form className="input-form" onSubmit={handleSubmit}>
        {isRecording ? (
          <div className="recording-composer" aria-label="Voice recording controls">
            <button
              type="button"
              className="voice-cancel-button"
              onClick={handleCancelVoice}
              aria-label="Cancel voice recording"
            >
              <CloseIcon />
            </button>
            <div className="recording-meter" role="status" aria-live="polite">
              <span className="recording-dot" aria-hidden="true"></span>
              <span className="recording-time">{formatElapsedTime(recordingSeconds)}</span>
              <span className="recording-wave" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
            <button
              type="button"
              className="voice-send-button"
              onClick={handleSendVoice}
              aria-label="Send voice message"
            >
              <SendIcon />
            </button>
          </div>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                resizeTextarea(e.target)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  handleSubmit(e)
                }
              }}
              placeholder="Ask about birds in Costa Rica..."
              disabled={isLoading || isVoiceBusy}
              rows="1"
            />
            {voiceEnabled && (
              <button
                type="button"
                className="voice-button"
                onClick={handleVoiceClick}
                disabled={isLoading || isVoiceBusy}
                aria-label="Start recording voice message"
              >
                <MicrophoneIcon />
              </button>
            )}
            <button
              type="submit"
              className="send-button"
              disabled={!normalizeText(input) || isLoading || isVoiceBusy}
              aria-label="Send message"
            >
              <span aria-hidden="true">↑</span>
            </button>
          </>
        )}
        {isStreaming && (
          <button
            type="button"
            className="stop-button"
            onClick={onStopGenerating}
            aria-label="Stop"
          >
            <span aria-hidden="true"></span>
          </button>
        )}
      </form>
      {voiceStatusLabel && !isRecording && (
        <div className="voice-status" role="status" aria-live="polite">
          {voiceStatusLabel}
        </div>
      )}
    </div>
  )
}

export default ChatInput
