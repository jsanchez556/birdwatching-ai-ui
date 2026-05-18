import { useCallback, useEffect, useRef, useState } from 'react'
import { loadConversationMessages, loadLatestConversation, streamChatMessage } from '../api/chatApi'
import { CHAT_STORAGE_KEY, readJsonStorage, writeJsonStorage } from '../utils/storage'

const REQUEST_FAILURE_MESSAGE = 'Sorry, something went wrong. Please try again.'
const STREAM_REVEAL_INTERVAL_MS = 28
const STREAM_REVEAL_CHARS = 3
const CONVERSATION_METADATA_KEYS = [
  'customerContext',
  'reservation',
  'selectedTour',
  'selectedTourId',
  'selectedTransportation',
  'participants',
]

function createConversationId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getChatStorageKey(userId) {
  return userId ? `${CHAT_STORAGE_KEY}.${userId}` : CHAT_STORAGE_KEY
}

function normalizeAuth(authInput) {
  if (typeof authInput === 'string') {
    return {
      token: authInput,
      user: null,
      userId: null,
    }
  }

  return {
    token: authInput?.token || null,
    user: authInput?.user || null,
    userId: authInput?.user?.id ? String(authInput.user.id) : null,
  }
}

function getStoredChatState(userId) {
  const storedState = readJsonStorage(getChatStorageKey(userId))

  if (storedState && typeof storedState === 'object') {
    const storedUserId = storedState.userId ? String(storedState.userId) : null

    if (userId && storedUserId && storedUserId !== String(userId)) {
      return null
    }

    const storedMeta = storedState.meta || storedState.metadata || {}

    return {
      conversationId: typeof storedState.conversationId === 'string'
        ? storedState.conversationId
        : null,
      userId: storedUserId,
      customerContext: storedMeta.customerContext || storedState.customerContext || null,
      conversationMeta: storedMeta,
      messages: Array.isArray(storedState.messages) ? storedState.messages : undefined,
      hasStoredMessages: Array.isArray(storedState.messages),
    }
  }

  return null
}

function hasMetadata(metadata) {
  return metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0
}

function splitChatMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return {
      conversationMeta: {},
      messageMetadata: {},
    }
  }

  const conversationMeta = {}
  const messageMetadata = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (CONVERSATION_METADATA_KEYS.includes(key)) {
      conversationMeta[key] = value
    } else {
      messageMetadata[key] = value
    }
  }

  return {
    conversationMeta,
    messageMetadata,
  }
}

function createAssistantMessage(response, metadata = {}) {
  return {
    role: 'assistant',
    content: response,
    ...(hasMetadata(metadata)
      ? { metadata }
      : {}),
  }
}

function getRecentAssistantMetadata(messages = [], conversationMeta = {}) {
  const messageMetadata = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.metadata)
    ?.metadata
  const { customerContext, savedAt, ...conversationFlowMeta } = conversationMeta || {}

  return {
    ...(messageMetadata || {}),
    ...conversationFlowMeta,
  }
}

function persistChatState({
  conversationId,
  customerContext,
  conversationMeta,
  messages,
  userId,
} = {}) {
  writeJsonStorage(getChatStorageKey(userId), {
    conversationId,
    messages: Array.isArray(messages) ? messages : [],
    meta: {
      ...(conversationMeta || {}),
      customerContext: customerContext || conversationMeta?.customerContext || null,
      savedAt: new Date().toISOString(),
    },
  })
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'
}

function getInitialConversationState(auth) {
  const storedState = getStoredChatState(auth.userId)

  if (storedState?.conversationId) {
    persistChatState({
      ...storedState,
      userId: auth.userId,
    })

    return {
      conversationId: storedState.conversationId,
      customerContext: storedState.customerContext,
      conversationMeta: storedState.conversationMeta || {},
      messages: storedState.messages || [],
      shouldLoadFromApi: !storedState.hasStoredMessages,
      shouldLoadLatestFromApi: false,
      isHydrating: !storedState.hasStoredMessages,
    }
  }

  if (auth.userId && auth.token) {
    return {
      conversationId: null,
      customerContext: storedState?.customerContext || null,
      conversationMeta: storedState?.conversationMeta || {},
      messages: [],
      shouldLoadFromApi: false,
      shouldLoadLatestFromApi: true,
      isHydrating: true,
    }
  }

  const conversationId = createConversationId()
  const customerContext = storedState?.customerContext || null
  const conversationMeta = storedState?.conversationMeta || {}
  persistChatState({
    conversationId,
    customerContext,
    conversationMeta,
    messages: [],
    userId: auth.userId,
  })

  return {
    conversationId,
    customerContext,
    conversationMeta,
    messages: [],
    shouldLoadFromApi: false,
    shouldLoadLatestFromApi: false,
    isHydrating: false,
  }
}

