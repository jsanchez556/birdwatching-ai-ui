import { identifyBirdByFile, identifyBirdByUrl } from '../birdIdentificationApi'

describe('birdIdentificationApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  test('identifies a bird by image URL through the normalized envelope', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          status: 'identified',
          bestMatch: { commonName: 'Resplendent Quetzal', confidence: 0.91 },
          summary: 'Likely a Resplendent Quetzal.',
          imageAnalysis: {
            dominantColors: ['green', 'red'],
            bill: { color: 'yellow', shape: 'short', length: 'short' },
          },
          imageObservations: { colors: ['green'] },
          candidates: [{ commonName: 'Resplendent Quetzal', confidence: 0.91 }],
          notes: ['Diagnostic field marks are visible.'],
        },
        meta: { model: 'gpt-4o' },
      }),
    })

    await expect(identifyBirdByUrl({
      imageUrl: 'https://example.test/bird.jpg',
      token: 'token-1',
    })).resolves.toEqual({
      status: 'identified',
      bestMatch: { commonName: 'Resplendent Quetzal', confidence: 0.91 },
      summary: 'Likely a Resplendent Quetzal.',
      imageAnalysis: {
        dominantColors: ['green', 'red'],
        bill: { color: 'yellow', shape: 'short', length: 'short' },
      },
      imageObservations: { colors: ['green'] },
      candidates: [{ commonName: 'Resplendent Quetzal', confidence: 0.91 }],
      notes: ['Diagnostic field marks are visible.'],
      meta: { model: 'gpt-4o' },
    })
    expect(global.fetch).toHaveBeenCalledWith('/birds/identify', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ imageUrl: 'https://example.test/bird.jpg' }),
    }))
  })

  test('identifies a bird by raw image file upload', async () => {
    const file = new File(['image-bytes'], 'bird.jpg', { type: 'image/jpeg' })
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          summary: '',
          imageObservations: {},
          candidates: [],
        },
        meta: {},
      }),
    })

    await identifyBirdByFile({ file, token: 'token-1' })

    expect(global.fetch).toHaveBeenCalledWith('/birds/identify', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer token-1',
        'Content-Type': 'image/jpeg',
        'X-Filename': 'bird.jpg',
      }),
      body: file,
    }))
  })

  test('rejects malformed envelopes with the friendly fallback', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {},
      }),
    })

    await expect(identifyBirdByUrl({
      imageUrl: 'https://example.test/bird.jpg',
      token: 'token-1',
    })).rejects.toThrow('Something went wrong. Please try again.')
  })
})
