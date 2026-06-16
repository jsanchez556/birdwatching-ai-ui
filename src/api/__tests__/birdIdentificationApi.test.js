import {
  getBirdIdentificationJobStatus,
  identifyBirdByFile,
  identifyBirdByUrl,
  imageUploadContentType,
} from '../birdIdentificationApi'

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

  test('normalizes queued bird identification responses', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          jobId: 'job-1',
          status: 'queued',
        },
        meta: {},
      }),
    })

    await expect(identifyBirdByUrl({
      imageUrl: 'https://example.test/bird.jpg',
      token: 'token-1',
    })).resolves.toEqual({
      jobId: 'job-1',
      jobStatus: 'queued',
      meta: {},
    })
  })

  test('loads completed bird identification job status', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          jobId: 'job-1',
          status: 'completed',
          result: {
            status: 'identified',
            bestMatch: { commonName: 'Resplendent Quetzal' },
            candidates: [],
          },
        },
        meta: {},
      }),
    })

    await expect(getBirdIdentificationJobStatus({
      jobId: 'job-1',
      token: 'token-1',
    })).resolves.toEqual({
      jobId: 'job-1',
      jobStatus: 'completed',
      result: expect.objectContaining({
        status: 'identified',
        bestMatch: { commonName: 'Resplendent Quetzal' },
      }),
      meta: {},
    })
    expect(global.fetch).toHaveBeenCalledWith('/jobs/job-1', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer token-1',
      }),
    }))
  })

  test('loads failed bird identification job status with a safe message', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          jobId: 'job-1',
          status: 'failed',
          error: {
            message: 'Bird identification failed. Please try again.',
          },
        },
        meta: {},
      }),
    })

    await expect(getBirdIdentificationJobStatus({
      jobId: 'job-1',
      token: 'token-1',
    })).resolves.toEqual({
      jobId: 'job-1',
      jobStatus: 'failed',
      error: 'Bird identification failed. Please try again.',
      meta: {},
    })
  })

  test('infers upload content type from filename when browser MIME metadata is missing', async () => {
    const file = new File(['image-bytes'], 'iphone-photo.JPG', { type: '' })
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

    expect(imageUploadContentType(file)).toBe('image/jpeg')
    expect(global.fetch).toHaveBeenCalledWith('/birds/identify', expect.objectContaining({
      headers: expect.objectContaining({
        'Content-Type': 'image/jpeg',
        'X-Filename': 'iphone-photo.JPG',
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
