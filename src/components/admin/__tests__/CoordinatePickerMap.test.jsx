import { fireEvent, render, screen } from '@testing-library/react'
import CoordinatePickerMap from '../CoordinatePickerMap'
import {
  FALLBACK_MAP_VIEW, projectMapPoint, resolveCountryMapView, unprojectMapPoint,
} from '../../../config/map'
import { payloadFor, validateForm } from '../AdminMaintenance'

function pointer(element, type, { pointerId, pointerType = 'mouse', ...init }) {
  const event = new MouseEvent(type, { bubbles: true, ...init })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  })
  fireEvent(element, event)
}

test('new maps use the country viewport', () => {
  render(<CoordinatePickerMap country={{
    name: 'Guatemala', latitude: 15.6, longitude: -90.3, zoom: 8,
  }} latitude={null} longitude={null} />)
  const map = screen.getByRole('application', { name: /centered on guatemala/i })
  expect(map).toHaveAttribute('data-center-latitude', '15.6')
  expect(map).toHaveAttribute('data-center-longitude', '-90.3')
  expect(map).toHaveAttribute('data-zoom', '8')
  expect(map.querySelector('img')).toHaveAttribute('src', expect.stringContaining('/8/'))
  expect(screen.getByText('View center: 15.6000, -90.3000 · Zoom 8')).toBeInTheDocument()
})

test.each([
  ['incomplete', { latitude: null, longitude: -84.2, zoom: 7 }],
  ['invalid latitude', { latitude: 91, longitude: -84.2, zoom: 7 }],
  ['invalid zoom', { latitude: 9.75, longitude: -84.2, zoom: 20 }],
])('%s country viewport uses the documented fallback', (_label, country) => {
  expect(resolveCountryMapView(country)).toEqual(FALLBACK_MAP_VIEW)
})

test('an incomplete country record initializes the rendered map at the fallback viewport', () => {
  render(<CoordinatePickerMap country={{ name: 'Incomplete', latitude: 9.5, longitude: null, zoom: 7 }} />)
  const map = screen.getByRole('application')
  expect(map).toHaveAttribute('data-center-latitude', '9.75')
  expect(map).toHaveAttribute('data-center-longitude', '-84.2')
  expect(map).toHaveAttribute('data-zoom', '7')
})

test('pointer selection uses the center-and-zoom view at responsive dimensions', () => {
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ name: 'Costa Rica', latitude: 9.75, longitude: -84.2, zoom: 7 }} latitude={null} longitude={null} onChange={onChange} />)
  const map = screen.getByRole('application', { name: /centered on costa rica/i })
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 288 })
  pointer(map, 'pointerdown', { pointerId: 1, clientX: 160, clientY: 144 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 160, clientY: 144 })
  expect(onChange).toHaveBeenCalledWith({ latitude: 9.75, longitude: -84.2 })
})

test.each([
  ['top-left', 0, 0, { latitude: 11.305349, longitude: -85.957813 }],
  ['bottom-right', 320, 288, { latitude: 8.187362, longitude: -82.442188 }],
])('pointer selection at the %s uses Web Mercator coordinates', (_label, clientX, clientY, expected) => {
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} onChange={onChange} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 288 })

  pointer(map, 'pointerdown', { pointerId: 1, clientX, clientY })
  pointer(map, 'pointerup', { pointerId: 1, clientX, clientY })
  expect(onChange).toHaveBeenCalledWith(expected)
})

test('placement remains accurate after panning', () => {
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} onChange={onChange} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 })

  pointer(map, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 150 })
  pointer(map, 'pointermove', { pointerId: 1, clientX: 260, clientY: 190 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 260, clientY: 190 })
  pointer(map, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 80 })
  pointer(map, 'pointerup', { pointerId: 2, clientX: 100, clientY: 80 })

  expect(onChange).toHaveBeenCalledWith({ latitude: 10.938831, longitude: -85.957813 })
})

