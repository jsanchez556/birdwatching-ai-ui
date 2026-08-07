import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import NodeMaintenanceDialog, { validateNode } from '../NodeMaintenanceDialog'
import {
  createMaintenance, listMaintenance, reverseGeocodeAdminLocation, searchAdminLocations,
} from '../../../api/adminMaintenanceApi'

jest.mock('../../../api/adminMaintenanceApi', () => ({
  createMaintenance: jest.fn(), deleteMaintenance: jest.fn(), listMaintenance: jest.fn(),
  reverseGeocodeAdminLocation: jest.fn(), searchAdminLocations: jest.fn(), updateMaintenance: jest.fn(),
}))

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
const originalPermissions = Object.getOwnPropertyDescriptor(navigator, 'permissions')
const originalSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext')

function setGeolocation(value) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value })
}

function setPermissions(value) {
  Object.defineProperty(navigator, 'permissions', { configurable: true, value })
}

function setSecureContext(value) {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value })
}

function pointer(element, type, { pointerId, pointerType = 'mouse', ...init }) {
  const event = new MouseEvent(type, { bubbles: true, ...init })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
  })
  fireEvent(element, event)
}

function devicePosition(latitude, longitude, { accuracy = 25, timestamp = Date.now() } = {}) {
  return { coords: { latitude, longitude, accuracy }, timestamp }
}

beforeEach(() => {
  jest.clearAllMocks()
  listMaintenance.mockResolvedValue({ items: [] })
  reverseGeocodeAdminLocation.mockResolvedValue(null)
  setGeolocation(undefined)
  setPermissions(undefined)
  setSecureContext(true)
})

afterAll(() => {
  if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation)
  else delete navigator.geolocation
  if (originalPermissions) Object.defineProperty(navigator, 'permissions', originalPermissions)
  else delete navigator.permissions
  if (originalSecureContext) Object.defineProperty(window, 'isSecureContext', originalSecureContext)
  else delete window.isSecureContext
})

const country = { id: 1, name: 'Costa Rica', acr: 'CR', latitude: 9.75, longitude: -84.2, zoom: 7 }
const zones = [{ id: 2, countryId: 1, name: 'North' }]

function NodeDialogHarness({ node = null }) {
  const [open, setOpen] = useState(false)
  const openerRef = useRef(null)
  return <>
    <button ref={openerRef} type="button" onClick={() => setOpen(true)}>Open node</button>
    {open && <NodeMaintenanceDialog node={node} defaultCountry={country} zones={zones} nodes={[]} birds={[]}
      getAccessToken={jest.fn().mockResolvedValue('token')} onClose={() => setOpen(false)} onSaved={jest.fn()}
      returnFocusRef={openerRef} />}
  </>
}

test('validates required node coordinates', () => {
  expect(validateNode({ zoneId: 1, name: 'Cloud forest', lat: '', lon: '' }))
    .toMatchObject({ lat: expect.any(String), lon: expect.any(String) })
  expect(validateNode({ zoneId: 1, name: 'Cloud forest', lat: null, lon: null }))
    .toMatchObject({ lat: expect.any(String), lon: expect.any(String) })
})

test('search result synchronizes the marker and newly created node is selected', async () => {
  searchAdminLocations.mockResolvedValue([{ name: 'Monteverde', latitude: 10.3, longitude: -84.8 }])
  createMaintenance.mockResolvedValue({ id: 8, zoneId: 2, name: 'Cloud forest', lat: 10.3, lon: -84.8 })
  const onSaved = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country}
    zones={[{ id: 2, countryId: 1, name: 'North' }]} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={onSaved}
    returnFocusRef={{ current: null }} />)

  fireEvent.change(screen.getByLabelText('Zone'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Node name'), { target: { value: 'Cloud forest' } })
  fireEvent.change(screen.getByLabelText('Find a place by name'), { target: { value: 'Monteverde' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search map' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Monteverde' }))
  expect(screen.getByLabelText('Latitude')).toHaveValue(10.3)
  expect(screen.getByLabelText('Longitude')).toHaveValue(-84.8)
  fireEvent.click(screen.getByRole('button', { name: 'Create node' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 8, lat: 10.3, lon: -84.8 })))
})

