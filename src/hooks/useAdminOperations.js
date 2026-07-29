import { useCallback, useRef, useState } from 'react'
import {
  ADMIN_REASON_CODES,
  DISABLEABLE_AI_FEATURES,
  disableAdminAiFeature,
  enableAdminAiFeature,
  retryAdminJob,
  suspendAdminUser,
  unsuspendAdminUser,
} from '../api/adminApi'

const IDLE_STATE = Object.freeze({
  status: 'idle',
  result: null,
  error: null,
  retryable: false,
  authorizationFailure: false,
})

function operationKey(type, targetId) {
  return `${type}:${targetId}`
}

function localValidationError(message) {
  return {
    message,
    retryable: false,
    status: 422,
  }
}

export default function useAdminOperations({
  getAccessToken,
  onSuccess,
} = {}) {
  const [states, setStates] = useState({})
  const pendingKeys = useRef(new Set())

  const getOperationState = useCallback((type, targetId) => (
    states[operationKey(type, targetId)] || IDLE_STATE
  ), [states])

  const clearOperation = useCallback((type, targetId) => {
    const key = operationKey(type, targetId)
    setStates((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }, [])

  const execute = useCallback(async ({
    type,
    targetId,
    request,
    validationError,
  }) => {
    const key = operationKey(type, targetId)
    if (pendingKeys.current.has(key)) return null

    if (validationError) {
      setStates((current) => ({
        ...current,
        [key]: {
          ...IDLE_STATE,
          status: 'error',
          error: validationError.message,
        },
      }))
      return null
    }

    pendingKeys.current.add(key)
    setStates((current) => ({
      ...current,
      [key]: {
        ...IDLE_STATE,
        status: 'pending',
      },
    }))

    try {
      const token = await getAccessToken()
      const result = await request(token)
      setStates((current) => ({
        ...current,
        [key]: {
          ...IDLE_STATE,
          status: 'success',
          result,
        },
      }))
      await onSuccess?.({ type, targetId, result })
      return result
    } catch (error) {
      setStates((current) => ({
        ...current,
        [key]: {
          ...IDLE_STATE,
          status: 'error',
          error: error?.message || 'The admin action could not be completed.',
          retryable: error?.retryable === true,
          authorizationFailure: error?.status === 401 || error?.status === 403,
        },
      }))
      return null
    } finally {
      pendingKeys.current.delete(key)
    }
  }, [getAccessToken, onSuccess])

  const retryJob = useCallback(({ jobId }) => execute({
    type: 'retry',
    targetId: jobId,
    request: (token) => retryAdminJob({ token, jobId }),
  }), [execute])

  const suspendUser = useCallback(({ userId, reasonCode }) => execute({
    type: 'suspend',
    targetId: userId,
    validationError: ADMIN_REASON_CODES.has(reasonCode)
      ? null
      : localValidationError('Select a supported suspension reason.'),
    request: (token) => suspendAdminUser({ token, userId, reasonCode }),
  }), [execute])

  const disableFeature = useCallback(({ feature, durationMinutes }) => {
    let validationError = null
    if (!DISABLEABLE_AI_FEATURES.has(feature)) {
      validationError = localValidationError('This AI feature cannot be disabled here.')
    } else if (
      !Number.isInteger(durationMinutes)
      || durationMinutes < 1
      || durationMinutes > 1440
    ) {
      validationError = localValidationError('Enter a duration from 1 to 1440 minutes.')
    }

    return execute({
      type: 'disable',
      targetId: feature,
      validationError,
      request: (token) => disableAdminAiFeature({
        token,
        feature,
        durationMinutes,
      }),
    })
  }, [execute])

  const enableFeature = useCallback(({ feature }) => execute({
    type: 'enable',
    targetId: feature,
    validationError: DISABLEABLE_AI_FEATURES.has(feature)
      ? null
      : localValidationError('This AI feature cannot be enabled here.'),
    request: (token) => enableAdminAiFeature({ token, feature }),
  }), [execute])

  const unsuspendUser = useCallback(({ userId }) => execute({
    type: 'unsuspend',
    targetId: userId,
    request: (token) => unsuspendAdminUser({ token, userId }),
  }), [execute])

  return {
    clearOperation,
    disableFeature,
    enableFeature,
    getOperationState,
    retryJob,
    suspendUser,
    unsuspendUser,
  }
}

export { IDLE_STATE, operationKey }
