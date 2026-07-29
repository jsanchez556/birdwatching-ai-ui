import { TextDecoder, TextEncoder } from 'util'
import { ReadableStream } from 'stream/web'
import { loadConversationMessages, loadLatestConversation, streamChatMessage } from '../chatApi'

global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder

describe('chatApi conversation hydration', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  test('loads a specific conversation through the normalized envelope', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          conversationId: 'conversation-123',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
          ],
        },
        meta: {
          reservation: { reservationId: 42 },
        },
      }),
    })

    await expect(loadConversationMessages('conversation-123', { token: 'token-1' })).resolves.toEqual({
      conversationId: 'conversation-123',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ],
      conversationContext: {
        reservation: { reservationId: 42 },
      },
      customerContext: null,
    })
    expect(global.fetch).toHaveBeenCalledWith('/chat/conversation-123', {
      headers: {
        Authorization: 'Bearer token-1',
      },
    })
  })

  test('uses the agreed fallback message when the latest conversation envelope is malformed', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          conversationId: null,
          messages: [],
        },
      }),
    })

    await expect(loadLatestConversation({ token: 'token-1' })).rejects.toThrow(
      'Something went wrong. Please try again.'
    )
  })

  test('uses meta.message when the backend reports an unsuccessful response', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        data: null,
        meta: {
          message: 'Please log in again.',
        },
      }),
    })

    await expect(loadLatestConversation({ token: 'token-1' })).rejects.toThrow('Please log in again.')
  })

  test('rejects malformed hydrated message metadata at the API boundary', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          conversationId: 'conversation-invalid',
          messages: [{
            role: 'assistant',
            content: 'Partial content must not render.',
            metadata: 'invalid',
          }],
        },
        meta: {},
      }),
    })

    await expect(loadConversationMessages('conversation-invalid')).rejects.toThrow(
      'Something went wrong. Please try again.'
    )
  })

  test('streams chat with reservation-entry context in the request body', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode([
          'event: done',
          'data: {"conversationId":"conversation-123","response":"Ready","sources":[],"meta":{}}',
          '',
          '',
        ].join('\n')))
        controller.close()
      },
    })
    global.fetch.mockResolvedValue({
      ok: true,
      body: stream,
    })

    await expect(streamChatMessage({
      message: 'I would like to reserve Direct Reserve Tour.',
      conversationId: 'conversation-123',
      customerContext: {
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
      },
      conversationContext: {
        entrySource: 'featured_tour',
      },
      assistantMetadata: {
        conversationType: 'reservation_entry',
        conversationSource: 'featured_tour',
        selectedTourId: 16,
      },
      role: 'customer',
      token: 'token-1',
    })).resolves.toMatchObject({
      conversationId: 'conversation-123',
      response: 'Ready',
    })

    const [, request] = global.fetch.mock.calls[0]
    expect(JSON.parse(request.body)).toMatchObject({
      message: 'I would like to reserve Direct Reserve Tour.',
      conversationContext: {
        entrySource: 'featured_tour',
        recentAssistantMetadata: {
          conversationType: 'reservation_entry',
          conversationSource: 'featured_tour',
          selectedTourId: 16,
        },
      },
    })
  })

  test('normalizes legacy message meta and separates envelope context', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          conversationId: 'conversation-legacy',
          messages: [{
            role: 'assistant',
            content: 'Confirmed.',
            meta: {
              uiAction: { type: 'choice' },
              audioUrl: 'https://cdn.example.com/voice.mp3',
            },
          }],
        },
        meta: {
          customerContext: { customerName: 'Ana' },
          reservation: { confirmationCode: 'BW-1' },
        },
      }),
    })

    await expect(loadConversationMessages('conversation-legacy')).resolves.toEqual({
      conversationId: 'conversation-legacy',
      customerContext: { customerName: 'Ana' },
      conversationContext: {
        reservation: { confirmationCode: 'BW-1' },
      },
      messages: [{
        role: 'assistant',
        content: 'Confirmed.',
        audioUrl: 'https://cdn.example.com/voice.mp3',
        metadata: {
          uiAction: { type: 'choice' },
        },
      }],
    })
  })
})
