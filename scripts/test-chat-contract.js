import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { consumeChatSseStream } from '../src/api/chatStream.js'

function readArgument(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

class CapturedSseResponse {
  constructor() {
    this.destroyed = false
    this.writableEnded = false
    this.chunks = []
  }

  write(value) {
    this.chunks.push(new TextEncoder().encode(value))
    return true
  }

  toReadableStream() {
    const chunks = this.chunks
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })
  }
}

async function loadApiProducers(apiRoot) {
  const chatSsePath = path.resolve(apiRoot, 'src/api/streaming/chatSse.js')

  if (existsSync(chatSsePath)) {
    return import(pathToFileURL(chatSsePath).href)
  }

  // Supports the first cross-repository rollout before chat-specific wrappers
  // exist on the API default branch. The final contract uses those wrappers.
  const ssePath = path.resolve(apiRoot, 'src/api/streaming/sse.js')
  const { sendSseEvent } = await import(pathToFileURL(ssePath).href)
  return {
    sendChatStreamStart: (res, data) => sendSseEvent(res, 'start', data),
    sendChatStreamChunk: (res, content) => sendSseEvent(res, 'chunk', { content }),
    sendChatStreamCompletion: (res, result) => sendSseEvent(res, 'done', {
      conversationId: result.conversationId,
      response: result.response,
      sources: result.sources || [],
      meta: result.meta || {},
    }),
  }
}

async function run() {
  const defaultApiRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../birdwatching-ai-api'
  )
  const apiRoot = readArgument('--api-root') || defaultApiRoot
  const {
    sendChatStreamStart,
    sendChatStreamChunk,
    sendChatStreamCompletion,
  } = await loadApiProducers(apiRoot)

  const conversationId = 'contract-conversation-123'
  const assistantMetadata = {
    reservation: {
      reservationId: 42,
      confirmationCode: 'BW-CONTRACT-42',
      status: 'confirmed',
    },
    uiAction: {
      type: 'reservation_confirmation',
      label: 'View reservation',
    },
    tourRecommendation: {
      summary: 'I found one supported match.',
      recommendations: [{
        tourId: '12',
        tourName: 'Monteverde Quetzal Tour',
        location: 'Monteverde',
        estimatedPrice: { amount: 120, currency: 'USD' },
        matchReasons: ['Matches Monteverde'],
        availabilityStatus: 'available',
        confidence: 0.94,
      }],
      sources: [],
      assumptions: [],
      followUpQuestion: null,
    },
  }
  const response = new CapturedSseResponse()

  sendChatStreamStart(response, {
    conversationId,
    sources: [],
    meta: { promptVersions: { chat: 'contract-test' } },
  })
  sendChatStreamChunk(response, 'Your reservation ')
  sendChatStreamChunk(response, 'is confirmed.')
  sendChatStreamCompletion(response, {
    conversationId,
    response: 'Your reservation is confirmed.',
    sources: [],
    meta: assistantMetadata,
  })

  const starts = []
  const chunks = []
  const normalized = await consumeChatSseStream({
    stream: response.toReadableStream(),
    conversationId: 'client-fallback-conversation',
    onStart: (data) => starts.push(data),
    onChunk: (content) => chunks.push(content),
  })

  assert.deepEqual(starts, [{
    conversationId,
    sources: [],
    meta: { promptVersions: { chat: 'contract-test' } },
  }])
  assert.equal(chunks.join(''), 'Your reservation is confirmed.')
  assert.deepEqual(normalized, {
    conversationId,
    response: 'Your reservation is confirmed.',
    sources: [],
    conversationContext: {
      reservation: assistantMetadata.reservation,
    },
    messageMetadata: {
      uiAction: assistantMetadata.uiAction,
      tourRecommendation: assistantMetadata.tourRecommendation,
    },
    customerContext: null,
  })

  console.log('PASS: API-produced /chat SSE is normalized by the UI streaming adapter.')
}

run().catch((error) => {
  console.error(`CHAT CONTRACT FAILURE: ${error.message}`)
  process.exitCode = 1
})