export default function useChat(authInput) {
  const auth = normalizeAuth(authInput)
  const { token, userId } = auth
  const [initialConversationState] = useState(() => getInitialConversationState(auth))
  const [conversationId, setConversationId] = useState(initialConversationState.conversationId)
  const [messages, setMessages] = useState(initialConversationState.messages)
  const [customerContext, setCustomerContextState] = useState(initialConversationState.customerContext)
  const [conversationMeta, setConversationMeta] = useState(initialConversationState.conversationMeta || {})
  const [isHydrating, setIsHydrating] = useState(initialConversationState.isHydrating)
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
    if (!initialConversationState.shouldLoadFromApi && !initialConversationState.shouldLoadLatestFromApi) {
      return undefined
    }

    let isMounted = true

    async function loadStoredConversation() {
      try {
        const result = initialConversationState.shouldLoadLatestFromApi
          ? await loadLatestConversation({ token })
          : await loadConversationMessages(initialConversationState.conversationId, { token })

        if (!isMounted) return

        const loadedConversationId = result.conversationId || createConversationId()
        const loadedMessages = result.messages
        const loadedMeta = result.meta || {}
        const loadedCustomerContext = loadedMeta.customerContext || initialConversationState.customerContext

        persistChatState({
          conversationId: loadedConversationId,
          customerContext: loadedCustomerContext,
          conversationMeta: loadedMeta,
          messages: loadedMessages,
          userId,
        })
        setConversationId(loadedConversationId)
        setCustomerContextState(loadedCustomerContext)
        setConversationMeta(loadedMeta)
        setMessages(loadedMessages)
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message)
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false)
        }
      }
    }

    loadStoredConversation()

    return () => {
      isMounted = false
    }
  }, [
    initialConversationState.customerContext,
    initialConversationState.conversationId,
    initialConversationState.shouldLoadFromApi,
    initialConversationState.shouldLoadLatestFromApi,
    token,
    userId,
  ])

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

  const setCustomerContext = useCallback((nextCustomerContext) => {
    setCustomerContextState(nextCustomerContext)
    setConversationMeta((prev) => ({
      ...prev,
      customerContext: nextCustomerContext,
    }))
    persistChatState({
      conversationId,
      customerContext: nextCustomerContext,
      conversationMeta: {
        ...conversationMeta,
        customerContext: nextCustomerContext,
      },
      messages,
      userId,
    })
  }, [conversationId, conversationMeta, messages, userId])

  const sendMessage = async (message) => {
    const recentAssistantMetadata = getRecentAssistantMetadata(messages, conversationMeta)
    const activeConversationId = conversationId || createConversationId()
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
    setMessages((prev) => {
      const nextMessages = [...prev, userMessage, streamingAssistantMessage]
      persistChatState({
        conversationId: activeConversationId,
        customerContext,
        conversationMeta,
        messages: nextMessages,
        userId,
      })
      return nextMessages
    })
    if (!conversationId) {
      setConversationId(activeConversationId)
    }
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
        conversationId: activeConversationId,
        customerContext,
        conversationContext: {
          recentAssistantMetadata,
        },
        token,
        signal: abortController.signal,
        onStart: ({ conversationId: startedConversationId }) => {
          if (!startedConversationId) return

          persistChatState({
            conversationId: startedConversationId,
            customerContext,
            conversationMeta,
            messages,
            userId,
          })
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
      setConversationId(returnedConversationId)
      setMessages((prev) => {
        const { conversationMeta: nextConversationMeta, messageMetadata } = splitChatMetadata(metadata)
        const mergedConversationMeta = {
          ...conversationMeta,
          ...nextConversationMeta,
        }
        const assistantMessage = createAssistantMessage(response, messageMetadata)
        const nextMessages = prev.map((item) => (
          item.id === assistantMessageId
            ? assistantMessage
            : item
        ))
        setConversationMeta(mergedConversationMeta)
        persistChatState({
          conversationId: returnedConversationId,
          customerContext,
          conversationMeta: mergedConversationMeta,
          messages: nextMessages,
          userId,
        })
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
    isHydrating,
    error,
    customerContext,
    conversationMeta,
    setCustomerContext,
    sendMessage,
    stopGenerating,
  }
}