test('zooming around the pointer preserves the geographic point beneath it', () => {
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} onChange={onChange} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 })

  fireEvent.wheel(map, { deltaY: -40, clientX: 300, clientY: 75 })
  pointer(map, 'pointerdown', { pointerId: 1, clientX: 300, clientY: 75 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 300, clientY: 75 })
  expect(onChange).toHaveBeenCalledWith({ latitude: 10.561058, longitude: -83.101367 })
})

test('responsive resizing changes screen coverage without shifting the center', () => {
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} onChange={onChange} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 30, top: 20, width: 800, height: 300 })

  pointer(map, 'pointerdown', { pointerId: 1, clientX: 30, clientY: 20 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 30, clientY: 20 })
  expect(onChange).toHaveBeenLastCalledWith({ latitude: 11.369981, longitude: -88.594531 })

  map.getBoundingClientRect = () => ({ left: 30, top: 20, width: 280, height: 220 })
  pointer(map, 'pointerdown', { pointerId: 2, clientX: 170, clientY: 130 })
  pointer(map, 'pointerup', { pointerId: 2, clientX: 170, clientY: 130 })
  expect(onChange).toHaveBeenLastCalledWith({ latitude: 9.75, longitude: -84.2 })
})

test('Web Mercator projection round-trips map coordinates', () => {
  const original = { latitude: 47.6062, longitude: -122.3321 }
  const projected = projectMapPoint(original, 11)
  expect(unprojectMapPoint(projected, 11)).toEqual(expect.objectContaining({
    latitude: expect.closeTo(original.latitude, 8),
    longitude: expect.closeTo(original.longitude, 8),
  }))
})

test('mouse wheel and trackpad wheel events zoom around the pointer', () => {
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 })

  fireEvent.wheel(map, { deltaY: -40, clientX: 200, clientY: 150 })
  expect(map).toHaveAttribute('data-zoom', '8')
  fireEvent.wheel(map, { deltaY: 40, clientX: 200, clientY: 150 })
  expect(map).toHaveAttribute('data-zoom', '7')
})

test('zoom buttons and keyboard controls zoom and pan the focused map', () => {
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} />)
  const map = screen.getByRole('application')
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
  expect(map).toHaveAttribute('data-zoom', '8')
  fireEvent.keyDown(map, { key: '-' })
  expect(map).toHaveAttribute('data-zoom', '7')

  fireEvent.keyDown(map, { key: 'ArrowRight' })
  expect(Number(map.getAttribute('data-center-longitude'))).toBeGreaterThan(-84.2)
})

test('dragging pans without placing a marker', () => {
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} onChange={onChange} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 })

  pointer(map, 'pointerdown', { pointerId: 1, clientX: 200, clientY: 150 })
  pointer(map, 'pointermove', { pointerId: 1, clientX: 260, clientY: 190 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 260, clientY: 190 })

  expect(Number(map.getAttribute('data-center-longitude'))).toBeLessThan(-84.2)
  expect(Number(map.getAttribute('data-center-latitude'))).toBeGreaterThan(9.75)
  expect(onChange).not.toHaveBeenCalled()
})

test('active pointer capture is released when the map unmounts', () => {
  const { unmount } = render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} />)
  const map = screen.getByRole('application')
  map.setPointerCapture = jest.fn()
  map.hasPointerCapture = jest.fn(() => true)
  map.releasePointerCapture = jest.fn()
  pointer(map, 'pointerdown', { pointerId: 41, clientX: 100, clientY: 100 })

  unmount()
  expect(map.releasePointerCapture).toHaveBeenCalledWith(41)
})

test('pointer cancellation releases every active gesture pointer', () => {
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} />)
  const map = screen.getByRole('application')
  map.setPointerCapture = jest.fn()
  map.hasPointerCapture = jest.fn(() => true)
  map.releasePointerCapture = jest.fn()
  pointer(map, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 })
  pointer(map, 'pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 })
  pointer(map, 'pointercancel', { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 })

  expect(map.releasePointerCapture).toHaveBeenCalledWith(1)
  expect(map.releasePointerCapture).toHaveBeenCalledWith(2)
})

