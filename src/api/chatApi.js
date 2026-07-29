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

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/)
  let event = 'message'
  const dataLines = []

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue
    }

    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
      continue
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    }
  }

  const rawData = dataLines.join('\n')
  let data = {}

  if (rawData) {
    data = JSON.parse(rawData)
  }

  return { event, data }
}

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

async function readSseStream(stream, onEvent) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })

    let separatorIndex = buffer.search(/\r?\n\r?\n/)

    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex)
      const separatorLength = buffer[separatorIndex] === '\r' ? 4 : 2
      buffer = buffer.slice(separatorIndex + separatorLength)

      if (block.trim()) {
        onEvent(parseSseBlock(block))
      }

      separatorIndex = buffer.search(/\r?\n\r?\n/)
    }

    if (done) {
      break
    }
  }

  if (buffer.trim()) {
    onEvent(parseSseBlock(buffer))
  }
}

export async function streamChatMessage({
  message,
  conversationId,
  customerContext,
  conversationContext,
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
      conversationContext,
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

  let finalResult = null

  await readSseStream(response.body, ({ event, data }) => {
    if (event === 'start') {
      onStart?.(data)
      return
    }

    if (event === 'chunk') {
      if (typeof data.content !== 'string') {
        throw new Error('Unexpected stream chunk')
      }

      onChunk?.(data.content)
      return
    }

    if (event === 'replace') {
      if (typeof data.content !== 'string') {
        throw new Error('Unexpected stream replacement')
      }

      onReplace?.(data.content)
      return
    }

    if (event === 'done') {
      if (typeof data.response !== 'string') {
        throw new Error('Unexpected stream completion')
      }

      finalResult = {
        conversationId: data.conversationId || conversationId,
        response: data.response,
        sources: Array.isArray(data.sources) ? data.sources : [],
        metadata: data.meta || {},
      }
      return
    }

    if (event === 'error') {
      if (data.code === 'QUOTA_EXCEEDED' && !data.message) {
        throw new Error(API_QUOTA_ERROR_MESSAGE)
      }

      throw new Error(data.message || 'Failed to stream response')
    }
  })

  if (!finalResult) {
    throw new Error('Stream ended before completion')
  }

  return finalResult
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

  if (!Array.isArray(messages)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return {
    conversationId: responseConversationId || conversationId,
    messages,
    meta: data.meta || {},
  }
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

  if (!Array.isArray(messages)) {
    throw new Error(API_FALLBACK_ERROR_MESSAGE)
  }

  return {
    conversationId: conversationId || null,
    messages,
    meta: data.meta || {},
  }
}
