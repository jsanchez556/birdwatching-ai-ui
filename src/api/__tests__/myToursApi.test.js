import { createMyTour, listMyTours, loadMyTourReferences, updateMyTour } from '../myToursApi'

const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

beforeEach(() => { global.fetch = jest.fn() })

test('uses protected scoped tour endpoints with search, filters, create, and edit', async () => {
  global.fetch
    .mockResolvedValueOnce(response({ success: true, data: { items: [{ id: 1 }] }, meta: { page: 2, limit: 25, total: 30, totalPages: 2 } }))
    .mockResolvedValueOnce(response({ success: true, data: { entity: { id: 2 } }, meta: {} }, 201))
    .mockResolvedValueOnce(response({ success: true, data: { entity: { id: 2, name: 'Updated' } }, meta: {} }))
    .mockResolvedValueOnce(response({ success: true, data: { countries: [], zones: [], nodes: [] }, meta: {} }))

  await listMyTours({ token: 'guide', page: 2, search: 'forest', type: 'Night walk', status: 'inactive' })
  await createMyTour({ name: 'Night forest' }, { token: 'guide' })
  await updateMyTour(2, { name: 'Updated' }, { token: 'guide' })
  await loadMyTourReferences({ token: 'guide' })

  expect(global.fetch.mock.calls[0][0]).toContain('/my-tours?')
  expect(global.fetch.mock.calls[0][0]).toContain('type=Night+walk')
  expect(global.fetch.mock.calls[0][0]).toContain('status=inactive')
  expect(global.fetch.mock.calls.map(([, options]) => options.method)).toEqual(['GET', 'POST', 'PATCH', 'GET'])
  expect(global.fetch.mock.calls.every(([, options]) => options.headers.Authorization === 'Bearer guide')).toBe(true)
})

test.each([[401], [403]])('preserves unauthorized status %s for protected access handling', async (status) => {
  global.fetch.mockResolvedValue(response({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } }, status))
  await expect(listMyTours({ token: 'bad' })).rejects.toMatchObject({ status, message: 'Access denied.' })
})