test('search input keeps its decorative icon, visible label, and compact search action', () => {
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const input = screen.getByRole('searchbox', { name: 'Find a place by name' })
  const wrapper = input.closest('.node-location-search-input')
  expect(wrapper.querySelector(':scope > svg')).toHaveAttribute('aria-hidden', 'true')
  expect(input).toHaveAccessibleName('Find a place by name')
  const searchButton = screen.getByRole('button', { name: 'Search map' })
  expect(searchButton).toHaveAttribute('title', 'Search map')
  expect(searchButton).toHaveClass('maintenance-icon-button')
  expect(searchButton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

test('location icon is embedded on the input right with accessible compact-button semantics', async () => {
  setGeolocation({ getCurrentPosition: jest.fn() })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const input = screen.getByRole('searchbox')
  const wrapper = input.closest('.node-location-search-input')
  const locationButton = await screen.findByRole('button', { name: 'Use current location' })
  expect(wrapper).toHaveClass('has-location-action')
  expect(wrapper).toContainElement(locationButton)
  expect(locationButton).toHaveAttribute('title', 'Use current location')
  expect(locationButton).toHaveClass('maintenance-icon-button', 'node-location-input-action')
  expect(locationButton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

test.each([375, 1280])('location input keeps separate left and right icon slots at %spx', async (width) => {
  window.innerWidth = width
  setGeolocation({ getCurrentPosition: jest.fn() })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const input = screen.getByRole('searchbox')
  const wrapper = input.closest('.node-location-search-input')
  const locationButton = screen.getByRole('button', { name: 'Use current location' })
  expect(wrapper.firstElementChild.tagName).toBe('svg')
  expect(input.nextElementSibling).toBe(locationButton)
  expect(wrapper).toHaveClass('has-location-action')
})

test('Enter in the location field performs text search without submitting the node form', async () => {
  searchAdminLocations.mockResolvedValue([])
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const input = screen.getByRole('searchbox')
  fireEvent.change(input, { target: { value: 'Monteverde' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(searchAdminLocations).toHaveBeenCalledWith('Monteverde', {
    token: 'token', countryCode: 'CR',
  }))
  expect(createMaintenance).not.toHaveBeenCalled()
})

test('current-location action is available at mobile and desktop widths only when supported', () => {
  const getCurrentPosition = jest.fn()
  setGeolocation({ getCurrentPosition })
  window.innerWidth = 375
  const { rerender } = render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  expect(screen.getByRole('button', { name: 'Use current location' })).toBeVisible()
  expect(getCurrentPosition).not.toHaveBeenCalled()
  window.innerWidth = 1280
  rerender(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  expect(screen.getByRole('button', { name: 'Use current location' })).toBeVisible()
})

test.each(['granted', 'prompt'])('geolocation permission %s enables the action without requesting location', async (state) => {
  const getCurrentPosition = jest.fn()
  setGeolocation({ getCurrentPosition })
  setPermissions({ query: jest.fn().mockResolvedValue({ state, addEventListener: jest.fn(), removeEventListener: jest.fn() }) })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)

  const action = await screen.findByRole('button', { name: 'Use current location' })
  await waitFor(() => expect(action).toBeEnabled())
  expect(navigator.permissions.query).toHaveBeenCalledWith({ name: 'geolocation' })
  expect(getCurrentPosition).not.toHaveBeenCalled()
})

test('denied geolocation permission disables the action with an accessible explanation', async () => {
  setGeolocation({ getCurrentPosition: jest.fn() })
  setPermissions({ query: jest.fn().mockResolvedValue({ state: 'denied', addEventListener: jest.fn(), removeEventListener: jest.fn() }) })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const action = screen.getByRole('button', { name: 'Use current location' })
  await waitFor(() => expect(action).toBeDisabled())
  expect(document.getElementById('node-location-availability')).toHaveTextContent(/permission is denied/i)
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled()
})

test('permission-state changes update the current-location action', async () => {
  let notifyChange
  const permissionStatus = {
    state: 'prompt',
    addEventListener: jest.fn((_event, callback) => { notifyChange = callback }),
    removeEventListener: jest.fn(),
  }
  setGeolocation({ getCurrentPosition: jest.fn() })
  setPermissions({ query: jest.fn().mockResolvedValue(permissionStatus) })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const action = screen.getByRole('button', { name: 'Use current location' })
  await waitFor(() => expect(action).toBeEnabled())

  permissionStatus.state = 'denied'
  act(() => notifyChange())
  expect(action).toBeDisabled()
  permissionStatus.state = 'granted'
  act(() => notifyChange())
  expect(action).toBeEnabled()
})

test('missing Permissions API allows explicit geolocation fallback', () => {
  const getCurrentPosition = jest.fn()
  setGeolocation({ getCurrentPosition })
  setPermissions(undefined)
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const action = screen.getByRole('button', { name: 'Use current location' })
  expect(action).toBeEnabled()
  fireEvent.click(action)
  expect(getCurrentPosition).toHaveBeenCalledTimes(1)
})

test.each([
  ['keyboard', 0],
  ['touch', 1],
])('%s activation invokes geolocation only through the native location button', (_mode, detail) => {
  const getCurrentPosition = jest.fn()
  setGeolocation({ getCurrentPosition })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const action = screen.getByRole('button', { name: 'Use current location' })
  action.focus()
  fireEvent.click(action, { detail })
  expect(action).toHaveFocus()
  expect(getCurrentPosition).toHaveBeenCalledTimes(1)
})

test('unsupported geolocation shows an actionable fallback without a location button', () => {
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  expect(screen.queryByRole('button', { name: 'Use current location' })).not.toBeInTheDocument()
  expect(screen.getByText(/current location is not supported by this browser/i)).toBeInTheDocument()
})

test('insecure contexts hide current location and explain the HTTPS requirement', () => {
  setGeolocation({ getCurrentPosition: jest.fn() })
  setSecureContext(false)
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  expect(screen.queryByRole('button', { name: 'Use current location' })).not.toBeInTheDocument()
  expect(document.getElementById('node-location-availability')).toHaveTextContent(/secure https connection/i)
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled()
})

test('current location synchronizes coordinates, map focus, marker, and readable place name', async () => {
  setGeolocation({ getCurrentPosition: jest.fn((success) => success(
    devicePosition(9.93251234, -84.07961234, { accuracy: 25 }),
  )) })
  reverseGeocodeAdminLocation.mockResolvedValue({
    name: 'San José, Costa Rica', latitude: 9.93251234, longitude: -84.07961234,
  })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)

  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
  expect(navigator.geolocation.getCurrentPosition).toHaveBeenCalledWith(
    expect.any(Function), expect.any(Function),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  )
  await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Find a place by name' }))
    .toHaveValue('San José, Costa Rica'))
  expect(reverseGeocodeAdminLocation).toHaveBeenCalledWith({
    latitude: 9.93251234, longitude: -84.07961234,
  }, { token: 'token' })
  expect(screen.getByLabelText('Latitude')).toHaveValue(9.93251234)
  expect(screen.getByLabelText('Longitude')).toHaveValue(-84.07961234)
  expect(screen.getByRole('application')).toHaveAttribute('data-center-latitude', '9.93251234')
  expect(screen.getByLabelText(/marker at latitude/i)).toHaveAttribute(
    'aria-label', 'Marker at latitude 9.93251234, longitude -84.07961234',
  )
  expect(screen.getByText('Accurate within approximately 25 m.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry current location' })).toBeEnabled()
})

test.each([
  [1, /permission was denied/i],
  [2, /current location is unavailable/i],
  [3, /timed out/i],
])('current-location error %s is explained safely', (code, message) => {
  setGeolocation({ getCurrentPosition: jest.fn((_success, failure) => failure({ code })) })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
  expect(screen.getByRole('alert')).toHaveTextContent(message)
})

test('reverse-geocoding failure retains selected coordinates and a formatted fallback', async () => {
  setGeolocation({ getCurrentPosition: jest.fn((success) => success(
    devicePosition(10.123456, -84.654321),
  )) })
  reverseGeocodeAdminLocation.mockRejectedValue(new Error('Location provider is unavailable.'))
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
  await waitFor(() => expect(screen.getByRole('alert'))
    .toHaveTextContent(/coordinates selected, but the place name could not be loaded/i))
  expect(screen.getByRole('searchbox')).toHaveValue('10.123456, -84.654321')
  expect(screen.getByLabelText('Latitude')).toHaveValue(10.123456)
  expect(screen.getByLabelText('Longitude')).toHaveValue(-84.654321)
})

test('a distant reverse-geocoding label cannot replace authoritative device coordinates', async () => {
  setGeolocation({ getCurrentPosition: jest.fn((success) => success(
    devicePosition(10.733, -85.044, { accuracy: 20 }),
  )) })
  reverseGeocodeAdminLocation.mockResolvedValue({
    name: 'Calle Santa Marta, Bocas de Nosara', latitude: 9.95, longitude: -85.65,
  })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)

  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
  expect(await screen.findByText(/provider returned a distant place name/i)).toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveValue('10.733000, -85.044000')
  expect(screen.getByLabelText('Latitude')).toHaveValue(10.733)
  expect(screen.getByLabelText('Longitude')).toHaveValue(-85.044)
  expect(screen.getByRole('button', { name: 'Retry current location' })).toBeEnabled()
})

test('warns for an approximate accepted location and allows a retry', async () => {
  const getCurrentPosition = jest.fn((success) => success(
    devicePosition(10.7, -85.05, { accuracy: 450 }),
  ))
  setGeolocation({ getCurrentPosition })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)

  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
  expect(await screen.findByText(/accurate within approximately 450 m/i)).toHaveTextContent(/review the marker/i)
  const retry = screen.getByRole('button', { name: 'Retry current location' })
  await waitFor(() => expect(retry).toBeEnabled())
  fireEvent.click(retry)
  expect(getCurrentPosition).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(retry).toBeEnabled())
})

test('rejects an unacceptably inaccurate location without moving the marker', () => {
  setGeolocation({ getCurrentPosition: jest.fn((success) => success(
    devicePosition(10.7, -85.05, { accuracy: 1500 }),
  )) })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)

  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
  expect(screen.getByRole('alert')).toHaveTextContent(/accuracy of approximately 1500 m/i)
  expect(screen.getByLabelText('Latitude')).toHaveValue(null)
  expect(screen.getByLabelText('Longitude')).toHaveValue(null)
  expect(reverseGeocodeAdminLocation).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Retry current location' })).toBeEnabled()
})

test('rejects stale device positions before changing coordinates or reverse geocoding', () => {
  setGeolocation({ getCurrentPosition: jest.fn((success) => success(
    devicePosition(10.7, -85.05, { timestamp: Date.now() - 180000 }),
  )) })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)

  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
  expect(screen.getByRole('alert')).toHaveTextContent(/old or invalidly timestamped position/i)
  expect(screen.getByLabelText('Latitude')).toHaveValue(null)
  expect(reverseGeocodeAdminLocation).not.toHaveBeenCalled()
})

