import {
  apiUrl,
  getApiErrorMessage,
  parseJsonResponse,
} from './http'

const mediaUrlCache = new Map()

function isAbsoluteMediaUrl(value) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(value)
    || /^(?:data|blob):/i.test(value)
}

function normalizeMediaKey(value) {
  const key = String(value || '').trim().replaceAll('\\', '/').replace(/^\/+/, '')

  if (!key || isAbsoluteMediaUrl(key)) {
    return null
  }

  return key.replace(/^files\/+/i, '')
}

function mediaFileUrl(key) {
  return apiUrl(`/files/${key.split('/').map(encodeURIComponent).join('/')}`)
}

export function isRelativeMediaPath(value) {
  return Boolean(normalizeMediaKey(value))
}

export async function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  if (!isRelativeMediaPath(value)) {
    return value
  }

  const key = normalizeMediaKey(value)

  if (mediaUrlCache.has(key)) {
    return mediaUrlCache.get(key)
  }

  const promise = fetch(mediaFileUrl(key))
    .then(async (response) => {
      const data = await parseJsonResponse(response)

      if (!response.ok) {
        throw new Error(getApiErrorMessage(data, 'Failed to load bird media'))
      }

      if (!data.success || typeof data.data?.url !== 'string') {
        throw new Error('Unexpected media response format')
      }

      return data.data.url
    })
    .catch((error) => {
      mediaUrlCache.delete(key)
      throw error
    })

  mediaUrlCache.set(key, promise)
  return promise
}

export function clearMediaUrlCache() {
  mediaUrlCache.clear()
}
