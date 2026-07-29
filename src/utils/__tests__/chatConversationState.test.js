import {
  CHAT_STATE_VERSION,
  getInitialConversationState,
  getStoredChatState,
  persistChatState,
} from '../chatConversationState'

describe('chat conversation persistence boundary', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('normalizes the legacy meta container and message meta alias', () => {
    window.localStorage.setItem('birdwatchingAI.chatState', JSON.stringify({
      conversationId: 'conversation-legacy',
      meta: {
        customerContext: {
          customerName: 'Ana',
          itineraryStartDate: '2026-08-01',
        },
        selectedTourId: 12,
      },
      messages: [{
        role: 'assistant',
        content: 'Here is your tour.',
        meta: {
          uiAction: { type: 'choice' },
          audioUrl: 'https://cdn.example.com/voice.mp3',
        },
      }],
    }))

    expect(getStoredChatState()).toEqual({
      conversationId: 'conversation-legacy',
      userId: null,
      customerContext: {
        customerName: 'Ana',
        itineraryStartDate: '2026-08-01',
      },
      conversationContext: {
        selectedTourId: 12,
      },
      messages: [{
        role: 'assistant',
        content: 'Here is your tour.',
        audioUrl: 'https://cdn.example.com/voice.mp3',
        metadata: {
          uiAction: { type: 'choice' },
        },
      }],
      hasStoredMessages: true,
    })
  })

  test.each([
    ['invalid JSON', '{invalid'],
    ['invalid messages', JSON.stringify({ conversationId: 'bad', messages: {} })],
    ['unknown version', JSON.stringify({ version: 99, conversationId: 'bad', messages: [] })],
    ['invalid message metadata', JSON.stringify({
      conversationId: 'bad',
      messages: [{ role: 'assistant', content: 'Hello', metadata: 'invalid' }],
    })],
  ])('discards %s and returns no conversation', (_label, storedValue) => {
    window.localStorage.setItem('birdwatchingAI.chatState', storedValue)

    expect(getStoredChatState()).toBeNull()
    expect(window.localStorage.getItem('birdwatchingAI.chatState')).toBeNull()
  })

  test('writes only the canonical versioned shape', () => {
    persistChatState({
      conversationId: 'conversation-2',
      customerContext: { customerName: 'Ana' },
      conversationContext: { participants: 2 },
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(JSON.parse(window.localStorage.getItem('birdwatchingAI.chatState'))).toMatchObject({
      version: CHAT_STATE_VERSION,
      conversationId: 'conversation-2',
      customerContext: { customerName: 'Ana' },
      conversationContext: { participants: 2 },
      messages: [{ role: 'user', content: 'Hello' }],
    })
  })

  test('falls back to an empty conversation after malformed hydration', () => {
    window.localStorage.setItem('birdwatchingAI.chatState', JSON.stringify({
      conversationId: 'broken',
      messages: [{ role: 'assistant', content: null }],
    }))

    const state = getInitialConversationState({
      token: null,
      userId: null,
    })

    expect(state).toMatchObject({
      customerContext: null,
      conversationContext: {},
      messages: [],
      isHydrating: false,
    })
    expect(state.conversationId).not.toBe('broken')
  })
})