test('ignores an older device callback after a newer map selection', async () => {
  let resolveDevice
  setGeolocation({ getCurrentPosition: jest.fn((success) => { resolveDevice = success }) })
  reverseGeocodeAdminLocation.mockResolvedValue({ name: 'Map selection', latitude: 9.75, longitude: -84.2 })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))

  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 288 })
  pointer(map, 'pointerdown', { pointerId: 1, clientX: 160, clientY: 144 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 160, clientY: 144 })
  await act(async () => resolveDevice(devicePosition(10.7, -85.05)))

  expect(screen.getByLabelText('Latitude')).toHaveValue(9.75)
  expect(screen.getByLabelText('Longitude')).toHaveValue(-84.2)
  expect(reverseGeocodeAdminLocation).not.toHaveBeenCalledWith(
    expect.objectContaining({ latitude: 10.7, longitude: -85.05 }), expect.anything(),
  )
})

test('map click reverse geocodes once while map panning does not', async () => {
  reverseGeocodeAdminLocation.mockResolvedValue({ name: 'Central Valley', latitude: 9.75, longitude: -84.2 })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 288 })
  pointer(map, 'pointerdown', { pointerId: 1, clientX: 160, clientY: 144 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 160, clientY: 144 })
  await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('Central Valley'))
  expect(reverseGeocodeAdminLocation).toHaveBeenCalledTimes(1)

  pointer(map, 'pointerdown', { pointerId: 2, clientX: 100, clientY: 100 })
  pointer(map, 'pointermove', { pointerId: 2, clientX: 180, clientY: 150 })
  pointer(map, 'pointerup', { pointerId: 2, clientX: 180, clientY: 150 })
  expect(reverseGeocodeAdminLocation).toHaveBeenCalledTimes(1)
})

