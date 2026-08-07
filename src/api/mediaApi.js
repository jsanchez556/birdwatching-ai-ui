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

function cloudFrontBaseUrl() {
  return (import.meta.env.VITE_CLOUDFRONT_BASE_URL || '').replace(/\/+$/, '')
}

function isUnsafeSegment(segment) {
  try {
    const decodedSegment = decodeURIComponent(segment)
    return decodedSegment === '.' || decodedSegment === '..'
  } catch {
    return true
  }
}

function splitMediaReference(value) {
  const reference = String(value || '').trim()
  const hashIndex = reference.indexOf('#')
  const withoutHash = hashIndex >= 0 ? reference.slice(0, hashIndex) : reference
  const queryIndex = withoutHash.indexOf('?')

  return {
    path: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
    search: queryIndex >= 0 ? withoutHash.slice(queryIndex) : '',
  }
}

function normalizeMediaKey(value) {
  const key = splitMediaReference(value).path
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/^files\/+/i, '')

  if (!key || isAbsoluteMediaUrl(key)) {
    return null
  }

  const segments = key.split('/').filter(Boolean)

  if (!segments.length || segments.some(isUnsafeSegment)) {
    return null
  }

  return segments.join('/')
}

function mediaFileUrl(key) {
  return apiUrl(`/files/${key.split('/').map(encodeURIComponent).join('/')}`)
}

function cloudFrontMediaUrl(key) {
  const baseUrl = cloudFrontBaseUrl()

  if (!baseUrl) {
    return ''
  }

  return `${baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function appendMediaSearch(url, search) {
  if (!url || !search || search === '?') return url || ''
  const hashIndex = url.indexOf('#')
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url
  return `${withoutHash}${withoutHash.includes('?') ? '&' : '?'}${search.slice(1)}${hash}`
}

export function appendMediaVersion(value, version) {
  const reference = String(value || '').trim()
  const normalizedVersion = String(version || '').trim()
  if (!reference || !normalizedVersion) return reference

  const hashIndex = reference.indexOf('#')
  const hash = hashIndex >= 0 ? reference.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? reference.slice(0, hashIndex) : reference
  const queryIndex = withoutHash.indexOf('?')
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
  const search = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '')
  search.set('v', normalizedVersion)
  return `${path}?${search.toString()}${hash}`
}

export function isRelativeMediaPath(value) {
  return Boolean(normalizeMediaKey(value))
}

export async function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  if (isAbsoluteMediaUrl(value)) {
    return value
  }

  const key = normalizeMediaKey(value)

  if (!key) {
    return ''
  }

  const { search } = splitMediaReference(value)
  const cacheKey = `${key}${search}`
  const cdnUrl = cloudFrontMediaUrl(key)

  if (cdnUrl) {
    return appendMediaSearch(cdnUrl, search)
  }

  if (mediaUrlCache.has(cacheKey)) {
    return mediaUrlCache.get(cacheKey)
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

      return appendMediaSearch(data.data.url, search)
    })
    .catch((error) => {
      mediaUrlCache.delete(cacheKey)
      throw error
    })

  mediaUrlCache.set(cacheKey, promise)
  return promise
}

export function clearMediaUrlCache() {
  mediaUrlCache.clear()
}
