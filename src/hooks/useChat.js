import { useCallback, useEffect, useRef, useState } from 'react'
import { loadConversationMessages, streamChatMessage } from '../api/chatApi'

const REQUEST_FAILURE_MESSAGE = 'Sorry, something went wrong. Please try again.'
const CONVERSATION_ID_STORAGE_KEY = 'birdwatchingAI.conversationId'
const CONVERSATION_MESSAGES_STORAGE_PREFIX = 'birdwatchingAI.messages.'
const STREAM_REVEAL_INTERVAL_MS = 28
const STREAM_REVEAL_CHARS = 3

function createConversationId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getStoredConversationId() {
  try {
    return window.localStorage.getItem(CONVERSATION_ID_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistConversationId(conversationId) {
  try {
    window.localStorage.setItem(CONVERSATION_ID_STORAGE_KEY, conversationId)
  } catch {
    // Chat still works if storage is blocked or unavailable.
  }
}

function getConversationMessagesStorageKey(conversationId) {
  return `${CONVERSATION_MESSAGES_STORAGE_PREFIX}${conversationId}`
}

function getCachedMessages(conversationId) {
  try {
    const cachedMessages = window.localStorage.getItem(
      getConversationMessagesStorageKey(conversationId)
    )

    if (!cachedMessages) {
      return null
    }

    const parsedMessages = JSON.parse(cachedMessages)

    if (Array.isArray(parsedMessages)) {
      return parsedMessages
    }

    if (Array.isArray(parsedMessages?.messages)) {
      return parsedMessages.messages
    }

    return null
  } catch {
    return null
  }
}

function hasMetadata(metadata) {
  return metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0
}

function createAssistantMessage(response, metadata = {}) {
  return {
    role: 'assistant',
    content: response,
    ...(hasMetadata(metadata)
      ? { metadata }
      : {}),
    ...(metadata?.reservation
      ? { reservation: metadata.reservation }
      : {}),
  }
}

function persistConversationMessages(conversationId, messages) {
  try {
    window.localStorage.setItem(
      getConversationMessagesStorageKey(conversationId),
      JSON.stringify({
        messages,
        metadata: {
          savedAt: new Date().toISOString(),
        },
      })
    )
  } catch {
    // Conversation hydration falls back to the API if message cache is unavailable.
  }
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'
}

function getInitialConversationState() {
  const storedConversationId = getStoredConversationId()

  if (storedConversationId) {
    const cachedMessages = getCachedMessages(storedConversationId)

    return {
      conversationId: storedConversationId,
      messages: cachedMessages || [],
      shouldLoadFromApi: !cachedMessages,
    }
  }

  const conversationId = createConversationId()
  persistConversationId(conversationId)

  return {
    conversationId,
    messages: [],
    shouldLoadFromApi: false,
  }
}

export default function useChat() {
  const [initialConversationState] = useState(getInitialConversationState)
  const [conversationId, setConversationId] = useState(initialConversationState.conversationId)
  const [messages, setMessages] = useState(initialConversationState.messages)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const activeAbortControllerRef = useRef(null)
  const activeAssistantMessageIdRef = useRef(null)
  const streamBufferRef = useRef('')
  const streamRevealTimerRef = useRef(null)

  const appendToAssistantMessage = useCallback((messageId, content) => {
    if (!content) return

    setMessages((prev) => prev.map((item) => (
      item.id === messageId
        ? { ...item, content: `${item.content}${content}` }
        : item
    )))
  }, [])

  const clearRevealTimer = useCallback(() => {
    if (streamRevealTimerRef.current) {
      window.clearTimeout(streamRevealTimerRef.current)
      streamRevealTimerRef.current = null
    }
  }, [])

  const revealBufferedText = useCallback(() => {
    streamRevealTimerRef.current = null

    const messageId = activeAssistantMessageIdRef.current
    if (!messageId || !streamBufferRef.current) {
      return
    }

    const nextText = streamBufferRef.current.slice(0, STREAM_REVEAL_CHARS)
    streamBufferRef.current = streamBufferRef.current.slice(STREAM_REVEAL_CHARS)
    appendToAssistantMessage(messageId, nextText)

    if (streamBufferRef.current) {
      streamRevealTimerRef.current = window.setTimeout(
        revealBufferedText,
        STREAM_REVEAL_INTERVAL_MS
      )
    }
  }, [appendToAssistantMessage])

  const scheduleBufferedReveal = useCallback(() => {
    if (!streamRevealTimerRef.current) {
      streamRevealTimerRef.current = window.setTimeout(
        revealBufferedText,
        STREAM_REVEAL_INTERVAL_MS
      )
    }
  }, [revealBufferedText])

  const enqueueStreamChunk = useCallback((content) => {
    streamBufferRef.current += content
    scheduleBufferedReveal()
  }, [scheduleBufferedReveal])

  const flushBufferedText = useCallback(() => {
    clearRevealTimer()

    const messageId = activeAssistantMessageIdRef.current
    const bufferedText = streamBufferRef.current
    streamBufferRef.current = ''

    if (messageId && bufferedText) {
      appendToAssistantMessage(messageId, bufferedText)
    }
  }, [appendToAssistantMessage, clearRevealTimer])

  const discardBufferedText = useCallback(() => {
    clearRevealTimer()
    streamBufferRef.current = ''
  }, [clearRevealTimer])

  useEffect(() => {
    if (!initialConversationState.shouldLoadFromApi) {
      return undefined
    }

    let isMounted = true

    async function loadStoredConversation() {
      try {
        const {
          conversationId: loadedConversationId,
          messages: loadedMessages,
        } = await loadConversationMessages(conversationId)

        if (!isMounted) return

        persistConversationId(loadedConversationId)
        persistConversationMessages(loadedConversationId, loadedMessages)
        setConversationId(loadedConversationId)
        setMessages(loadedMessages)
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message)
        }
      }
    }

    loadStoredConversation()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => () => {
    activeAbortControllerRef.current?.abort()
    clearRevealTimer()
  }, [clearRevealTimer])

  const stopGenerating = useCallback(() => {
    const messageId = activeAssistantMessageIdRef.current

    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    discardBufferedText()

    if (messageId) {
      setMessages((prev) => prev.map((item) => (
        item.id === messageId
          ? { ...item, isStreaming: false, isStopped: true }
          : item
      )))
    }

    setIsLoading(false)
    setIsStreaming(false)
    activeAssistantMessageIdRef.current = null
  }, [discardBufferedText])

  const sendMessage = async (message) => {
    const userMessage = { role: 'user', content: message }
    const assistantMessageId = createConversationId()
    const abortController = new AbortController()
    const streamingAssistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    activeAbortControllerRef.current = abortController
    activeAssistantMessageIdRef.current = assistantMessageId
    discardBufferedText()
    setMessages((prev) => [...prev, userMessage, streamingAssistantMessage])
    setIsLoading(true)
    setIsStreaming(true)
    setError(null)

    try {
      const {
        conversationId: returnedConversationId,
        response,
        metadata,
      } = await streamChatMessage({
        message,
        conversationId,
        signal: abortController.signal,
        onStart: ({ conversationId: startedConversationId }) => {
          if (!startedConversationId) return

          persistConversationId(startedConversationId)
          setConversationId(startedConversationId)
        },
        onChunk: (content) => {
          enqueueStreamChunk(content)
        },
        onReplace: (content) => {
          discardBufferedText()
          setMessages((prev) => prev.map((item) => (
            item.id === assistantMessageId
              ? { ...item, content }
              : item
          )))
        },
      })
      flushBufferedText()
      persistConversationId(returnedConversationId)
      setConversationId(returnedConversationId)
      setMessages((prev) => {
        const assistantMessage = createAssistantMessage(response, metadata)
        const nextMessages = prev.map((item) => (
          item.id === assistantMessageId
            ? assistantMessage
            : item
        ))
        persistConversationMessages(returnedConversationId, nextMessages)
        return nextMessages
      })
    } catch (requestError) {
      if (isAbortError(requestError) || abortController.signal.aborted) {
        discardBufferedText()
        setMessages((prev) => prev.map((item) => (
          item.id === assistantMessageId
            ? { ...item, isStreaming: false, isStopped: true }
            : item
        )))
        return
      }

      setError(requestError.message)
      setMessages((prev) => prev.map((item) => (
        item.id === assistantMessageId
          ? {
              role: 'assistant',
              content: REQUEST_FAILURE_MESSAGE,
              isError: true,
            }
          : item
      )))
    } finally {
      const isCurrentRequest = activeAbortControllerRef.current === abortController

      if (isCurrentRequest) {
        activeAbortControllerRef.current = null
        activeAssistantMessageIdRef.current = null
        setIsLoading(false)
        setIsStreaming(false)
      }
    }
  }

  return {
    conversationId,
    messages,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopGenerating,
  }
}
