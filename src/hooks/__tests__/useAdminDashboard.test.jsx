import { act, renderHook, waitFor } from '@testing-library/react'
import useAdminDashboard, { ADMIN_SECTION_IDS } from '../useAdminDashboard'
import { loadAdminSection } from '../../api/adminApi'

jest.mock('../../api/adminApi', () => {
  const ids = {
    AI_OPERATIONS: 'ai_operations',
    COMMERCIAL: 'commercial',
    EMERGENCY: 'emergency',
  }
  return {
    ADMIN_SECTION_IDS: ids,
    loadAdminSection: jest.fn(),
  }
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

describe('useAdminDashboard section loading', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadAdminSection.mockImplementation(async (sectionId) => ({ sectionId }))
  })

  test('loads AI Operations by default and no secondary section', async () => {
    const { result } = renderHook(() => useAdminDashboard({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
    }))

    expect(result.current.activeSection).toBe(ADMIN_SECTION_IDS.AI_OPERATIONS)
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))
    expect(loadAdminSection).toHaveBeenCalledTimes(1)
    expect(loadAdminSection).toHaveBeenCalledWith(
      ADMIN_SECTION_IDS.AI_OPERATIONS,
      expect.objectContaining({
        token: 'admin-token',
        startDate: expect.any(String),
        endDate: expect.any(String),
      })
    )
  })

  test('loads sections on demand and reuses successful session cache', async () => {
    const { result } = renderHook(() => useAdminDashboard({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
    }))
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))

    act(() => result.current.setActiveSection(ADMIN_SECTION_IDS.COMMERCIAL))
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))
    expect(loadAdminSection).toHaveBeenCalledTimes(2)

    act(() => result.current.setActiveSection(ADMIN_SECTION_IDS.AI_OPERATIONS))
    await waitFor(() => expect(result.current.activeSection).toBe(ADMIN_SECTION_IDS.AI_OPERATIONS))
    expect(loadAdminSection).toHaveBeenCalledTimes(2)
  })

  test('prevents duplicate concurrent section requests', async () => {
    const pending = deferred()
    loadAdminSection.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useAdminDashboard({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
    }))
    await waitFor(() => expect(result.current.activeState.status).toBe('loading'))

    act(() => {
      result.current.refresh()
      result.current.refresh()
    })
    expect(loadAdminSection).toHaveBeenCalledTimes(1)

    await act(async () => pending.resolve({ overview: {} }))
  })

  test('keeps errors and successful data isolated by section and retries only active data', async () => {
    loadAdminSection
      .mockResolvedValueOnce({ operations: true })
      .mockRejectedValueOnce(new Error('User administration is unavailable'))
      .mockResolvedValueOnce({ commercial: true })
    const { result } = renderHook(() => useAdminDashboard({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
    }))
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))

    act(() => result.current.setActiveSection(ADMIN_SECTION_IDS.COMMERCIAL))
    await waitFor(() => expect(result.current.activeState.status).toBe('error'))
    expect(result.current.getSectionState(ADMIN_SECTION_IDS.AI_OPERATIONS)).toMatchObject({
      status: 'success',
      data: { operations: true },
    })
    expect(result.current.activeState.data).toBeNull()

    await act(async () => result.current.refresh())
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))
    expect(loadAdminSection).toHaveBeenCalledTimes(3)
  })

  test('range changes preserve Emergency controls and invalidate dependent sections', async () => {
    const { result } = renderHook(() => useAdminDashboard({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
    }))
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))
    act(() => result.current.setActiveSection(ADMIN_SECTION_IDS.EMERGENCY))
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))
    expect(loadAdminSection).toHaveBeenCalledTimes(2)

    act(() => result.current.setRange('7d'))
    await waitFor(() => expect(result.current.range).toBe('7d'))
    expect(loadAdminSection).toHaveBeenCalledTimes(2)
    expect(result.current.getSectionState(ADMIN_SECTION_IDS.EMERGENCY).status).toBe('success')
    expect(result.current.getSectionState(ADMIN_SECTION_IDS.AI_OPERATIONS).status).toBe('idle')
    expect(result.current.getSectionState(ADMIN_SECTION_IDS.COMMERCIAL).status).toBe('idle')

    act(() => result.current.setActiveSection(ADMIN_SECTION_IDS.AI_OPERATIONS))
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))
    expect(loadAdminSection).toHaveBeenCalledTimes(3)
  })

  test('range changes immediately reload the active dependent section only', async () => {
    const { result } = renderHook(() => useAdminDashboard({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
    }))
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))

    act(() => result.current.setRange('7d'))
    await waitFor(() => expect(loadAdminSection).toHaveBeenCalledTimes(2))
    expect(loadAdminSection.mock.calls.every(([section]) => section === 'ai_operations')).toBe(true)
    expect(loadAdminSection.mock.calls[1][1]).toEqual(expect.objectContaining({
      startDate: expect.any(String),
      endDate: expect.any(String),
    }))
  })

  test('refreshSections reloads only loaded affected sections', async () => {
    const { result } = renderHook(() => useAdminDashboard({
      getAccessToken: jest.fn().mockResolvedValue('admin-token'),
    }))
    await waitFor(() => expect(result.current.activeState.status).toBe('success'))

    await act(async () => result.current.refreshSections([
      ADMIN_SECTION_IDS.COMMERCIAL,
      ADMIN_SECTION_IDS.EMERGENCY,
    ]))
    expect(loadAdminSection).toHaveBeenCalledTimes(1)

    await act(async () => result.current.refreshSections(
      [ADMIN_SECTION_IDS.EMERGENCY],
      { loadedOnly: false }
    ))
    expect(loadAdminSection).toHaveBeenCalledTimes(2)
  })
})
