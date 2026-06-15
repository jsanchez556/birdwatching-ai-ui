import { useCallback, useEffect, useRef, useState } from 'react'
import { identifyBirdByFile, identifyBirdByUrl } from '../api/birdIdentificationApi'

const EMPTY_INPUT_MESSAGE = 'Paste an image URL or choose a photo to identify.'
const INVALID_URL_MESSAGE = 'Enter a valid image URL.'
const INVALID_FILE_MESSAGE = 'Choose a JPEG, PNG, WebP, or GIF image.'
const EMPTY_FILE_MESSAGE = 'Choose a photo that is not empty.'
const OVERSIZED_FILE_MESSAGE = 'Choose a photo smaller than 10 MB.'
const UNSUPPORTED_IPHONE_IMAGE_MESSAGE = 'iPhone HEIC/HEIF photos are not supported yet. Please choose a JPEG, PNG, WebP, or GIF image.'
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const UNSUPPORTED_IPHONE_IMAGE_TYPES = new Set(['image/heic', 'image/heif'])
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024
const IMAGE_TYPE_BY_EXTENSION = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
])

function fileExtension(file) {
  const name = typeof file?.name === 'string' ? file.name.trim().toLowerCase() : ''
  const match = name.match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

function isUnsupportedIphoneImage(file) {
  const extension = fileExtension(file)
  return UNSUPPORTED_IPHONE_IMAGE_TYPES.has(file?.type) || extension === 'heic' || extension === 'heif'
}

function supportedImageType(file) {
  const mimeType = typeof file?.type === 'string' ? file.type.trim().toLowerCase() : ''

  if (ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return mimeType
  }

  return IMAGE_TYPE_BY_EXTENSION.get(fileExtension(file)) || ''
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export default function useBirdIdentification({ getAccessToken, token } = {}) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef(null)

  useEffect(() => () => {
    abortControllerRef.current?.abort()
  }, [])

  const identify = useCallback(async ({ imageUrl, file } = {}) => {
    const trimmedUrl = typeof imageUrl === 'string' ? imageUrl.trim() : ''

    if (!trimmedUrl && !file) {
      setError(EMPTY_INPUT_MESSAGE)
      return null
    }

    if (file) {
      if (file.size === 0) {
        setError(EMPTY_FILE_MESSAGE)
        return null
      }

      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        setError(OVERSIZED_FILE_MESSAGE)
        return null
      }

      if (isUnsupportedIphoneImage(file)) {
        setError(UNSUPPORTED_IPHONE_IMAGE_MESSAGE)
        return null
      }

      if (!supportedImageType(file)) {
        setError(INVALID_FILE_MESSAGE)
        return null
      }
    }

    if (!file && trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
      setError(INVALID_URL_MESSAGE)
      return null
    }

    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setIsLoading(true)
    setError(null)

    try {
      const accessToken = getAccessToken ? await getAccessToken() : token
      const nextResult = file
        ? await identifyBirdByFile({ file, token: accessToken, signal: abortController.signal })
        : await identifyBirdByUrl({ imageUrl: trimmedUrl, token: accessToken, signal: abortController.signal })

      setResult(nextResult)
      return nextResult
    } catch (requestError) {
      if (requestError?.name === 'AbortError') {
        return null
      }

      setError(requestError.message || 'Unable to identify this bird.')
      return null
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
      setIsLoading(false)
    }
  }, [getAccessToken, token])

  const clear = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setResult(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    result,
    error,
    isLoading,
    identify,
    clear,
  }
}

export {
  ALLOWED_IMAGE_TYPES,
  EMPTY_FILE_MESSAGE,
  EMPTY_INPUT_MESSAGE,
  INVALID_FILE_MESSAGE,
  INVALID_URL_MESSAGE,
  MAX_IMAGE_UPLOAD_BYTES,
  OVERSIZED_FILE_MESSAGE,
  UNSUPPORTED_IPHONE_IMAGE_MESSAGE,
  isUnsupportedIphoneImage,
  isValidHttpUrl,
  supportedImageType,
}
