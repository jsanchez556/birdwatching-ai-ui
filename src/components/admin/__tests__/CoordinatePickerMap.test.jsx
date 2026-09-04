import { act, render, screen, waitFor } from '@testing-library/react'
import CoordinatePickerMap from '../CoordinatePickerMap'
import { payloadFor, validateForm } from '../AdminMaintenance'
import { loadGoogleMaps } from '../../../config/googleMaps'

jest.mock('../../../config/googleMaps', () => ({ loadGoogleMaps: jest.fn() }))

function installGoogleMapsMock() {
  class FakeMap {
    constructor(element, options) {
      FakeMap.instances.push(this)
      this.element = element
      this.options = options
      this.listeners = {}
    }

    addListener(event, handler) {
      this.listeners[event] = handler
      return { remove: jest.fn() }
    }

    panTo(position) { this.pannedTo = position }

    setZoom(zoom) { this.zoom = zoom }
  }
  FakeMap.instances = []

  class FakeMarker {
    constructor(options) {
      FakeMarker.instances.push(this)
      this.map = options.map
      this.visible = options.visible
      this.position = null
      this.listeners = {}
    }

    addListener(event, handler) {
      this.listeners[event] = handler
      return { remove: jest.fn() }
    }

    setPosition(position) {
      const lat = typeof position.lat === 'function' ? position.lat() : position.lat
      const lng = typeof position.lng === 'function' ? position.lng() : position.lng
      this.position = { lat, lng }
    }

    getPosition() {
      return { lat: () => this.position.lat, lng: () => this.position.lng }
    }

    setVisible(visible) { this.visible = visible }

    setMap(map) { this.map = map }
  }
  FakeMarker.instances = []

  loadGoogleMaps.mockResolvedValue({ maps: { Map: FakeMap, Marker: FakeMarker } })
  return { FakeMap, FakeMarker }
}

function latLng(lat, lng) {
  return { lat: () => lat, lng: () => lng }
}

beforeEach(() => {
  loadGoogleMaps.mockReset()
})


test('an incomplete country record initializes the map at the documented fallback', async () => {
  const { FakeMap } = installGoogleMapsMock()
  render(<CoordinatePickerMap country={{ name: 'Incomplete', latitude: 9.5, longitude: null, zoom: 7 }} />)
  await waitFor(() => expect(FakeMap.instances).toHaveLength(1))
  expect(FakeMap.instances[0].options.center).toEqual({ lat: 9.75, lng: -84.2 })
  expect(FakeMap.instances[0].options.zoom).toBe(7)
})

test('existing coordinates initialize a focused view with a visible marker', async () => {
  const { FakeMap, FakeMarker } = installGoogleMapsMock()
  render(<CoordinatePickerMap latitude={10.3} longitude={-84.8} country={{ name: 'Costa Rica' }} />)
  await waitFor(() => expect(FakeMap.instances).toHaveLength(1))
  expect(FakeMap.instances[0].options.center).toEqual({ lat: 10.3, lng: -84.8 })
  expect(FakeMap.instances[0].options.zoom).toBe(13)
  expect(FakeMarker.instances[0].visible).toBe(true)
})

test('clicking the map reports the selected coordinates and shows the marker', async () => {
  const { FakeMap, FakeMarker } = installGoogleMapsMock()
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} onChange={onChange} />)
  await waitFor(() => expect(FakeMap.instances).toHaveLength(1))
  act(() => FakeMap.instances[0].listeners.click({ latLng: latLng(10.123456, -84.654321) }))
  expect(onChange).toHaveBeenCalledWith({ latitude: 10.123456, longitude: -84.654321 })
  expect(FakeMarker.instances[0].visible).toBe(true)
})

test('dragging the marker reports the released coordinates', async () => {
  const { FakeMap, FakeMarker } = installGoogleMapsMock()
  const onChange = jest.fn()
  render(<CoordinatePickerMap latitude={9.75} longitude={-84.2} country={{ name: 'Costa Rica' }} onChange={onChange} />)
  await waitFor(() => expect(FakeMap.instances).toHaveLength(1))
  FakeMarker.instances[0].setPosition(latLng(11.5, -85.1))
  act(() => FakeMarker.instances[0].listeners.dragend())
  expect(onChange).toHaveBeenCalledWith({ latitude: 11.5, longitude: -85.1 })
})

