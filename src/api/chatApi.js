import {
  apiUrl,
  authHeaders,
  API_FALLBACK_ERROR_MESSAGE,
  API_QUOTA_ERROR_MESSAGE,
  getApiErrorMessage,
  isObject,
  JSON_HEADERS,
  parseJsonResponse,
  validateEnvelope,
} from './http'
import { consumeChatSseStream } from './chatStream'
import { partitionAssistantMetadata } from '../utils/chatConversationState'
import { sanitizeTourRecommendationMetadata } from './tourRecommendationContract'

function assertSuccessfulEnvelope(data) {
  if (!validateEnvelope(data) || !isObject(data.meta)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  if (data.success !== true) {
    throw new Error(getApiErrorMessage(data, API_FALLBACK_ERROR_MESSAGE))
  }

  if (!isObject(data.data)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }
}

function normalizeHydratedMessage(message) {
  if (!isObject(message)
    || !['user', 'assistant'].includes(message.role)
    || typeof message.content !== 'string') {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  const metadata = message.metadata ?? message.meta
  if (metadata !== undefined && !isObject(metadata)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  const {
    audioUrl: legacyAudioUrl,
    audioResponseUrl: legacyAudioResponseUrl,
    ...canonicalMetadata
  } = sanitizeTourRecommendationMetadata(metadata) || {}
  const { meta, metadata: ignoredMetadata, ...canonicalMessage } = message
  return {
    ...canonicalMessage,
    ...(canonicalMessage.audioUrl || legacyAudioUrl
      ? { audioUrl: canonicalMessage.audioUrl || legacyAudioUrl }
      : {}),
    ...(canonicalMessage.audioResponseUrl || legacyAudioResponseUrl
      ? { audioResponseUrl: canonicalMessage.audioResponseUrl || legacyAudioResponseUrl }
      : {}),
    ...(Object.keys(canonicalMetadata).length > 0 ? { metadata: canonicalMetadata } : {}),
  }
}

function normalizeConversationResponse({ conversationId, messages, envelopeMeta }, fallbackConversationId = null) {
  if (!Array.isArray(messages)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  const {
    conversationContext,
    customerContext,
  } = partitionAssistantMetadata(sanitizeTourRecommendationMetadata(envelopeMeta))

  return {
    conversationId: conversationId || fallbackConversationId,
    messages: messages.map(normalizeHydratedMessage),
    conversationContext,
    customerContext,
  }
}

export async function streamChatMessage({
  message,
  conversationId,
  customerContext,
  conversationContext,
  assistantMetadata,
  role,
  token,
  signal,
  onStart,
  onChunk,
  onReplace,
}) {
  const response = await fetch(apiUrl('/chat'), {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Accept: 'text/event-stream',
      ...authHeaders(token),
    },
    body: JSON.stringify({
      message,
      conversationId,
      customerContext,
      conversationContext: {
        ...(conversationContext || {}),
        ...(assistantMetadata && Object.keys(assistantMetadata).length > 0
          ? { recentAssistantMetadata: assistantMetadata }
          : {}),
      },
      role,
    }),
    signal,
  })

  if (!response.ok) {
    const data = await parseJsonResponse(response)
    throw new Error(getApiErrorMessage(data, 'Failed to stream response'))
  }

  if (!response.body) {
    throw new Error('Streaming is not supported by this browser')
  }

  return consumeChatSseStream({
    stream: response.body,
    conversationId,
    onStart,
    onChunk,
    onReplace,
    quotaErrorMessage: API_QUOTA_ERROR_MESSAGE,
  })
}

export async function loadConversationMessages(conversationId, { token } = {}) {
  const response = await fetch(apiUrl(`/chat/${encodeURIComponent(conversationId)}`), {
    headers: authHeaders(token),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to load conversation'))
  }

  assertSuccessfulEnvelope(data)

  const { conversationId: responseConversationId, messages } = data.data
  return normalizeConversationResponse({
    conversationId: responseConversationId,
    messages,
    envelopeMeta: data.meta,
  }, conversationId)
}

export async function loadLatestConversation({ token } = {}) {
  const response = await fetch(apiUrl('/chat/latest'), {
    headers: authHeaders(token),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Failed to load latest conversation'))
  }

  assertSuccessfulEnvelope(data)

  const { conversationId, messages } = data.data

  if (conversationId !== null && conversationId !== undefined && typeof conversationId !== 'string') {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return normalizeConversationResponse({
    conversationId,
    messages,
    envelopeMeta: data.meta,
  })
}
