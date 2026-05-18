import { useRef, useState } from 'react'
import { normalizeText } from '../utils/normalizers'

function ChatInput({
  onSendMessage,
  onStopGenerating,
  isLoading,
  isStreaming = false,
}) {
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)

  const resizeTextarea = (textarea) => {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const message = normalizeText(input)
    if (!message || isLoading) return
    
    onSendMessage(message)
    setInput('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  return (
    <div className="input-container">
      <form className="input-form" onSubmit={handleSubmit}>
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
          disabled={isLoading}
          rows="1"
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!normalizeText(input) || isLoading}
          aria-label="Send message"
        >
          <span aria-hidden="true">↑</span>
        </button>
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
    </div>
  )
}

export default ChatInput
