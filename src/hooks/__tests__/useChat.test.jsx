import { act, renderHook } from '@testing-library/react'
import useChat from '../useChat'
import { loadConversationMessages, loadLatestConversation, streamChatMessage } from '../../api/chatApi'

jest.mock('../../api/chatApi', () => ({
  loadConversationMessages: jest.fn(),
  loadLatestConversation: jest.fn(),
  streamChatMessage: jest.fn(),
}))

function createAbortError() {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  error.code = 'ABORT_ERR'
  return error
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

describe('useChat streaming behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    window.localStorage.clear()
    loadConversationMessages.mockResolvedValue({
      conversationId: 'conversation-123',
      messages: [],
    })
    loadLatestConversation.mockResolvedValue({
      conversationId: null,
      messages: [],
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  test('reveals streamed text gradually and finalizes completed responses', async () => {
    const streamDone = deferred()
    streamChatMessage.mockImplementation(async ({ onStart, onChunk }) => {
      onStart({ conversationId: 'conversation-123' })
      onChunk('abcdef')
      await streamDone.promise
      return {
        conversationId: 'conversation-123',
        response: 'abcdef',
        metadata: {},
      }
    })

    const { result } = renderHook(() => useChat())

    let sendPromise
    await act(async () => {
      sendPromise = result.current.sendMessage('Where are quetzals?')
    })

    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: '',
      isStreaming: true,
    })

    act(() => {
      jest.advanceTimersByTime(28)
    })

    expect(result.current.messages[1].content).toBe('abc')

    await act(async () => {
      streamDone.resolve()
      await sendPromise
    })

    expect(result.current.messages[1]).toEqual({
      role: 'assistant',
      content: 'abcdef',
    })
  })

  test('persists conversation, messages, and customer context under one localStorage key', async () => {
    streamChatMessage.mockImplementation(async ({ onStart }) => {
      onStart({ conversationId: 'conversation-123' })
      return {
        conversationId: 'conversation-123',
        response: 'Done',
        metadata: {},
      }
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      result.current.setCustomerContext({
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
        itineraryStartDate: '2026-06-12',
        itineraryEndDate: '2026-06-15',
      })
    })

    await act(async () => {
      await result.current.sendMessage('Find tours')
    })

    const storageKeys = Object.keys(window.localStorage)
    expect(storageKeys).toEqual(['birdwatchingAI.chatState'])

    const persisted = JSON.parse(window.localStorage.getItem('birdwatchingAI.chatState'))
    expect(persisted).toMatchObject({
      conversationId: 'conversation-123',
      meta: {
        customerContext: {
          customerName: 'Ana Gomez',
          customerEmail: 'ana@example.com',
        },
      },
    })
    expect(persisted.messages).toEqual([
      { role: 'user', content: 'Find tours' },
      { role: 'assistant', content: 'Done' },
    ])
  })

  test('stores reservation data under chat-level metadata', async () => {
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Your reservation is confirmed.',
      metadata: {
        participants: 3,
        reservation: {
          confirmationCode: 'BW-METAONLY',
          reservationId: 11,
        },
      },
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Confirm reservation')
    })

    expect(result.current.messages[1]).toEqual({
      role: 'assistant',
      content: 'Your reservation is confirmed.',
    })
    expect(result.current.conversationMeta).toMatchObject({
      participants: 3,
      reservation: {
        confirmationCode: 'BW-METAONLY',
        reservationId: 11,
      },
    })
    expect(result.current.messages[1].metadata).toBeUndefined()
    expect(result.current.messages[1].reservation).toBeUndefined()
  })

  test('sends recent assistant metadata as conversation context', async () => {
    window.localStorage.setItem('birdwatchingAI.chatState', JSON.stringify({
      conversationId: 'conversation-123',
      meta: {
        customerContext: {
          customerName: 'Ana Gomez',
          customerEmail: 'ana@example.com',
        },
        selectedTourId: 1,
        participants: 3,
      },
      messages: [
        {
          role: 'assistant',
          content: 'I found 1 tour.',
          metadata: {
            tours: [{ tourId: 1, name: 'Monteverde Quetzal Tour' }],
            uiAction: { type: 'choice' },
          },
        },
      ],
    }))
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Details',
      metadata: {},
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Show me details')
    })

    expect(streamChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      conversationContext: {
        recentAssistantMetadata: {
          tours: [{ tourId: 1, name: 'Monteverde Quetzal Tour' }],
          uiAction: { type: 'choice' },
          selectedTourId: 1,
          participants: 3,
        },
      },
    }))
  })

  test('passes auth token to chat requests', async () => {
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Done',
      metadata: {},
    })

    const { result } = renderHook(() => useChat('auth-token'))

    await act(async () => {
      await result.current.sendMessage('Find quetzals')
    })

    expect(streamChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      token: 'auth-token',
    }))
  })

  test('marks unauthenticated chat requests as visitor role', async () => {
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Toucans have large bills.',
      metadata: {},
    })

    const { result } = renderHook(() => useChat({
      user: {
        id: 'visitor',
        role: 'visitor',
      },
    }))

    await act(async () => {
      await result.current.sendMessage('Tell me about toucans')
    })

    expect(streamChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      role: 'visitor',
      token: null,
    }))
  })

  test('loads latest backend conversation before generating an authenticated conversation ID', async () => {
    loadLatestConversation.mockResolvedValue({
      conversationId: 'conversation-from-db',
      messages: [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' },
      ],
    })

    const { result } = renderHook(() => useChat({
      token: 'auth-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
      },
    }))

    expect(result.current.conversationId).toBeNull()

    await act(async () => {
      await Promise.resolve()
    })

    expect(loadLatestConversation).toHaveBeenCalledWith({ token: 'auth-token' })
    expect(result.current.conversationId).toBe('conversation-from-db')
    expect(result.current.messages).toEqual([
      { role: 'user', content: 'Previous question' },
      { role: 'assistant', content: 'Previous answer' },
    ])

    const persisted = JSON.parse(window.localStorage.getItem('birdwatchingAI.chatState.user-1'))
    expect(persisted).toMatchObject({
      conversationId: 'conversation-from-db',
    })
    expect(persisted.userId).toBeUndefined()
  })

  test('generates an authenticated conversation ID only after latest lookup is empty', async () => {
    loadLatestConversation.mockResolvedValue({
      conversationId: null,
      messages: [],
    })

    const { result } = renderHook(() => useChat({
      token: 'auth-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
      },
    }))

    expect(result.current.conversationId).toBeNull()

    await act(async () => {
      await Promise.resolve()
    })

    expect(loadLatestConversation).toHaveBeenCalledWith({ token: 'auth-token' })
    expect(result.current.conversationId).toEqual(expect.any(String))
    expect(result.current.messages).toEqual([])
  })

  test('restores authenticated chat state from a user-scoped key', () => {
    window.localStorage.setItem('birdwatchingAI.chatState.user-1', JSON.stringify({
      conversationId: 'conversation-user-1',
      meta: {
        customerContext: {
          customerName: 'Ana Gomez',
          customerEmail: 'ana@example.com',
        },
      },
      messages: [
        { role: 'user', content: 'Scoped message' },
      ],
    }))

    const { result } = renderHook(() => useChat({
      token: 'auth-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
      },
    }))

    expect(result.current.conversationId).toBe('conversation-user-1')
    expect(result.current.messages).toEqual([
      { role: 'user', content: 'Scoped message' },
    ])
    expect(loadLatestConversation).not.toHaveBeenCalled()
  })

  test('does not reuse another authenticated user local chat state', async () => {
    window.localStorage.setItem('birdwatchingAI.chatState.user-1', JSON.stringify({
      userId: 'user-1',
      conversationId: 'conversation-user-1',
      messages: [
        { role: 'user', content: 'Other user message' },
      ],
    }))
    loadLatestConversation.mockResolvedValue({
      conversationId: null,
      messages: [],
    })

    const { result } = renderHook(() => useChat({
      token: 'auth-token-2',
      user: {
        id: 'user-2',
        email: 'maria@example.com',
      },
    }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.messages).toEqual([])
    expect(window.localStorage.getItem('birdwatchingAI.chatState.user-2')).toBeTruthy()
    expect(loadLatestConversation).toHaveBeenCalledWith({ token: 'auth-token-2' })
  })

  test('stops an in-progress stream and keeps visible partial text', async () => {
    streamChatMessage.mockImplementation(({ signal, onStart, onChunk }) => {
      onStart({ conversationId: 'conversation-123' })
      onChunk('abcdef')

      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(createAbortError())
        })
      })
    })

    const { result } = renderHook(() => useChat())

    let sendPromise
    await act(async () => {
      sendPromise = result.current.sendMessage('Tell me about toucans.')
    })

    act(() => {
      jest.advanceTimersByTime(28)
    })

    expect(result.current.messages[1].content).toBe('abc')

    await act(async () => {
      result.current.stopGenerating()
      await sendPromise
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'abc',
      isStopped: true,
      isStreaming: false,
    })
  })
})