test('a stale reverse-geocoding response cannot replace a newer map selection', async () => {
  const resolvers = []
  reverseGeocodeAdminLocation.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)))
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 288 })

  pointer(map, 'pointerdown', { pointerId: 1, clientX: 140, clientY: 144 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 140, clientY: 144 })
  await waitFor(() => expect(resolvers).toHaveLength(1))
  pointer(map, 'pointerdown', { pointerId: 2, clientX: 190, clientY: 144 })
  pointer(map, 'pointerup', { pointerId: 2, clientX: 190, clientY: 144 })
  await waitFor(() => expect(resolvers).toHaveLength(2))

  await act(async () => resolvers[1]({ name: 'Newer selection' }))
  expect(screen.getByRole('searchbox')).toHaveValue('Newer selection')
  await act(async () => resolvers[0]({ name: 'Stale selection' }))
  expect(screen.getByRole('searchbox')).toHaveValue('Newer selection')
})

test('clean backdrop dismissal ignores inside clicks and restores opener focus', () => {
  render(<NodeDialogHarness />)
  const opener = screen.getByRole('button', { name: 'Open node' })
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Create node' })
  fireEvent.click(dialog)
  expect(dialog).toBeInTheDocument()
  fireEvent.click(document.querySelector('.node-dialog-backdrop'))
  expect(screen.queryByRole('dialog', { name: 'Create node' })).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

test('map drag, zoom, and pinch release capture and do not prevent close-button dismissal', () => {
  render(<NodeDialogHarness />)
  const opener = screen.getByRole('button', { name: 'Open node' })
  fireEvent.click(opener)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 })
  map.setPointerCapture = jest.fn()
  map.hasPointerCapture = jest.fn(() => true)
  map.releasePointerCapture = jest.fn()

  pointer(map, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 100 })
  pointer(map, 'pointermove', { pointerId: 1, clientX: 180, clientY: 140 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 180, clientY: 140 })
  fireEvent.wheel(map, { deltaY: -40, clientX: 200, clientY: 150 })
  pointer(map, 'pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 150 })
  pointer(map, 'pointerdown', { pointerId: 3, pointerType: 'touch', clientX: 200, clientY: 150 })
  pointer(map, 'pointermove', { pointerId: 3, pointerType: 'touch', clientX: 300, clientY: 150 })
  pointer(map, 'pointerup', { pointerId: 3, pointerType: 'touch', clientX: 300, clientY: 150 })
  pointer(map, 'pointerup', { pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 150 })

  expect(map.releasePointerCapture).toHaveBeenCalledTimes(3)
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog', { name: 'Create node' })).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

test('map placement remains dirty and requires confirmation through Escape or backdrop', async () => {
  const onClose = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={onClose} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 288 })
  pointer(map, 'pointerdown', { pointerId: 1, clientX: 160, clientY: 144 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 160, clientY: 144 })
  await waitFor(() => expect(screen.queryByText('Finding a readable place name…')).not.toBeInTheDocument())

  fireEvent.keyDown(window, { key: 'Escape' })
  let confirmation = screen.getByRole('alertdialog', { name: 'Discard unsaved node changes?' })
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Keep editing' }))
  fireEvent.click(document.querySelector('.node-dialog-backdrop'))
  confirmation = screen.getByRole('alertdialog', { name: 'Discard unsaved node changes?' })
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Discard changes' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('pending geolocation blocks close, Escape, and backdrop dismissal', () => {
  setGeolocation({ getCurrentPosition: jest.fn() })
  const onClose = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={onClose} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
  expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(document.querySelector('.node-dialog-backdrop'))
  expect(onClose).not.toHaveBeenCalled()
})

