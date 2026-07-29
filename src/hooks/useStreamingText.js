import { useCallback, useEffect, useRef } from 'react'

const STREAM_REVEAL_INTERVAL_MS = 28
const STREAM_REVEAL_CHARS = 3

export default function useStreamingText({ activeMessageIdRef, appendText }) {
  const bufferRef = useRef('')
  const timerRef = useRef(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const reveal = useCallback(() => {
    timerRef.current = null
    const messageId = activeMessageIdRef.current
    if (!messageId || !bufferRef.current) return

    const nextText = bufferRef.current.slice(0, STREAM_REVEAL_CHARS)
    bufferRef.current = bufferRef.current.slice(STREAM_REVEAL_CHARS)
    appendText(messageId, nextText)
    if (bufferRef.current) {
      timerRef.current = window.setTimeout(reveal, STREAM_REVEAL_INTERVAL_MS)
    }
  }, [activeMessageIdRef, appendText])

  const enqueue = useCallback((content) => {
    bufferRef.current += content
    if (!timerRef.current) {
      timerRef.current = window.setTimeout(reveal, STREAM_REVEAL_INTERVAL_MS)
    }
  }, [reveal])

  const flush = useCallback(() => {
    clearTimer()
    const messageId = activeMessageIdRef.current
    const bufferedText = bufferRef.current
    bufferRef.current = ''
    if (messageId && bufferedText) appendText(messageId, bufferedText)
  }, [activeMessageIdRef, appendText, clearTimer])

  const discard = useCallback(() => {
    clearTimer()
    bufferRef.current = ''
  }, [clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  return { enqueue, flush, discard }
}