test('a location-search focus point pans the map without removing the marker', async () => {
  const { FakeMap, FakeMarker } = installGoogleMapsMock()
  const { rerender } = render(<CoordinatePickerMap latitude={10} longitude={-84} country={{ name: 'Costa Rica' }} />)
  await waitFor(() => expect(FakeMap.instances).toHaveLength(1))
  rerender(<CoordinatePickerMap latitude={10} longitude={-84} country={{ name: 'Costa Rica' }}
    focusPoint={{ latitude: 9.93, longitude: -84.08, key: 1 }} />)
  await waitFor(() => expect(FakeMap.instances[0].pannedTo).toEqual({ lat: 9.93, lng: -84.08 }))
  expect(FakeMap.instances[0].zoom).toBe(13)
  expect(FakeMarker.instances[0].visible).toBe(true)
})

test('numeric coordinate changes keep the marker synchronized', async () => {
  const { FakeMap, FakeMarker } = installGoogleMapsMock()
  const { rerender } = render(<CoordinatePickerMap latitude={10.3} longitude={-84.8} country={{ name: 'Costa Rica' }} />)
  await waitFor(() => expect(FakeMap.instances).toHaveLength(1))
  rerender(<CoordinatePickerMap latitude={11.1} longitude={-85.4} country={{ name: 'Costa Rica' }} />)
  expect(FakeMarker.instances[0].position).toEqual({ lat: 11.1, lng: -85.4 })
})

test('clearing the coordinates hides the marker', async () => {
  const { FakeMap, FakeMarker } = installGoogleMapsMock()
  const { rerender } = render(<CoordinatePickerMap latitude={10.3} longitude={-84.8} country={{ name: 'Costa Rica' }} />)
  await waitFor(() => expect(FakeMap.instances).toHaveLength(1))
  rerender(<CoordinatePickerMap latitude={null} longitude={null} country={{ name: 'Costa Rica' }} />)
  expect(FakeMarker.instances[0].visible).toBe(false)
})

test('a missing browser API key shows an accessible configuration error', async () => {
  loadGoogleMaps.mockRejectedValue(new Error('Google Maps is not configured.'))
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Google Maps is not configured.')
})

test('tour form derives coordinates from its selected node and never submits separate coordinates', () => {
  const values = {
    countryId: 1, zoneId: 2, nodeId: 3, name: 'Night trail', type: 'Night walk',
    price: '90', availableSlots: '6', durationValue: '3', durationUnit: 'hours', difficulty: 'easy',
    description: '', startDate: '', endDate: '', sourceUrl: '',
    tourType: 'unscheduled', isActive: true, maxParticipants: '6', minimumPrice: '90',
  }
  expect(validateForm('tours', values, { nodes: [{ id: 3, lat: null, lon: null }] }))
    .toMatchObject({ nodeId: expect.any(String) })
  expect(validateForm('tours', values, { nodes: [{ id: 3, lat: 10.1, lon: -84 }] })).toEqual({})
  const payload = payloadFor('tours', values)
  expect(payload).toMatchObject({
    type: 'Night walk', nodeId: 3, maxParticipants: 6,
    durationValue: 3, durationUnit: 'hours',
  })
  expect(payload).not.toHaveProperty('availableSlots')
  expect(payload).not.toHaveProperty('startDate')
  expect(payload).not.toHaveProperty('endDate')
  expect(payload).not.toHaveProperty('durationHours')
  expect(payload).not.toHaveProperty('lat')
  expect(payload).not.toHaveProperty('lon')
})

test('country maintenance validates and serializes nullable viewport fields', () => {
  const values = {
    name: 'Costa Rica', acr: 'CR', latitude: '9.75', longitude: '-84.2', zoom: '7',
  }
  expect(validateForm('countries', values)).toEqual({})
  expect(payloadFor('countries', values)).toMatchObject({
    latitude: 9.75, longitude: -84.2, zoom: 7,
  })
  expect(validateForm('countries', { ...values, latitude: '91', longitude: '-181', zoom: '7.5' }))
    .toMatchObject({ latitude: expect.any(String), longitude: expect.any(String), zoom: expect.any(String) })
})