test('pending reverse geocoding blocks dismissal until the lookup settles', async () => {
  let resolveLookup
  reverseGeocodeAdminLocation.mockReturnValue(new Promise((resolve) => { resolveLookup = resolve }))
  const onClose = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={onClose} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const map = screen.getByRole('application')
  map.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 288 })
  pointer(map, 'pointerdown', { pointerId: 1, clientX: 160, clientY: 144 })
  pointer(map, 'pointerup', { pointerId: 1, clientX: 160, clientY: 144 })
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true'))
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.click(document.querySelector('.node-dialog-backdrop'))
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => resolveLookup({ name: 'Selected place', latitude: 9.75, longitude: -84.2 }))
  expect(screen.getByRole('searchbox')).toHaveValue('Selected place')
})

test('dirty node backdrop requires explicit discard confirmation', () => {
  const onClose = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={onClose} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.change(screen.getByLabelText('Node name'), { target: { value: 'New forest' } })
  fireEvent.click(document.querySelector('.node-dialog-backdrop'))
  const confirmation = screen.getByRole('alertdialog', { name: 'Discard unsaved node changes?' })
  expect(within(confirmation).getByRole('button', { name: 'Keep editing' })).toHaveFocus()
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Keep editing' }))
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(document.querySelector('.node-dialog-backdrop'))
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('backdrop cannot close a node while its save is pending', async () => {
  let resolveSave
  createMaintenance.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
  const onClose = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={onClose} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.change(screen.getByLabelText('Zone'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Node name'), { target: { value: 'New forest' } })
  fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '10.2' } })
  fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-84.7' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create node' }))
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true'))
  fireEvent.click(document.querySelector('.node-dialog-backdrop'))
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => resolveSave({ id: 12, zoneId: 2, name: 'New forest', lat: 10.2, lon: -84.7 }))
})

test('existing node dialog loads and updates bird assignments', async () => {
  listMaintenance.mockResolvedValue({ items: [] })
  createMaintenance.mockResolvedValue({ id: 50, nodeId: 8, birdId: 4, birdName: 'Quetzal' })
  render(<NodeMaintenanceDialog node={{ id: 8, zoneId: 2, name: 'Cloud forest', lat: 10.3, lon: -84.8 }}
    defaultCountry={country} zones={zones} nodes={[]} birds={[{ id: 4, name: 'Quetzal' }]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  await waitFor(() => expect(screen.queryByText('Loading bird assignments…')).not.toBeInTheDocument())
  fireEvent.change(screen.getByLabelText('Bird'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Assign bird' }))
  await waitFor(() => expect(createMaintenance).toHaveBeenCalledWith('birds-by-node', expect.objectContaining({
    nodeId: 8, birdId: 4,
  }), { token: 'token' }))
  expect(await screen.findByText('Quetzal')).toBeInTheDocument()
})
