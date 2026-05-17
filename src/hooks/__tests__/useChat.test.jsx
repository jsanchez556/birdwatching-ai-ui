import { act, renderHook } from '@testing-library/react'
import useChat from '../useChat'
import { loadConversationMessages, streamChatMessage } from '../../api/chatApi'

jest.mock('../../api/chatApi', () => ({
  loadConversationMessages: jest.fn(),
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
      customerContext: {
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
      },
    })
    expect(persisted.messages).toEqual([
      { role: 'user', content: 'Find tours' },
      { role: 'assistant', content: 'Done' },
    ])
  })

  test('stores reservation data only under assistant metadata', async () => {
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Your reservation is confirmed.',
      metadata: {
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
      metadata: {
        reservation: {
          confirmationCode: 'BW-METAONLY',
          reservationId: 11,
        },
      },
    })
    expect(result.current.messages[1].reservation).toBeUndefined()
  })

  test('sends recent assistant metadata as conversation context', async () => {
    window.localStorage.setItem('birdwatchingAI.chatState', JSON.stringify({
      conversationId: 'conversation-123',
      customerContext: {
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
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
        },
      },
    }))
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
