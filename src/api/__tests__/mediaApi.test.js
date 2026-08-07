import {
  appendMediaVersion, clearMediaUrlCache, isRelativeMediaPath, resolveMediaUrl,
} from '../mediaApi'

describe('mediaApi', () => {
  beforeEach(() => {
    clearMediaUrlCache()
    global.fetch = jest.fn()
    delete process.env.VITE_CLOUDFRONT_BASE_URL
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

  test('resolves relative media paths through CloudFront when configured', async () => {
    process.env.VITE_CLOUDFRONT_BASE_URL = 'https://cdn.example.test/media/'

    await expect(resolveMediaUrl('/photos//great tinamou.jpg')).resolves.toBe(
      'https://cdn.example.test/media/photos/great%20tinamou.jpg'
    )

    expect(isRelativeMediaPath('/photos//great tinamou.jpg')).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('preserves a cache version when resolving through CloudFront', async () => {
    process.env.VITE_CLOUDFRONT_BASE_URL = 'https://cdn.example.test/media/'

    await expect(resolveMediaUrl('/files/tours/9.png?v=1725379200000')).resolves.toBe(
      'https://cdn.example.test/media/tours/9.png?v=1725379200000'
    )

    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('caches different versions independently through the files endpoint', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { url: 'https://cdn.example.test/tours/9.png?signature=abc' },
        meta: {},
      }),
    })

    await expect(resolveMediaUrl('/files/tours/9.png?v=old')).resolves.toBe(
      'https://cdn.example.test/tours/9.png?signature=abc&v=old'
    )
    await expect(resolveMediaUrl('/files/tours/9.png?v=new')).resolves.toBe(
      'https://cdn.example.test/tours/9.png?signature=abc&v=new'
    )

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/files/tours/9.png')
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/files/tours/9.png')
  })

  test('replaces an existing stable media version', () => {
    expect(appendMediaVersion('/files/tours/9.png?fit=cover&v=old', 'new')).toBe(
      '/files/tours/9.png?fit=cover&v=new'
    )
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

  test('does not resolve path traversal media references', async () => {
    process.env.VITE_CLOUDFRONT_BASE_URL = 'https://cdn.example.test'

    await expect(resolveMediaUrl('../secret.jpg')).resolves.toBe('')
    await expect(resolveMediaUrl('photos/%2e%2e/secret.jpg')).resolves.toBe('')

    expect(isRelativeMediaPath('../secret.jpg')).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
