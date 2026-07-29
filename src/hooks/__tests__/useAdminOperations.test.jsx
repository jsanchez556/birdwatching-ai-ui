import { act, renderHook, waitFor } from '@testing-library/react'
import useAdminOperations from '../useAdminOperations'
import {
  disableAdminAiFeature,
  enableAdminAiFeature,
  retryAdminJob,
  suspendAdminUser,
  unsuspendAdminUser,
} from '../../api/adminApi'

jest.mock('../../api/adminApi', () => ({
  ADMIN_REASON_CODES: new Set(['abuse', 'spam', 'security', 'policy_violation']),
  DISABLEABLE_AI_FEATURES: new Set([
    'voice_ai',
    'multimodal_bird_identification',
    'agent_booking',
  ]),
  disableAdminAiFeature: jest.fn(),
  enableAdminAiFeature: jest.fn(),
  retryAdminJob: jest.fn(),
  suspendAdminUser: jest.fn(),
  unsuspendAdminUser: jest.fn(),
}))

function deferred() {
  let resolve
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('useAdminOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('prevents duplicate submissions and tracks pending state independently by target', async () => {
    const pending = deferred()
    retryAdminJob.mockReturnValue(pending.promise)
    const getAccessToken = jest.fn().mockResolvedValue('admin-token')
    const { result } = renderHook(() => useAdminOperations({ getAccessToken }))

    act(() => {
      result.current.retryJob({ jobId: 'job-1' })
      result.current.retryJob({ jobId: 'job-1' })
    })

    await waitFor(() => {
      expect(result.current.getOperationState('retry', 'job-1').status).toBe('pending')
    })
    expect(result.current.getOperationState('retry', 'job-2').status).toBe('idle')
    expect(retryAdminJob).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({
        auditId: '41',
        job: { id: 'job-1', status: 'queued' },
      })
      await pending.promise
    })

    expect(result.current.getOperationState('retry', 'job-1')).toMatchObject({
      status: 'success',
      result: { auditId: '41' },
    })
  })

  test('runs all validated operations and refreshes affected dashboard data after success', async () => {
    retryAdminJob.mockResolvedValue({
      auditId: '41',
      job: { id: 'job-1', status: 'queued' },
    })
    suspendAdminUser.mockResolvedValue({
      auditId: '42',
      user: { id: '7', status: 'suspended' },
    })
    disableAdminAiFeature.mockResolvedValue({
      auditId: '43',
      feature: { name: 'voice_ai', status: 'disabled' },
    })
    enableAdminAiFeature.mockResolvedValue({
      auditId: '44',
      feature: { name: 'voice_ai', status: 'enabled' },
    })
    unsuspendAdminUser.mockResolvedValue({
      auditId: '45',
      user: { id: '7', status: 'active' },
    })
    const onSuccess = jest.fn()
    const { result } = renderHook(() => useAdminOperations({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
      onSuccess,
    }))

    await act(async () => {
      await result.current.retryJob({ jobId: 'job-1' })
      await result.current.suspendUser({ userId: '7', reasonCode: 'abuse' })
      await result.current.disableFeature({ feature: 'voice_ai', durationMinutes: 60 })
      await result.current.enableFeature({ feature: 'voice_ai' })
      await result.current.unsuspendUser({ userId: '7' })
    })

    expect(retryAdminJob).toHaveBeenCalledWith({
      token: 'admin-token',
      jobId: 'job-1',
    })
    expect(suspendAdminUser).toHaveBeenCalledWith({
      token: 'admin-token',
      userId: '7',
      reasonCode: 'abuse',
    })
    expect(disableAdminAiFeature).toHaveBeenCalledWith({
      token: 'admin-token',
      feature: 'voice_ai',
      durationMinutes: 60,
    })
    expect(enableAdminAiFeature).toHaveBeenCalledWith({
      token: 'admin-token',
      feature: 'voice_ai',
    })
    expect(unsuspendAdminUser).toHaveBeenCalledWith({
      token: 'admin-token',
      userId: '7',
    })
    expect(onSuccess).toHaveBeenCalledTimes(5)
  })

  test('clears old errors on retry and exposes transient failures as retryable', async () => {
    const transientError = Object.assign(new Error('Please try again.'), {
      status: 500,
      retryable: true,
    })
    retryAdminJob
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce({
        auditId: '41',
        job: { id: 'job-1', status: 'queued' },
      })
    const onSuccess = jest.fn()
    const { result } = renderHook(() => useAdminOperations({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
      onSuccess,
    }))

    await act(async () => {
      await result.current.retryJob({ jobId: 'job-1' })
    })
    expect(result.current.getOperationState('retry', 'job-1')).toMatchObject({
      status: 'error',
      error: 'Please try again.',
      retryable: true,
    })
    expect(onSuccess).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.retryJob({ jobId: 'job-1' })
    })
    expect(result.current.getOperationState('retry', 'job-1')).toMatchObject({
      status: 'success',
      error: null,
      retryable: false,
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  test('marks authorization failures non-retryable and validates reason and duration locally', async () => {
    retryAdminJob.mockRejectedValueOnce(Object.assign(new Error('No permission.'), {
      status: 403,
      retryable: false,
    }))
    const { result } = renderHook(() => useAdminOperations({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
    }))

    await act(async () => {
      await result.current.retryJob({ jobId: 'job-1' })
      await result.current.suspendUser({ userId: '7', reasonCode: 'free-form allegation' })
      await result.current.disableFeature({ feature: 'voice_ai', durationMinutes: 0 })
    })

    expect(result.current.getOperationState('retry', 'job-1')).toMatchObject({
      status: 'error',
      authorizationFailure: true,
      retryable: false,
    })
    expect(result.current.getOperationState('suspend', '7').error)
      .toBe('Select a supported suspension reason.')
    expect(result.current.getOperationState('disable', 'voice_ai').error)
      .toBe('Enter a duration from 1 to 1440 minutes.')
    expect(suspendAdminUser).not.toHaveBeenCalled()
    expect(disableAdminAiFeature).not.toHaveBeenCalled()
  })
})
