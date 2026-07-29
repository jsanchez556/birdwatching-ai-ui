import {
  API_FALLBACK_ERROR_MESSAGE,
  apiUrl,
  authHeaders,
  getApiErrorMessage,
  isObject,
  parseJsonResponse,
  validateEnvelope,
} from './http'
import { resolveMediaUrl } from './mediaApi'
import { partitionAssistantMetadata } from '../utils/chatConversationState'

function appendJsonHeader(headers, name, value) {
  if (value && isObject(value) && Object.keys(value).length > 0) {
    headers[name] = JSON.stringify(value)
  }
}

function assertVoiceChatEnvelope(data) {
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

export async function sendVoiceChat({
  audioBlob,
  conversationId,
  customerContext,
  conversationContext,
  assistantMetadata,
  role,
  responseMode = 'field_assistant',
  token,
  signal,
} = {}) {
  if (!audioBlob || typeof audioBlob.size !== 'number' || audioBlob.size <= 0) {
    throw new Error('Please record a voice message before sending.')
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': audioBlob.type || 'audio/wav',
    'X-Filename': 'voice-message.wav',
    ...authHeaders(token),
  }

  if (conversationId) {
    headers['X-Conversation-Id'] = conversationId
  }

  if (role) {
    headers['X-Role'] = role
  }

  if (responseMode) {
    headers['X-Response-Mode'] = responseMode
  }

  appendJsonHeader(headers, 'X-Customer-Context', customerContext)
  appendJsonHeader(headers, 'X-Conversation-Context', {
    ...(conversationContext || {}),
    ...(assistantMetadata && Object.keys(assistantMetadata).length > 0
      ? { recentAssistantMetadata: assistantMetadata }
      : {}),
  })

  const response = await fetch(apiUrl('/voice-chat'), {
    method: 'POST',
    headers,
    body: audioBlob,
    signal,
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Voice chat failed. Please try again.'))
  }

  assertVoiceChatEnvelope(data)

  const { transcript, answer, audioResponseUrl } = data.data

  if (typeof transcript !== 'string' || typeof answer !== 'string') {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  const {
    conversationContext: responseConversationContext,
    messageMetadata,
    customerContext: responseCustomerContext,
  } = partitionAssistantMetadata(data.meta)

  return {
    transcript,
    answer,
    audioUrl: typeof audioResponseUrl === 'string' && audioResponseUrl
      ? await resolveMediaUrl(audioResponseUrl)
      : '',
    audioResponseUrl: typeof audioResponseUrl === 'string' ? audioResponseUrl : '',
    conversationId: data.meta.conversationId || conversationId,
    conversationContext: responseConversationContext,
    messageMetadata,
    customerContext: responseCustomerContext,
  }
}
