import {
  appendTourImageVersion, createMaintenance, deleteMaintenance, getTourImageReference,
  listMaintenance, reverseGeocodeAdminLocation, searchAdminLocations, updateMaintenance,
  uploadTourImage,
} from '../adminMaintenanceApi'

function response(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data }
}

beforeEach(() => { global.fetch = jest.fn() })

test('uses focused authorized REST paths for maintenance CRUD', async () => {
  global.fetch
    .mockResolvedValueOnce(response({ success: true, data: { items: [{ id: 1 }] }, meta: { page: 1, limit: 25, total: 1, totalPages: 1 } }))
    .mockResolvedValueOnce(response({ success: true, data: { entity: { id: 2 } }, meta: {} }, { status: 201 }))
    .mockResolvedValueOnce(response({ success: true, data: { entity: { id: 2, name: 'Updated' } }, meta: {} }))
    .mockResolvedValueOnce(response({ success: true, data: { entity: { id: 2 }, archived: true }, meta: {} }))

  await listMaintenance('tours', { token: 'admin', search: 'night', type: 'Night walk' })
  await createMaintenance('tours', { name: 'Night tour' }, { token: 'admin' })
  await updateMaintenance('tours', 2, { name: 'Updated' }, { token: 'admin' })
  await deleteMaintenance('tours', 2, { token: 'admin' })

  expect(global.fetch.mock.calls[0][0]).toContain('/admin/tours?')
  expect(global.fetch.mock.calls[0][0]).toContain('type=Night+walk')
  expect(global.fetch.mock.calls.map(([, options]) => options.method)).toEqual(['GET', 'POST', 'PATCH', 'DELETE'])
  expect(global.fetch.mock.calls.every(([, options]) => options.headers.Authorization === 'Bearer admin')).toBe(true)
})

test('surfaces referential conflicts without marking them retryable', async () => {
  global.fetch.mockResolvedValue(response({ success: false, error: { code: 'REFERENTIAL_INTEGRITY_CONFLICT', message: 'Still referenced.' } }, { ok: false, status: 409 }))
  await expect(deleteMaintenance('countries', 1, { token: 'admin' })).rejects.toMatchObject({
    message: 'Still referenced.', status: 409, retryable: false,
  })
})

test('keeps admin geocoding behind the focused authenticated API adapter', async () => {
  global.fetch.mockResolvedValue(response({ success: true, data: { items: [
    { name: 'Monteverde', latitude: 10.3, longitude: -84.8 },
  ] }, meta: {} }))
  await expect(searchAdminLocations('Monteverde', { token: 'admin', countryCode: 'CR' }))
    .resolves.toHaveLength(1)
  expect(global.fetch.mock.calls[0][0]).toContain('/admin/location-search?q=Monteverde&countryCode=cr')
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer admin')
})

test('reverse geocodes coordinates through the existing protected location adapter', async () => {
  global.fetch.mockResolvedValue(response({ success: true, data: { items: [
    { name: 'San José, Costa Rica', latitude: 9.9325, longitude: -84.0796 },
  ] }, meta: {} }))
  await expect(reverseGeocodeAdminLocation({ latitude: 9.9325, longitude: -84.0796 }, { token: 'admin' }))
    .resolves.toMatchObject({ name: 'San José, Costa Rica' })
  expect(global.fetch.mock.calls[0][0]).toContain('/admin/location-search?latitude=9.9325&longitude=-84.0796')
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer admin')
})

test('sends exact device coordinate precision without swapping or rounding', async () => {
  global.fetch.mockResolvedValue(response({ success: true, data: { items: [] }, meta: {} }))
  await reverseGeocodeAdminLocation({
    latitude: 10.733123456789, longitude: -85.044987654321,
  }, { token: 'admin' })
  const url = new URL(global.fetch.mock.calls[0][0], 'https://example.test')
  expect(url.searchParams.get('latitude')).toBe('10.733123456789')
  expect(url.searchParams.get('longitude')).toBe('-85.044987654321')
})

test('uploads a tour PNG through the exact authenticated multipart endpoint', async () => {
  const file = new File(['png'], 'cloud-forest.png', { type: 'image/png' })
  global.fetch.mockResolvedValue(response({
    success: true,
    data: {
      tour: { id: 7, name: 'Cloud forest walk', imagePath: 'tours/550e8400-e29b-41d4-a716-446655440000.png' },
      image: {
        key: 'tours/550e8400-e29b-41d4-a716-446655440000.png',
        url: '/files/tours/550e8400-e29b-41d4-a716-446655440000.png?v=1788436800000',
        version: '1788436800000',
        cleanupPending: false,
      },
    },
    meta: {},
  }))

  await expect(uploadTourImage(7, file, { token: 'admin' }))
    .resolves.toMatchObject({ image: { key: 'tours/550e8400-e29b-41d4-a716-446655440000.png' } })

  const [url, options] = global.fetch.mock.calls[0]
  expect(url).toBe('/admin/tours/7/image')
  expect(options.method).toBe('PUT')
  expect(options.headers).toEqual({ Authorization: 'Bearer admin' })
  expect(options.body).toBeInstanceOf(FormData)
  expect(options.body.get('image')).toEqual(file)
  expect(options.headers).not.toHaveProperty('Content-Type')
})

test('validates tour image responses and safely marks server failures retryable', async () => {
  const file = new File(['png'], 'tour.png', { type: 'image/png' })
  global.fetch.mockResolvedValueOnce(response({
    success: false,
    error: { code: 'TOUR_IMAGE_UPLOAD_FAILED', message: 'Tour image could not be saved.' },
  }, { ok: false, status: 502 }))
  await expect(uploadTourImage(7, file, { token: 'admin' })).rejects.toMatchObject({
    message: 'Tour image could not be saved.', status: 502, retryable: true,
  })

  global.fetch.mockResolvedValueOnce(response({ success: true, data: { image: {} }, meta: {} }))
  await expect(uploadTourImage(7, file, { token: 'admin' }))
    .rejects.toThrow('The maintenance request could not be completed.')

  global.fetch.mockResolvedValueOnce(response({
    success: true,
    data: {
      tour: { id: 7, imagePath: 'tours/other.png' },
      image: {
        key: 'tours/7.png', url: '/files/tours/7.png?v=123',
        version: '123', cleanupPending: false,
      },
    },
    meta: {},
  }))
  await expect(uploadTourImage(7, file, { token: 'admin' }))
    .rejects.toThrow('The maintenance request could not be completed.')
})

test('builds safe tour media references and cache-versioned preview URLs', () => {
  const uuidPath = 'tours/550e8400-e29b-41d4-a716-446655440000.png'
  expect(getTourImageReference(7)).toBe('/files/tours/7.png')
  expect(getTourImageReference(7, 'tours/7.png')).toBe('/files/tours/7.png')
  expect(getTourImageReference(7, 'tours/7', '122')).toBe('/files/tours/7.png?v=122')
  expect(getTourImageReference(7, 'tours/7.png', '123')).toBe('/files/tours/7.png?v=123')
  expect(getTourImageReference(7, uuidPath, '456'))
    .toBe(`/files/${uuidPath}?v=456`)
  expect(getTourImageReference(7, '../private.png')).toBe('')
  expect(getTourImageReference('not-an-id')).toBe('')
  expect(appendTourImageVersion('https://cdn.example.test/tours/7.png', '123'))
    .toBe('https://cdn.example.test/tours/7.png?v=123')
})
