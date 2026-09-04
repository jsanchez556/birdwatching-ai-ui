import { loadTransportVehicles, quoteTransportRoute } from '../transportApi'

describe('transportApi', () => {
  beforeEach(() => { global.fetch = jest.fn() })

  test('posts place identities and validates a route envelope', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {
      routeToken: 'route', origin: { placeId: 'a' }, destination: { placeId: 'b' }, distanceKm: 10.2, durationMinutes: 20,
    }, meta: {} }) })
    await expect(quoteTransportRoute({ originPlaceId: 'a', destinationPlaceId: 'b' })).resolves.toMatchObject({ routeToken: 'route' })
    expect(global.fetch).toHaveBeenCalledWith('/transport/routes/quote', expect.objectContaining({ method: 'POST' }))
  })

  test('rejects malformed vehicle envelopes', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { vehicles: [{}] }, meta: {} }) })
    await expect(loadTransportVehicles({ routeToken: 'r', passengers: 2, luggage: 1 })).rejects.toThrow('Something went wrong')
  })
})
