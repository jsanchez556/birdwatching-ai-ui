import { act, renderHook } from '@testing-library/react'
import useChat from '../useChat'
import { loadConversationMessages, loadLatestConversation, streamChatMessage } from '../../api/chatApi'
import { sendVoiceChat } from '../../api/voiceChatApi'

jest.mock('../../api/chatApi', () => ({
  loadConversationMessages: jest.fn(),
  loadLatestConversation: jest.fn(),
  streamChatMessage: jest.fn(),
}))

jest.mock('../../api/voiceChatApi', () => ({
  sendVoiceChat: jest.fn(),
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
    sendVoiceChat.mockResolvedValue({
      conversationId: 'conversation-voice',
      transcript: 'Where can I hear toucans?',
      answer: 'Listen near fruiting trees and scan the upper canopy.',
      audioUrl: 'https://cdn.example.com/files/voice-chat/response.mp3',
      audioResponseUrl: '/files/voice-chat/response.mp3',
      conversationContext: {
        conversationId: 'conversation-voice',
      },
      messageMetadata: {},
      customerContext: null,
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
        messageMetadata: {},
        conversationContext: {},
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
        messageMetadata: {},
        conversationContext: {},
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
      version: 2,
      customerContext: {
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
      },
      conversationContext: {},
    })
    expect(persisted.messages).toEqual([
      { role: 'user', content: 'Find tours' },
      { role: 'assistant', content: 'Done' },
    ])
  })

  test('does not persist or hydrate ephemeral reservation-entry chats', async () => {
    streamChatMessage.mockResolvedValue({
      conversationId: 'reservation-conversation-123',
      response: 'I can help reserve that tour.',
      messageMetadata: {},
      conversationContext: {},
    })

    const { result } = renderHook(() => useChat({
      token: 'auth-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
      },
    }, {
      isEphemeral: true,
      initialCustomerContext: {
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
      },
      initialConversationContext: {
        conversationType: 'reservation_entry',
        conversationSource: 'featured_tour',
      },
    }))

    expect(loadLatestConversation).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.sendMessage('I would like to reserve Direct Reserve Tour.', {
        assistantMetadata: {
          conversationType: 'reservation_entry',
          conversationSource: 'featured_tour',
          selectedTourId: 16,
          selectedTour: {
            tourId: 16,
            name: 'Direct Reserve Tour',
          },
        },
      })
    })

    expect(window.localStorage.length).toBe(0)
    expect(streamChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      assistantMetadata: expect.objectContaining({
          conversationType: 'reservation_entry',
          conversationSource: 'featured_tour',
          selectedTourId: 16,
          selectedTour: {
            tourId: 16,
            name: 'Direct Reserve Tour',
          },
        }),
    }))
  })

  test('stores reservation data under chat-level metadata', async () => {
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Your reservation is confirmed.',
      conversationContext: {
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
    expect(result.current.conversationContext).toMatchObject({
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
      messageMetadata: {},
      conversationContext: {},
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('Show me details')
    })

    expect(streamChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      assistantMetadata: {
          tours: [{ tourId: 1, name: 'Monteverde Quetzal Tour' }],
          uiAction: { type: 'choice' },
          selectedTourId: 1,
          participants: 3,
        },
    }))
  })

  test('sends voice chat audio and appends transcript, answer, and audio URL', async () => {
    window.localStorage.setItem('birdwatchingAI.chatState.user-1', JSON.stringify({
      conversationId: 'conversation-123',
      userId: 'user-1',
      meta: {
        customerContext: {
          customerName: 'Ana Gomez',
          customerEmail: 'ana@example.com',
        },
        selectedTourId: 4,
      },
      messages: [
        {
          role: 'assistant',
          content: 'I found recent sightings.',
          metadata: {
            birdMatches: [{ speciesCode: 'keptou1' }],
          },
        },
      ],
    }))

    const { result } = renderHook(() => useChat({
      token: 'auth-token',
      user: {
        id: 'user-1',
        email: 'ana@example.com',
      },
      role: 'customer',
    }))

    await act(async () => {
      await result.current.sendVoiceMessage(new Blob(['voice'], { type: 'audio/wav' }))
    })

    expect(sendVoiceChat).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conversation-123',
      customerContext: {
        customerName: 'Ana Gomez',
        customerEmail: 'ana@example.com',
      },
      assistantMetadata: {
          birdMatches: [{ speciesCode: 'keptou1' }],
          selectedTourId: 4,
        },
      responseMode: 'field_assistant',
      role: 'customer',
      token: 'auth-token',
    }))
    expect(result.current.messages.slice(-2)).toEqual([
      {
        role: 'user',
        content: 'Where can I hear toucans?',
        transcript: 'Where can I hear toucans?',
      },
      {
        role: 'assistant',
        content: 'Listen near fruiting trees and scan the upper canopy.',
        audioUrl: 'https://cdn.example.com/files/voice-chat/response.mp3',
        audioResponseUrl: '/files/voice-chat/response.mp3',
      },
    ])
  })

  test('shows a safe error when voice chat fails', async () => {
    sendVoiceChat.mockRejectedValue(new Error('Voice chat failed. Please try again.'))

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendVoiceMessage(new Blob(['voice'], { type: 'audio/wav' }))
    })

    expect(result.current.error).toBe('Voice chat failed. Please try again.')
    expect(result.current.messages.at(-1)).toEqual({
      role: 'assistant',
      content: 'Voice chat failed. Please try again.',
      isError: true,
    })
  })

  test('reports unsupported browser recording before requesting microphone access', async () => {
    const originalMediaRecorder = window.MediaRecorder
    const originalMediaDevices = navigator.mediaDevices

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn(),
      },
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.startVoiceRecording()
    })

    expect(result.current.error).toMatch(/voice recording is not supported/i)
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: originalMediaRecorder,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    })
  })

  test('reports microphone permission errors safely', async () => {
    const originalMediaRecorder = window.MediaRecorder
    const originalMediaDevices = navigator.mediaDevices
    const permissionError = new Error('Denied')
    permissionError.name = 'NotAllowedError'

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: class MockMediaRecorder {},
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockRejectedValue(permissionError),
      },
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.startVoiceRecording()
    })

    expect(result.current.error).toMatch(/microphone access was blocked/i)

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: originalMediaRecorder,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    })
  })

  test('cancels an active voice recording without sending audio', async () => {
    const originalMediaRecorder = window.MediaRecorder
    const originalMediaDevices = navigator.mediaDevices
    const stopTrack = jest.fn()
    let recorderInstance

    class MockMediaRecorder {
      constructor(stream) {
        this.stream = stream
        this.state = 'inactive'
        this.mimeType = 'audio/webm'
        this.ondataavailable = null
        this.onstop = null
        recorderInstance = this
      }

      start() {
        this.state = 'recording'
      }

      stop() {
        this.state = 'inactive'
        this.onstop?.()
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.startVoiceRecording()
    })

    expect(result.current.isRecording).toBe(true)
    expect(result.current.voiceStatus).toBe('recording')

    act(() => {
      result.current.cancelVoiceRecording()
    })

    expect(result.current.isRecording).toBe(false)
    expect(result.current.voiceStatus).toBe('idle')
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(recorderInstance.state).toBe('inactive')
    expect(sendVoiceChat).not.toHaveBeenCalled()

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: originalMediaRecorder,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    })
  })

  test('passes auth token to chat requests', async () => {
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Done',
      messageMetadata: {},
      conversationContext: {},
    })

    const { result } = renderHook(() => useChat('auth-token'))

    await act(async () => {
      await result.current.sendMessage('Find quetzals')
    })

    expect(streamChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      token: 'auth-token',
    }))
  })

  test('uses refreshed access tokens for authenticated chat requests', async () => {
    const getAccessToken = jest.fn().mockResolvedValue('fresh-token')
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Done',
      messageMetadata: {},
      conversationContext: {},
    })

    const { result } = renderHook(() => useChat({
      token: 'stale-token',
      getAccessToken,
      user: {
        id: 'user-1',
        email: 'ana@example.com',
      },
    }))

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.sendMessage('Find quetzals')
    })

    expect(getAccessToken).toHaveBeenCalled()
    expect(streamChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      token: 'fresh-token',
    }))
  })

  test('marks unauthenticated chat requests as visitor role', async () => {
    streamChatMessage.mockResolvedValue({
      conversationId: 'conversation-123',
      response: 'Toucans have large bills.',
      messageMetadata: {},
      conversationContext: {},
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
