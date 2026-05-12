import { useEffect, useState } from 'react'
import { loadConversationMessages, sendChatMessage } from '../api/chatApi'

const REQUEST_FAILURE_MESSAGE = 'Sorry, something went wrong. Please try again.'
const CONVERSATION_ID_STORAGE_KEY = 'birdwatchingAI.conversationId'
const CONVERSATION_MESSAGES_STORAGE_PREFIX = 'birdwatchingAI.messages.'

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
  const [error, setError] = useState(null)

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

  const sendMessage = async (message) => {
    const userMessage = { role: 'user', content: message }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const {
        conversationId: returnedConversationId,
        response,
        metadata,
      } = await sendChatMessage({
        message,
        conversationId,
      })
      persistConversationId(returnedConversationId)
      setConversationId(returnedConversationId)
      setMessages((prev) => {
        const assistantMessage = {
          role: 'assistant',
          content: response,
          ...(hasMetadata(metadata)
            ? { metadata }
            : {}),
          ...(metadata?.reservation
            ? { reservation: metadata.reservation }
            : {}),
        }
        const nextMessages = [...prev, assistantMessage]
        persistConversationMessages(returnedConversationId, nextMessages)
        return nextMessages
      })
    } catch (requestError) {
      setError(requestError.message)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: REQUEST_FAILURE_MESSAGE, isError: true },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return {
    conversationId,
    messages,
    isLoading,
    error,
    sendMessage,
  }
}
