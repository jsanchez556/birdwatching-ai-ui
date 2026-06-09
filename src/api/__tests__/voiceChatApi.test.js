import { sendVoiceChat } from '../voiceChatApi'
import { clearMediaUrlCache } from '../mediaApi'

describe('voiceChatApi', () => {
  beforeEach(() => {
    clearMediaUrlCache()
    global.fetch = jest.fn()
    process.env.VITE_CLOUDFRONT_BASE_URL = 'https://cdn.example.test'
  })

  afterEach(() => {
    delete process.env.VITE_CLOUDFRONT_BASE_URL
  })

  test('posts wav audio with voice chat context headers and resolves returned audio URL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          transcript: 'Where should I look?',
          answer: 'Scan the canopy edge and listen for repeated calls.',
          audioResponseUrl: '/files/voice-chat/response.mp3',
        },
        meta: {
          conversationId: 'conversation-123',
        },
      }),
    })

    await expect(sendVoiceChat({
      audioBlob: new Blob(['voice'], { type: 'audio/wav' }),
      conversationId: 'conversation-123',
      customerContext: {
        customerName: 'Ana Gomez',
      },
      conversationContext: {
        recentAssistantMetadata: {
          selectedTourId: 4,
        },
      },
      role: 'customer',
      token: 'token-1',
    })).resolves.toEqual({
      transcript: 'Where should I look?',
      answer: 'Scan the canopy edge and listen for repeated calls.',
      audioUrl: 'https://cdn.example.test/voice-chat/response.mp3',
      audioResponseUrl: '/files/voice-chat/response.mp3',
      conversationId: 'conversation-123',
      metadata: {
        conversationId: 'conversation-123',
      },
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('/voice-chat', expect.objectContaining({
      method: 'POST',
      body: expect.any(Blob),
      headers: expect.objectContaining({
        Accept: 'application/json',
        Authorization: 'Bearer token-1',
        'Content-Type': 'audio/wav',
        'X-Conversation-Id': 'conversation-123',
        'X-Customer-Context': JSON.stringify({ customerName: 'Ana Gomez' }),
        'X-Conversation-Context': JSON.stringify({
          recentAssistantMetadata: {
            selectedTourId: 4,
          },
        }),
        'X-Filename': 'voice-message.wav',
        'X-Response-Mode': 'field_assistant',
        'X-Role': 'customer',
      }),
    }))
  })

  test('uses a safe backend failure message', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        data: null,
        meta: {
          message: 'Voice chat failed. Please try again.',
        },
      }),
    })

    await expect(sendVoiceChat({
      audioBlob: new Blob(['voice'], { type: 'audio/wav' }),
    })).rejects.toThrow('Voice chat failed. Please try again.')
  })

  test('rejects empty audio before making a request', async () => {
    await expect(sendVoiceChat({
      audioBlob: new Blob([], { type: 'audio/wav' }),
    })).rejects.toThrow('Please record a voice message before sending.')

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
