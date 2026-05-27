import { clearMediaUrlCache, isRelativeMediaPath, resolveMediaUrl } from '../mediaApi'

describe('mediaApi', () => {
  beforeEach(() => {
    clearMediaUrlCache()
    global.fetch = jest.fn()
  })

  test('returns absolute media URLs without calling the API', async () => {
    await expect(resolveMediaUrl('https://example.com/bird.jpg')).resolves.toBe('https://example.com/bird.jpg')
    expect(isRelativeMediaPath('https://example.com/bird.jpg')).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('resolves relative media paths through the backend files endpoint', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          url: 'https://bucket.example.test/photos/great-tinamou.jpg?signature=abc',
        },
        meta: {
          expiresInSeconds: 900,
        },
      }),
    })

    await expect(resolveMediaUrl('photos/great-tinamou.jpg')).resolves.toBe(
      'https://bucket.example.test/photos/great-tinamou.jpg?signature=abc'
    )

    expect(isRelativeMediaPath('photos/great-tinamou.jpg')).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith('/files/photos/great-tinamou.jpg')
  })

  test('accepts values already prefixed with the media endpoint path', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          url: 'https://bucket.example.test/sonograms/great-tinamou.png',
        },
      }),
    })

    await expect(resolveMediaUrl('/files/sonograms/great-tinamou.png')).resolves.toBe(
      'https://bucket.example.test/sonograms/great-tinamou.png'
    )

    expect(global.fetch).toHaveBeenCalledWith('/files/sonograms/great-tinamou.png')
  })
})
