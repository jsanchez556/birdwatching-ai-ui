import { useCallback, useEffect, useRef, useState } from 'react'
import { identifyBirdByFile, identifyBirdByUrl } from '../api/birdIdentificationApi'

const EMPTY_INPUT_MESSAGE = 'Paste an image URL or choose a photo to identify.'
const INVALID_URL_MESSAGE = 'Enter a valid image URL.'
const INVALID_FILE_MESSAGE = 'Choose a JPEG, PNG, WebP, or GIF image.'
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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

    if (file && !ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError(INVALID_FILE_MESSAGE)
      return null
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
  EMPTY_INPUT_MESSAGE,
  INVALID_FILE_MESSAGE,
  INVALID_URL_MESSAGE,
  isValidHttpUrl,
}
