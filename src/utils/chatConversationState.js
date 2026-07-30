import {
  CHAT_STORAGE_KEY,
  readJsonStorage,
  removeStorageItem,
  writeJsonStorage,
} from './storage.js'

export const CHAT_STATE_VERSION = 2

const CONVERSATION_CONTEXT_KEYS = [
  'conversationSource',
  'conversationType',
  'entrySource',
  'reservationEntry',
  'reservation',
  'conversationId',
  'selectedTour',
  'selectedTourId',
  'selectedTransportation',
  'participants',
]

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeOptionalObject(value) {
  return value === null || value === undefined ? null : (isObject(value) ? value : undefined)
}

export function createConversationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function normalizeChatAuth(authInput) {
  if (typeof authInput === 'string') {
    return {
      token: authInput,
      getAccessToken: null,
      user: null,
      userId: null,
      role: authInput ? 'customer' : 'visitor',
    }
  }

  const role = authInput?.role || authInput?.user?.role || (authInput?.token ? 'customer' : 'visitor')
  return {
    token: authInput?.token || null,
    getAccessToken: authInput?.getAccessToken || null,
    user: authInput?.user || null,
    userId: authInput?.user?.id ? String(authInput.user.id) : null,
    role,
  }
}

function getChatStorageKey(userId) {
  return userId ? `${CHAT_STORAGE_KEY}.${userId}` : CHAT_STORAGE_KEY
}

function normalizeStoredMessage(message) {
  if (!isObject(message) || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
    return null
  }

  const legacyMetadata = message.metadata ?? message.meta
  if (legacyMetadata !== undefined && !isObject(legacyMetadata)) {
    return null
  }

  const {
    audioUrl: legacyAudioUrl,
    audioResponseUrl: legacyAudioResponseUrl,
    ...canonicalMetadata
  } = legacyMetadata || {}
  const { meta, metadata: ignoredMetadata, ...canonicalMessage } = message
  return {
    ...canonicalMessage,
    ...(canonicalMessage.audioUrl || legacyAudioUrl
      ? { audioUrl: canonicalMessage.audioUrl || legacyAudioUrl }
      : {}),
    ...(canonicalMessage.audioResponseUrl || legacyAudioResponseUrl
      ? { audioResponseUrl: canonicalMessage.audioResponseUrl || legacyAudioResponseUrl }
      : {}),
    ...(Object.keys(canonicalMetadata).length > 0
      ? { metadata: canonicalMetadata }
      : {}),
  }
}

function discardStoredState(storageKey) {
  removeStorageItem(storageKey)
  return null
}

export function getStoredChatState(userId) {
  const storageKey = getChatStorageKey(userId)
  const storedState = readJsonStorage(storageKey)
  if (storedState === null) {
    try {
      return window.localStorage.getItem(storageKey) === null
        ? null
        : discardStoredState(storageKey)
    } catch {
      return null
    }
  }
  if (!isObject(storedState)) return discardStoredState(storageKey)

  const storedUserId = storedState.userId ? String(storedState.userId) : null
  if (userId && storedUserId && storedUserId !== String(userId)) return null
  if (storedState.conversationId !== null
    && storedState.conversationId !== undefined
    && typeof storedState.conversationId !== 'string') {
    return discardStoredState(storageKey)
  }
  if (storedState.version !== undefined && storedState.version !== CHAT_STATE_VERSION) {
    return discardStoredState(storageKey)
  }

  const legacyContainer = storedState.meta ?? storedState.metadata ?? storedState.conversationMeta
  const conversationContext = storedState.conversationContext ?? legacyContainer ?? {}
  const customerContext = storedState.customerContext ?? legacyContainer?.customerContext ?? null
  const normalizedCustomerContext = normalizeOptionalObject(customerContext)

  if (!isObject(conversationContext) || normalizedCustomerContext === undefined) {
    return discardStoredState(storageKey)
  }

  if (storedState.messages !== undefined && !Array.isArray(storedState.messages)) {
    return discardStoredState(storageKey)
  }

  const messages = storedState.messages?.map(normalizeStoredMessage)
  if (messages?.some((message) => message === null)) {
    return discardStoredState(storageKey)
  }

  const { customerContext: ignoredLegacyCustomerContext, savedAt: ignoredLegacySavedAt, ...cleanContext } = conversationContext

  return {
    conversationId: storedState.conversationId || null,
    userId: storedUserId,
    customerContext: normalizedCustomerContext,
    conversationContext: cleanContext,
    messages,
    hasStoredMessages: Array.isArray(storedState.messages),
  }
}

export function persistChatState({
  conversationId,
  customerContext,
  conversationContext,
  messages,
  userId,
  shouldPersist = true,
} = {}) {
  if (!shouldPersist) return

  writeJsonStorage(getChatStorageKey(userId), {
    version: CHAT_STATE_VERSION,
    conversationId,
    customerContext: customerContext || null,
    conversationContext: conversationContext || {},
    messages: Array.isArray(messages) ? messages : [],
    savedAt: new Date().toISOString(),
  })
}

export function partitionAssistantMetadata(metadata = {}) {
  if (!isObject(metadata)) {
    return { conversationContext: {}, messageMetadata: {}, customerContext: null }
  }

  const conversationContext = {}
  const messageMetadata = {}
  let customerContext = null
  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'customerContext') customerContext = isObject(value) ? value : null
    else if (CONVERSATION_CONTEXT_KEYS.includes(key)) conversationContext[key] = value
    else messageMetadata[key] = value
  }
  return { conversationContext, messageMetadata, customerContext }
}

export function createAssistantMessage(response, metadata = {}) {
  return {
    role: 'assistant',
    content: response,
    ...(isObject(metadata) && Object.keys(metadata).length > 0 ? { metadata } : {}),
  }
}

export function getAssistantContinuationMetadata(messages = [], conversationContext = {}) {
  const messageMetadata = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.metadata)
    ?.metadata
  return { ...(messageMetadata || {}), ...(conversationContext || {}) }
}

export function getInitialConversationState(auth, options = {}) {
  if (options.isEphemeral) {
    return {
      conversationId: null,
      customerContext: options.initialCustomerContext || null,
      conversationContext: options.initialConversationContext || {},
      messages: [],
      shouldLoadFromApi: false,
      shouldLoadLatestFromApi: false,
      isHydrating: false,
    }
  }

  const storedState = getStoredChatState(auth.userId)
  if (storedState?.conversationId) {
    persistChatState({ ...storedState, userId: auth.userId })
    return {
      conversationId: storedState.conversationId,
      customerContext: storedState.customerContext,
      conversationContext: storedState.conversationContext || {},
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
      conversationContext: storedState?.conversationContext || {},
      messages: [],
      shouldLoadFromApi: false,
      shouldLoadLatestFromApi: true,
      isHydrating: true,
    }
  }

  const conversationId = createConversationId()
  const customerContext = storedState?.customerContext || null
  const conversationContext = storedState?.conversationContext || {}
  persistChatState({
    conversationId,
    customerContext,
    conversationContext,
    messages: [],
    userId: auth.userId,
  })
  return {
    conversationId,
    customerContext,
    conversationContext,
    messages: [],
    shouldLoadFromApi: false,
    shouldLoadLatestFromApi: false,
    isHydrating: false,
  }
}
