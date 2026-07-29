import { useCallback, useEffect, useRef, useState } from 'react'
import { getBirdIdentificationJobStatus, identifyBirdByFile, identifyBirdByUrl } from '../api/birdIdentificationApi'

const EMPTY_INPUT_MESSAGE = 'Paste an image URL or choose a photo to identify.'
const INVALID_URL_MESSAGE = 'Enter a valid image URL.'
const INVALID_FILE_MESSAGE = 'Choose a JPEG, PNG, WebP, or GIF image.'
const EMPTY_FILE_MESSAGE = 'Choose a photo that is not empty.'
const OVERSIZED_FILE_MESSAGE = 'Choose a photo smaller than 10 MB.'
const UNSUPPORTED_IPHONE_IMAGE_MESSAGE = 'iPhone HEIC/HEIF photos are not supported yet. Please choose a JPEG, PNG, WebP, or GIF image.'
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const UNSUPPORTED_IPHONE_IMAGE_TYPES = new Set(['image/heic', 'image/heif'])
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024
const POLL_INTERVAL_MS = 1500
const MAX_JOB_POLL_ATTEMPTS = 40
const QUEUED_STATUSES = new Set(['queued', 'active', 'processing'])
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

function wait(ms, signal) {
  if (signal?.aborted) {
    return Promise.reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(resolve, ms)

    signal?.addEventListener('abort', () => {
      window.clearTimeout(timeoutId)
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
    }, { once: true })
  })
}

export default function useBirdIdentification({ getAccessToken, token } = {}) {
  const [result, setResult] = useState(null)
  const [job, setJob] = useState(null)
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
    setResult(null)
    setJob(null)

    try {
      const accessToken = getAccessToken ? await getAccessToken() : token
      const initialResponse = file
        ? await identifyBirdByFile({ file, token: accessToken, signal: abortController.signal })
        : await identifyBirdByUrl({ imageUrl: trimmedUrl, token: accessToken, signal: abortController.signal })

      if (initialResponse?.jobId) {
        setJob({
          jobId: initialResponse.jobId,
          status: initialResponse.jobStatus || 'queued',
        })

        let statusResponse = initialResponse
        let pollAttempts = 0

        while (QUEUED_STATUSES.has(statusResponse.jobStatus) && pollAttempts < MAX_JOB_POLL_ATTEMPTS) {
          pollAttempts += 1
          statusResponse = await getBirdIdentificationJobStatus({
            jobId: initialResponse.jobId,
            token: accessToken,
            signal: abortController.signal,
          })
          setJob({
            jobId: statusResponse.jobId || initialResponse.jobId,
            status: statusResponse.jobStatus,
          })

          if (statusResponse.jobStatus === 'completed' || statusResponse.jobStatus === 'failed' || statusResponse.jobStatus === 'not_found') {
            break
          }

          if (pollAttempts < MAX_JOB_POLL_ATTEMPTS) {
            await wait(POLL_INTERVAL_MS, abortController.signal)
          }
        }

        if (QUEUED_STATUSES.has(statusResponse.jobStatus)) {
          setJob({
            jobId: statusResponse.jobId || initialResponse.jobId,
            status: 'delayed',
          })
          setError('Bird identification is taking longer than expected. Please try again in a few minutes.')
          return null
        }

        if (statusResponse.jobStatus === 'completed' && statusResponse.result) {
          setResult(statusResponse.result)
          return statusResponse.result
        }

        if (statusResponse.jobStatus === 'not_found') {
          setError('We could not find that identification job. Please try again.')
          return null
        }

        if (statusResponse.jobStatus === 'failed') {
          setError(statusResponse.error || 'Bird identification failed. Please try again.')
          return null
        }
      }

      const nextResult = initialResponse

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
    setJob(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    result,
    job,
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
  MAX_JOB_POLL_ATTEMPTS,
  MAX_IMAGE_UPLOAD_BYTES,
  OVERSIZED_FILE_MESSAGE,
  POLL_INTERVAL_MS,
  UNSUPPORTED_IPHONE_IMAGE_MESSAGE,
  isUnsupportedIphoneImage,
  isValidHttpUrl,
  supportedImageType,
}
