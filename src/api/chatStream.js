import { partitionAssistantMetadata } from '../utils/chatConversationState'

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
  return {
    event,
    data: rawData ? JSON.parse(rawData) : {},
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

export async function consumeChatSseStream({
  stream,
  conversationId,
  onStart,
  onChunk,
  onReplace,
  quotaErrorMessage,
}) {
  let finalResult = null

  await readSseStream(stream, ({ event, data }) => {
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

      const {
        conversationContext,
        messageMetadata,
        customerContext,
      } = partitionAssistantMetadata(data.meta)
      finalResult = {
        conversationId: data.conversationId || conversationId,
        response: data.response,
        sources: Array.isArray(data.sources) ? data.sources : [],
        conversationContext,
        messageMetadata,
        customerContext,
      }
      return
    }

    if (event === 'error') {
      if (data.code === 'QUOTA_EXCEEDED' && !data.message && quotaErrorMessage) {
        throw new Error(quotaErrorMessage)
      }

      throw new Error(data.message || 'Failed to stream response')
    }
  })

  if (!finalResult) {
    throw new Error('Stream ended before completion')
  }
  return finalResult
}
