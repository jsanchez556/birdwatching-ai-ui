const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${apiBaseUrl}${path}`
}

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
  signal,
  onStart,
  onChunk,
  onReplace,
}) {
  const response = await fetch(apiUrl('/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, conversationId }),
    signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const errorMessage = data.error?.message || data.error || 'Failed to stream response'
    throw new Error(errorMessage)
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
      throw new Error(data.message || 'Failed to stream response')
    }
  })

  if (!finalResult) {
    throw new Error('Stream ended before completion')
  }

  return finalResult
}

export async function loadConversationMessages(conversationId) {
  const response = await fetch(apiUrl(`/chat/${encodeURIComponent(conversationId)}`))
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMessage = data.error?.message || data.error || 'Failed to load conversation'
    throw new Error(errorMessage)
  }

  if (!data.success || !data.data) {
    throw new Error('Unexpected conversation response format')
  }

  const { conversationId: responseConversationId, messages } = data.data

  if (!Array.isArray(messages)) {
    throw new Error('Unexpected conversation response')
  }

  return {
    conversationId: responseConversationId || conversationId,
    messages,
  }
}
