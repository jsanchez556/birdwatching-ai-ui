import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import NodeMaintenanceDialog, { validateNode } from '../NodeMaintenanceDialog'
import {
  createMaintenance, listMaintenance, reverseGeocodeAdminLocation,
} from '../../../api/adminMaintenanceApi'
import useGooglePlaceAutocomplete from '../../../hooks/useGooglePlaceAutocomplete'

jest.mock('../../../api/adminMaintenanceApi', () => ({
  createMaintenance: jest.fn(), deleteMaintenance: jest.fn(), listMaintenance: jest.fn(),
  reverseGeocodeAdminLocation: jest.fn(), searchAdminLocations: jest.fn(), updateMaintenance: jest.fn(),
}))

// The 'Find a place by name' input attaches Google Places Autocomplete just like the
// transportation Pickup location input; tests select a place by invoking the mocked callback.
jest.mock('../../../hooks/useGooglePlaceAutocomplete', () => jest.fn())

function selectPlace(place) {
  const { onPlaceSelected } = useGooglePlaceAutocomplete.mock.calls.at(-1)[0]
  act(() => onPlaceSelected(place))
}

// Map panning, zoom, and pinch are handled natively by the Google Maps widget and are not
// part of this component's testable surface; the mock exposes deterministic selection buttons instead.
jest.mock('../CoordinatePickerMap', () => function CoordinatePickerMapMock({ latitude, longitude, onChange }) {
  const hasMarker = latitude !== null && latitude !== '' && latitude !== undefined
    && longitude !== null && longitude !== '' && longitude !== undefined
  return (
    <div role="application" aria-label="Coordinate map"
      data-center-latitude={latitude ?? ''} data-center-longitude={longitude ?? ''}>
      {hasMarker && <span aria-label={`Marker at latitude ${latitude}, longitude ${longitude}`} />}
      <button type="button" onClick={() => onChange({ latitude: 9.75, longitude: -84.2 })}>Select map point</button>
      <button type="button" onClick={() => onChange({ latitude: 10.1, longitude: -84.9 })}>Select alternate map point</button>
    </div>
  )
})

beforeEach(() => {
  jest.clearAllMocks()
  listMaintenance.mockResolvedValue({ items: [] })
  reverseGeocodeAdminLocation.mockResolvedValue(null)
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

test('selecting a place from the autocomplete synchronizes the marker and newly created node is selected', async () => {
  createMaintenance.mockResolvedValue({ id: 8, zoneId: 2, name: 'Cloud forest', lat: 10.3, lon: -84.8 })
  const onSaved = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country}
    zones={[{ id: 2, countryId: 1, name: 'North' }]} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={onSaved}
    returnFocusRef={{ current: null }} />)

  fireEvent.change(screen.getByLabelText('Zone'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Node name'), { target: { value: 'Cloud forest' } })
  selectPlace({ name: 'Monteverde', latitude: 10.3, longitude: -84.8 })
  expect(screen.getByLabelText('Latitude')).toHaveValue(10.3)
  expect(screen.getByLabelText('Longitude')).toHaveValue(-84.8)
  fireEvent.click(screen.getByRole('button', { name: 'Create node' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 8, lat: 10.3, lon: -84.8 })))
})

test('the autocomplete is restricted to the default country and attached to the search input', () => {
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const input = screen.getByRole('searchbox', { name: 'Find a place by name' })
  const { inputElement, countryCode } = useGooglePlaceAutocomplete.mock.calls.at(-1)[0]
  expect(inputElement).toBe(input)
  expect(countryCode).toBe('CR')
})

test('search input keeps its decorative icon and visible label', () => {
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  const input = screen.getByRole('searchbox', { name: 'Find a place by name' })
  const wrapper = input.closest('.node-location-search-input')
  expect(wrapper.querySelector(':scope > svg')).toHaveAttribute('aria-hidden', 'true')
  expect(input).toHaveAccessibleName('Find a place by name')
})

test('reverse-geocoding failure retains the selected coordinates and a formatted fallback', async () => {
  reverseGeocodeAdminLocation.mockRejectedValue(new Error('Location provider is unavailable.'))
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select map point' }))
  await waitFor(() => expect(screen.getByRole('alert'))
    .toHaveTextContent(/coordinates selected, but the place name could not be loaded/i))
  expect(screen.getByRole('searchbox')).toHaveValue('9.750000, -84.200000')
  expect(screen.getByLabelText('Latitude')).toHaveValue(9.75)
  expect(screen.getByLabelText('Longitude')).toHaveValue(-84.2)
})

test('a distant reverse-geocoding label cannot replace the authoritative map selection', async () => {
  reverseGeocodeAdminLocation.mockResolvedValue({
    name: 'Somewhere else, Costa Rica', latitude: 10.5, longitude: -85.0,
  })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)

  fireEvent.click(screen.getByRole('button', { name: 'Select map point' }))
  expect(await screen.findByText(/provider returned a distant place name/i)).toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveValue('9.750000, -84.200000')
  expect(screen.getByLabelText('Latitude')).toHaveValue(9.75)
  expect(screen.getByLabelText('Longitude')).toHaveValue(-84.2)
})

test('map click reverse geocodes the selected point', async () => {
  reverseGeocodeAdminLocation.mockResolvedValue({ name: 'Central Valley', latitude: 9.75, longitude: -84.2 })
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select map point' }))
  await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('Central Valley'))
  expect(reverseGeocodeAdminLocation).toHaveBeenCalledTimes(1)
})

test('a stale reverse-geocoding response cannot replace a newer map selection', async () => {
  const resolvers = []
  reverseGeocodeAdminLocation.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)))
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={jest.fn()} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select map point' }))
  await waitFor(() => expect(resolvers).toHaveLength(1))
  fireEvent.click(screen.getByRole('button', { name: 'Select alternate map point' }))
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

test('map placement remains dirty and requires confirmation through Escape or backdrop', async () => {
  const onClose = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={onClose} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select map point' }))
  await waitFor(() => expect(screen.queryByText('Finding a readable place name…')).not.toBeInTheDocument())

  fireEvent.keyDown(window, { key: 'Escape' })
  let confirmation = screen.getByRole('alertdialog', { name: 'Discard unsaved node changes?' })
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Keep editing' }))
  fireEvent.click(document.querySelector('.node-dialog-backdrop'))
  confirmation = screen.getByRole('alertdialog', { name: 'Discard unsaved node changes?' })
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Discard changes' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('pending reverse geocoding blocks dismissal until the lookup settles', async () => {
  let resolveLookup
  reverseGeocodeAdminLocation.mockReturnValue(new Promise((resolve) => { resolveLookup = resolve }))
  const onClose = jest.fn()
  render(<NodeMaintenanceDialog defaultCountry={country} zones={zones} nodes={[]} birds={[]}
    getAccessToken={jest.fn().mockResolvedValue('token')} onClose={onClose} onSaved={jest.fn()}
    returnFocusRef={{ current: null }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Select map point' }))
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
