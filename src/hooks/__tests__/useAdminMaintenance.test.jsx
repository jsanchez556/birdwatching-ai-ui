import { act, renderHook, waitFor } from '@testing-library/react'
import useAdminMaintenance from '../useAdminMaintenance'
import {
  createMaintenance, deleteMaintenance, listMaintenance, updateMaintenance, uploadTourImage,
} from '../../api/adminMaintenanceApi'

jest.mock('../../api/adminMaintenanceApi', () => ({
  createMaintenance: jest.fn(), deleteMaintenance: jest.fn(), listMaintenance: jest.fn(),
  updateMaintenance: jest.fn(), uploadTourImage: jest.fn(),
}))
jest.mock('../../api/myToursApi', () => ({
  createMyTour: jest.fn(), listMyTours: jest.fn(), updateMyTour: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  listMaintenance.mockImplementation(async (resource, options) => ({
    items: [{ id: options.page }],
    meta: { page: options.page, limit: 25, total: 75, totalPages: 3 },
  }))
  createMaintenance.mockResolvedValue({ id: 8 })
  updateMaintenance.mockResolvedValue({ id: 7 })
  uploadTourImage.mockResolvedValue({ image: {
    key: 'tours/7.png',
    url: '/files/tours/7.png?v=123',
    version: '123',
  } })
})

test('duplicate archive requests are rejected while deletion is pending', async () => {
  let resolveDelete
  deleteMaintenance.mockReturnValue(new Promise((resolve) => { resolveDelete = resolve }))
  const { result } = renderHook(() => useAdminMaintenance({
    resource: 'nodes', getAccessToken: jest.fn().mockResolvedValue('token'), filters: { search: '' },
  }))
  await waitFor(() => expect(result.current.status).toBe('success'))
  let firstRemove
  act(() => { firstRemove = result.current.remove(7) })
  await waitFor(() => expect(result.current.isRemoving).toBe(true))
  await expect(result.current.remove(8)).rejects.toThrow('already in progress')
  resolveDelete({ archived: true })
  await act(async () => firstRemove)
  expect(result.current.isRemoving).toBe(false)
})

test('editing refreshes the current server page while preserving the search query', async () => {
  const { result } = renderHook(() => useAdminMaintenance({
    resource: 'birds', getAccessToken: jest.fn().mockResolvedValue('token'),
    filters: { search: 'quetzal' },
  }))
  await waitFor(() => expect(result.current.status).toBe('success'))
  await act(async () => result.current.load({ page: 2 }))
  await waitFor(() => expect(result.current.meta.page).toBe(2))
  await act(async () => result.current.save({ id: 7, data: { name: 'Updated' } }))

  expect(updateMaintenance).toHaveBeenCalledWith('birds', 7, { name: 'Updated' }, { token: 'token' })
  expect(listMaintenance).toHaveBeenLastCalledWith('birds', expect.objectContaining({
    page: 2, search: 'quetzal', token: 'token',
  }))
  expect(result.current.notice).toBe('Changes saved.')
})

test('creation refreshes page one and duplicate saves are rejected while pending', async () => {
  let resolveCreate
  createMaintenance.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
  const { result } = renderHook(() => useAdminMaintenance({
    resource: 'birds', getAccessToken: jest.fn().mockResolvedValue('token'), filters: { search: '' },
  }))
  await waitFor(() => expect(result.current.status).toBe('success'))
  let firstSave
  act(() => { firstSave = result.current.save({ data: { name: 'Snowcap' } }) })
  await waitFor(() => expect(result.current.isSaving).toBe(true))
  await expect(result.current.save({ data: { name: 'Duplicate' } })).rejects.toThrow('already in progress')
  resolveCreate({ id: 8 })
  await act(async () => firstSave)
  expect(listMaintenance).toHaveBeenLastCalledWith('birds', expect.objectContaining({ page: 1 }))
})

test('uploads a selected image after saving an existing admin tour', async () => {
  const file = new File(['png'], 'replacement.png', { type: 'image/png' })
  const { result } = renderHook(() => useAdminMaintenance({
    resource: 'tours', getAccessToken: jest.fn().mockResolvedValue('token'),
    filters: { search: '' }, scope: 'admin',
  }))
  await waitFor(() => expect(result.current.status).toBe('success'))

  let saved
  await act(async () => {
    saved = await result.current.save({ id: 7, data: { name: 'Updated' }, image: file })
  })

  expect(updateMaintenance).toHaveBeenCalledWith('tours', 7, { name: 'Updated' }, { token: 'token' })
  expect(uploadTourImage).toHaveBeenCalledWith(7, file, { token: 'token' })
  expect(updateMaintenance.mock.invocationCallOrder[0])
    .toBeLessThan(uploadTourImage.mock.invocationCallOrder[0])
  expect(saved.image).toEqual({
    key: 'tours/7.png',
    url: '/files/tours/7.png?v=123',
    version: '123',
  })
  expect(result.current.notice).toBe('Changes and tour image saved.')
})

test('uploads an image-only tour edit without sending an unrelated PATCH request', async () => {
  const file = new File(['png'], 'first-tour-image.png', { type: 'image/png' })
  const { result } = renderHook(() => useAdminMaintenance({
    resource: 'tours', getAccessToken: jest.fn().mockResolvedValue('token'),
    filters: { search: '' }, scope: 'admin',
  }))
  await waitFor(() => expect(result.current.status).toBe('success'))

  let saved
  await act(async () => {
    saved = await result.current.save({ id: 7, data: null, image: file })
  })

  expect(updateMaintenance).not.toHaveBeenCalled()
  expect(uploadTourImage).toHaveBeenCalledWith(7, file, { token: 'token' })
  expect(saved.image).toEqual(expect.objectContaining({
    url: '/files/tours/7.png?v=123',
    version: '123',
  }))
  expect(result.current.notice).toBe('Tour image saved.')
})

test('keeps a failed image upload retryable without refreshing the list', async () => {
  const file = new File(['png'], 'replacement.png', { type: 'image/png' })
  uploadTourImage.mockRejectedValue(new Error('Unable to update the tour image.'))
  const { result } = renderHook(() => useAdminMaintenance({
    resource: 'tours', getAccessToken: jest.fn().mockResolvedValue('token'),
    filters: { search: '' }, scope: 'admin',
  }))
  await waitFor(() => expect(result.current.status).toBe('success'))
  listMaintenance.mockClear()

  await act(async () => {
    await expect(result.current.save({ id: 7, data: { name: 'Updated' }, image: file }))
      .rejects.toThrow('Unable to update the tour image.')
  })

  expect(result.current.error).toBe('Unable to update the tour image.')
  expect(result.current.isSaving).toBe(false)
  expect(listMaintenance).not.toHaveBeenCalled()
})