test('two-finger pinch zooms without placing a marker', () => {
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} onChange={onChange} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 })

  pointer(map, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 150 })
  pointer(map, 'pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 150 })
  pointer(map, 'pointermove', { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 150 })
  pointer(map, 'pointerup', { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 150 })
  pointer(map, 'pointerup', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 150 })

  expect(map).toHaveAttribute('data-zoom', '8')
  expect(onChange).not.toHaveBeenCalled()

  pointer(map, 'pointerdown', { pointerId: 3, pointerType: 'touch', clientX: 200, clientY: 150 })
  pointer(map, 'pointerup', { pointerId: 3, pointerType: 'touch', clientX: 200, clientY: 150 })
  expect(onChange).toHaveBeenCalledWith({ latitude: 9.75, longitude: -84.749316 })
})

test('zoom controls enforce and expose the supported limits', () => {
  const { rerender } = render(<CoordinatePickerMap country={{ latitude: 0, longitude: 0, zoom: 19 }} />)
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeEnabled()

  rerender(<CoordinatePickerMap country={{ latitude: 0, longitude: 0, zoom: 0 }} />)
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled()
})

test('keyboard marker placement synchronizes the selected coordinates', () => {
  const onChange = jest.fn()
  render(<CoordinatePickerMap country={{ latitude: 9.75, longitude: -84.2, zoom: 7 }} onChange={onChange} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 20, top: 10, width: 320, height: 240 })

  fireEvent.keyDown(map, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith({ latitude: 9.75, longitude: -84.2 })
})

test('existing coordinates display a marker and initialize a focused view', () => {
  render(<CoordinatePickerMap latitude={10.3} longitude={-84.8} country={{ name: 'Costa Rica' }} />)
  expect(screen.getByLabelText(/marker at latitude 10.3, longitude -84.8/i)).toBeInTheDocument()
  const map = screen.getByRole('application')
  expect(map).toHaveAttribute('data-center-latitude', '10.3')
  expect(map).toHaveAttribute('data-center-longitude', '-84.8')
  expect(map).toHaveAttribute('data-zoom', '13')
})

test('numeric coordinate changes keep the marker and viewport synchronized', () => {
  const { rerender } = render(<CoordinatePickerMap latitude={10.3} longitude={-84.8} country={{ name: 'Costa Rica' }} />)
  rerender(<CoordinatePickerMap latitude={11.1} longitude={-85.4} country={{ name: 'Costa Rica' }} />)
  const map = screen.getByRole('application')
  expect(map).toHaveAttribute('data-center-latitude', '11.1')
  expect(map).toHaveAttribute('data-center-longitude', '-85.4')
  const marker = screen.getByLabelText(/marker at latitude 11.1, longitude -85.4/i)
  expect(marker).toHaveStyle({ left: 'calc(50% + 0px)', top: 'calc(50% + 0px)' })
})

test('a location-search focus point repositions the view without removing the marker', () => {
  const { rerender } = render(<CoordinatePickerMap latitude={10} longitude={-84} country={{ name: 'Costa Rica' }} />)
  rerender(<CoordinatePickerMap latitude={10} longitude={-84} country={{ name: 'Costa Rica' }}
    focusPoint={{ latitude: 9.93, longitude: -84.08 }} />)
  const map = screen.getByRole('application')
  expect(map).toHaveAttribute('data-center-latitude', '9.93')
  expect(map).toHaveAttribute('data-center-longitude', '-84.08')
  expect(map).toHaveAttribute('data-zoom', '13')
  expect(screen.getByLabelText(/marker at latitude 10, longitude -84/i)).toBeInTheDocument()
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
