import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import AdminMaintenance from '../AdminMaintenance'
import useAdminMaintenance from '../../../hooks/useAdminMaintenance'
import { createMaintenance, getTourImageReference, listMaintenance } from '../../../api/adminMaintenanceApi'

jest.mock('../../../hooks/useAdminMaintenance', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('../../../api/adminMaintenanceApi', () => ({
  appendTourImageVersion: jest.fn((url, version) => version ? `${url}?v=${version}` : url),
  getTourImageReference: jest.fn((id, imagePath, version) => {
    const url = `/files/${imagePath || `tours/${id}.png`}`
    return imagePath && version ? `${url}?v=${version}` : url
  }),
  listMaintenance: jest.fn(), createMaintenance: jest.fn(), deleteMaintenance: jest.fn(),
  searchAdminLocations: jest.fn(), updateMaintenance: jest.fn(),
}))
jest.mock('../../../api/myToursApi', () => ({ loadMyTourReferences: jest.fn() }))
jest.mock('../../../hooks/useResolvedMediaUrl', () => ({
  useResolvedMedia: jest.fn((value) => ({
    url: value ? `https://cdn.example.test${value}` : '', isResolving: false, error: null,
  })),
}))

const references = {
  countries: [{ id: 1, name: 'Costa Rica', acr: 'CR', latitude: 9.75, longitude: -84.2, zoom: 7 }],
  zones: [{ id: 2, countryId: 1, countryName: 'Costa Rica', name: 'Northern zone', rank: 1, isActive: true }],
  nodes: [{ id: 3, zoneId: 2, countryId: 1, name: 'Cloud forest', lat: 10.3, lon: -84.8 }],
  birds: [{ id: 4, name: 'Resplendent Quetzal', speciesCode: 'RESQUE', tags: ['forest'], isActive: true }],
}

function maintenanceState(items, overrides = {}) {
  return {
    clearError: jest.fn(), error: null, isRemoving: false, isSaving: false, items, load: jest.fn(),
    meta: { page: 2, limit: 25, total: 30, totalPages: 3 }, notice: null,
    remove: jest.fn(), save: jest.fn().mockResolvedValue({}), status: 'success', ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  listMaintenance.mockImplementation(async (resource) => ({ items: references[resource] || [], meta: {} }))
})

test('Tours renders a search-only paginated grid and opens its reused editor in a dialog', async () => {
  const state = maintenanceState([{
    id: 9, name: 'Forest dawn', type: 'Birdwatching', nodeId: 3, nodeName: 'Cloud forest',
    countryId: 1, zoneId: 2, durationHours: 4, price: 95, isActive: true,
    ownerStatus: 'active', ownerName: 'Guide One', availableSlots: 8, difficulty: 'easy',
  }])
  useAdminMaintenance.mockReturnValue(state)
  render(<AdminMaintenance resource="tours" getAccessToken={jest.fn().mockResolvedValue('token')} showOwner />)

  expect(await screen.findByRole('table', { name: 'Tours maintenance records' })).toBeInTheDocument()
  for (const heading of ['Name', 'Type', 'Node / location', 'Duration', 'Price', 'Publication', 'Owner']) {
    expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument()
  }
  const search = screen.getByRole('search')
  expect(within(search).getAllByRole('searchbox')).toHaveLength(1)
  expect(within(search).queryByRole('combobox')).not.toBeInTheDocument()
  const create = await screen.findByRole('button', { name: 'Create tour' })
  await waitFor(() => expect(create).toBeEnabled())
  expect(search).not.toContainElement(create)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  const edit = screen.getByRole('button', { name: 'Edit Forest dawn' })
  expect(edit).toHaveAttribute('title', 'Edit Forest dawn')
  expect(edit.querySelector('svg')).toBeInTheDocument()
  const archive = screen.getByRole('button', { name: 'Archive Forest dawn' })
  expect(archive).toHaveAttribute('title', 'Archive Forest dawn')
  expect(archive.querySelector('svg')).toBeInTheDocument()
  fireEvent.click(edit)
  const dialog = screen.getByRole('dialog', { name: 'Edit tour' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toContainElement(document.activeElement)
  expect(within(dialog).getByLabelText('Tour name')).toHaveValue('Forest dawn')
  const saveChanges = within(dialog).getByRole('button', { name: 'Save changes' })
  saveChanges.focus()
  fireEvent.keyDown(window, { key: 'Tab' })
  expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()
  const createNode = within(dialog).getByRole('button', { name: 'Create node' })
  expect(createNode).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: /edit node and birds/i })).not.toBeInTheDocument()
  expect(createNode.closest('.tour-node-picker')).toContainElement(within(dialog).getByLabelText('Node / location'))

  fireEvent.change(within(dialog).getByLabelText('Tour name'), { target: { value: 'Forest sunrise' } })
  fireEvent.click(createNode)
  const nodeDialog = screen.getByRole('dialog', { name: 'Create node' })
  fireEvent.click(within(nodeDialog).getByRole('button', { name: 'Close' }))
  expect(within(dialog).getByLabelText('Tour name')).toHaveValue('Forest sunrise')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument()
  const discard = screen.getByRole('button', { name: 'Discard changes' })
  fireEvent.click(discard)
  expect(screen.queryByRole('dialog', { name: 'Edit tour' })).not.toBeInTheDocument()
  expect(edit).toHaveFocus()

  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(state.load).toHaveBeenCalledWith({ page: 3 })
})

test('tour editor hides flexible schedule fields and submits scheduled fields with duration units', async () => {
  const state = maintenanceState([{
    id: 9, name: 'Forest dawn', type: 'Birdwatching', nodeId: 3, nodeName: 'Cloud forest',
    countryId: 1, zoneId: 2, durationValue: 1, durationUnit: 'days', durationHours: 24,
    maxParticipants: 6, price: 95, minimumPrice: 95, tourType: 'unscheduled',
    isActive: true, difficulty: 'easy',
  }])
  useAdminMaintenance.mockReturnValue(state)
  render(<AdminMaintenance resource="tours" getAccessToken={jest.fn().mockResolvedValue('token')} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create tour' })).toBeEnabled())
  expect(screen.getByText('1 day')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Edit Forest dawn' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit tour' })
  expect(within(dialog).queryByLabelText('Available slots')).not.toBeInTheDocument()
  expect(within(dialog).queryByLabelText('Start date')).not.toBeInTheDocument()
  expect(within(dialog).queryByLabelText('End date')).not.toBeInTheDocument()

  fireEvent.change(within(dialog).getByLabelText('Schedule mode'), { target: { value: 'scheduled' } })
  fireEvent.change(within(dialog).getByLabelText('Available slots'), { target: { value: '4' } })
  fireEvent.change(within(dialog).getByLabelText('Start date'), { target: { value: '2030-01-10' } })
  fireEvent.change(within(dialog).getByLabelText('End date'), { target: { value: '2030-01-12' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(state.save).toHaveBeenCalledWith(expect.objectContaining({
    id: 9,
    data: expect.objectContaining({
      tourType: 'scheduled', durationValue: 1, durationUnit: 'days',
      availableSlots: 4, startDate: '2030-01-10', endDate: '2030-01-12',
    }),
  })))
})

test('tour node creation closes its layer, refreshes nodes, selects it, and preserves the draft', async () => {
  const state = maintenanceState([{
    id: 9, name: 'Forest dawn', type: 'Birdwatching', nodeId: 3, nodeName: 'Cloud forest',
    countryId: 1, zoneId: 2, durationHours: 4, price: 95, isActive: true,
    availableSlots: 8, difficulty: 'easy', imagePath: 'tours/9.png',
  }])
  useAdminMaintenance.mockReturnValue(state)
  createMaintenance.mockResolvedValue({ id: 12, zoneId: 2, name: 'River trail', lat: 10.4, lon: -84.6 })
  render(<AdminMaintenance resource="tours" getAccessToken={jest.fn().mockResolvedValue('token')} showOwner />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create tour' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Edit Forest dawn' }))
  const tourDialog = screen.getByRole('dialog', { name: 'Edit tour' })
  fireEvent.change(within(tourDialog).getByLabelText('Tour name'), { target: { value: 'Unsaved sunrise draft' } })
  const createNode = within(tourDialog).getByRole('button', { name: 'Create node' })
  fireEvent.click(createNode)
  const nodeDialog = screen.getByRole('dialog', { name: 'Create node' })
  fireEvent.change(within(nodeDialog).getByLabelText('Zone'), { target: { value: '2' } })
  fireEvent.change(within(nodeDialog).getByLabelText('Node name'), { target: { value: 'River trail' } })
  fireEvent.change(within(nodeDialog).getByLabelText('Latitude'), { target: { value: '10.4' } })
  fireEvent.change(within(nodeDialog).getByLabelText('Longitude'), { target: { value: '-84.6' } })
  fireEvent.click(within(nodeDialog).getByRole('button', { name: 'Create node' }))

  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create node' })).not.toBeInTheDocument())
  expect(within(tourDialog).getByLabelText('Tour name')).toHaveValue('Unsaved sunrise draft')
  expect(within(tourDialog).getByLabelText('Node / location')).toHaveValue('12')
  expect(createNode).toHaveFocus()
  await waitFor(() => expect(listMaintenance).toHaveBeenCalledWith('nodes', { token: 'token', limit: 100 }))
})

test('previews and submits a replacement PNG while preserving retry state', async () => {
  const tour = {
    id: 9, name: 'Forest dawn', type: 'Birdwatching', nodeId: 3, nodeName: 'Cloud forest',
    countryId: 1, zoneId: 2, durationHours: 4, price: 95, isActive: true,
    availableSlots: 8, difficulty: 'easy', imagePath: 'tours/9.png',
  }
  const state = maintenanceState([tour])
  state.save
    .mockResolvedValueOnce({ image: {
      key: 'tours/9.png',
      url: '/files/tours/9.png?v=123',
      version: '123',
    } })
    .mockResolvedValueOnce({ image: {
      key: 'tours/9.png',
      url: '/files/tours/9.png?v=456',
      version: '456',
    } })
  useAdminMaintenance.mockReturnValue(state)
  const onTourImageUpdated = jest.fn()
  render(<AdminMaintenance resource="tours" getAccessToken={jest.fn().mockResolvedValue('token')}
    onTourImageUpdated={onTourImageUpdated} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create tour' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Edit Forest dawn' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit tour' })

  expect(within(dialog).getByAltText('Current image for Forest dawn')).toBeInTheDocument()
  expect(getTourImageReference).toHaveBeenCalledWith(9, 'tours/9.png', undefined)
  const file = new File(
    ['png'],
    'replacement-tour-image-with-a-long-descriptive-filename.png',
    { type: 'image/png' },
  )
  fireEvent.change(within(dialog).getByLabelText('Tour image'), { target: { files: [file] } })

  expect(await within(dialog).findByAltText('New image preview for Forest dawn')).toBeInTheDocument()
  const selectionStatus = within(dialog).getByText(`Selected: ${file.name}`)
  expect(selectionStatus).toHaveTextContent(`Selected: ${file.name}`)
  expect(selectionStatus).toHaveAttribute('role', 'status')
  expect(selectionStatus).toHaveAttribute('title', file.name)
  expect(within(dialog).getByRole('button', { name: 'Remove selected image' })).toBeEnabled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(state.save).toHaveBeenCalledWith(expect.objectContaining({
    id: 9,
    data: null,
    image: file,
  })))
  expect(onTourImageUpdated).toHaveBeenCalledWith({
    tourId: 9,
    imagePath: 'tours/9.png',
    url: '/files/tours/9.png?v=123',
    version: '123',
  })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit tour' })).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Edit Forest dawn' }))
  expect(within(screen.getByRole('dialog', { name: 'Edit tour' }))
    .getByAltText('Current image for Forest dawn'))
    .toHaveAttribute('src', 'https://cdn.example.test/files/tours/9.png?v=123')

  const reopenedDialog = screen.getByRole('dialog', { name: 'Edit tour' })
  const secondFile = new File(['png'], 'second-replacement.png', { type: 'image/png' })
  fireEvent.change(within(reopenedDialog).getByLabelText('Tour image'), {
    target: { files: [secondFile] },
  })
  await within(reopenedDialog).findByAltText('New image preview for Forest dawn')
  fireEvent.click(within(reopenedDialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit tour' })).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Edit Forest dawn' }))
  expect(within(screen.getByRole('dialog', { name: 'Edit tour' }))
    .getByAltText('Current image for Forest dawn'))
    .toHaveAttribute('src', 'https://cdn.example.test/files/tours/9.png?v=456')
  expect(onTourImageUpdated).toHaveBeenLastCalledWith({
    tourId: 9,
    imagePath: 'tours/9.png',
    url: '/files/tours/9.png?v=456',
    version: '456',
  })
})

test('rejects invalid tour images before saving and allows the selection to be cleared', async () => {
  const tour = {
    id: 9, name: 'Forest dawn', type: 'Birdwatching', nodeId: 3, nodeName: 'Cloud forest',
    countryId: 1, zoneId: 2, durationHours: 4, price: 95, isActive: true,
    availableSlots: 8, difficulty: 'easy',
  }
  const state = maintenanceState([tour])
  useAdminMaintenance.mockReturnValue(state)
  render(<AdminMaintenance resource="tours" getAccessToken={jest.fn().mockResolvedValue('token')} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create tour' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Edit Forest dawn' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit tour' })
  const input = within(dialog).getByLabelText('Tour image')

  fireEvent.change(input, {
    target: { files: [new File(['jpeg'], 'wrong.jpg', { type: 'image/jpeg' })] },
  })
  expect(within(dialog).getByText('Choose a PNG image.')).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  expect(state.save).not.toHaveBeenCalled()

  const file = new File(['png'], 'replacement.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  await within(dialog).findByText('Selected: replacement.png')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove selected image' }))
  expect(within(dialog).queryByText('Selected: replacement.png')).not.toBeInTheDocument()
  expect(within(dialog).getByAltText('Current image for Forest dawn')).toBeInTheDocument()
})

test('keeps the selected tour image and editor open when saving fails', async () => {
  const tour = {
    id: 9, name: 'Forest dawn', type: 'Birdwatching', nodeId: 3, nodeName: 'Cloud forest',
    countryId: 1, zoneId: 2, durationHours: 4, price: 95, isActive: true,
    availableSlots: 8, difficulty: 'easy',
  }
  const state = maintenanceState([tour])
  state.save.mockRejectedValue(new Error('Unable to update the tour image.'))
  useAdminMaintenance.mockReturnValue(state)
  const onTourImageUpdated = jest.fn()
  render(<AdminMaintenance resource="tours" getAccessToken={jest.fn().mockResolvedValue('token')}
    onTourImageUpdated={onTourImageUpdated} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create tour' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Edit Forest dawn' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit tour' })
  const file = new File(['png'], 'retry.png', { type: 'image/png' })
  fireEvent.change(within(dialog).getByLabelText('Tour image'), { target: { files: [file] } })
  await within(dialog).findByText(/Selected: retry\.png/)

  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(state.save).toHaveBeenCalled())
  expect(screen.getByRole('dialog', { name: 'Edit tour' })).toBeInTheDocument()
  expect(within(dialog).getByText(/Selected: retry\.png/)).toBeInTheDocument()
  expect(onTourImageUpdated).not.toHaveBeenCalled()
})

test('Nodes uses the grid and opens the map and bird workflow in its editor dialog', async () => {
  const node = { id: 3, zoneId: 2, zoneName: 'Northern zone', name: 'Cloud forest', lat: 10.3, lon: -84.8, isActive: true }
  useAdminMaintenance.mockReturnValue(maintenanceState([node], { meta: { page: 1, limit: 25, total: 1, totalPages: 1 } }))
  render(<AdminMaintenance resource="nodes" getAccessToken={jest.fn().mockResolvedValue('token')} />)
  expect(await screen.findByRole('table', { name: 'Nodes maintenance records' })).toBeInTheDocument()
  for (const heading of ['Name', 'Zone', 'Coordinates', 'Status']) {
    expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument()
  }
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create node' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Edit Cloud forest' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit node' })
  expect(within(dialog).getByLabelText('Find a place by name')).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Latitude')).toHaveValue(10.3)
  expect(within(dialog).getByRole('heading', { name: 'Birds at this node' })).toBeInTheDocument()
  await waitFor(() => expect(within(dialog).queryByText('Loading bird assignments…')).not.toBeInTheDocument())
})

test('pagination exposes disabled chevrons and archive requires confirmation', async () => {
  const bird = references.birds[0]
  const state = maintenanceState([bird], {
    meta: { page: 1, limit: 25, total: 26, totalPages: 2 },
  })
  useAdminMaintenance.mockReturnValue(state)
  const getAccessToken = jest.fn().mockResolvedValue('token')
  const { rerender } = render(<AdminMaintenance resource="birds" getAccessToken={getAccessToken} />)
  await screen.findByRole('table')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create bird' })).toBeEnabled())

  const previous = screen.getByRole('button', { name: 'Previous page' })
  const next = screen.getByRole('button', { name: 'Next page' })
  expect(previous).toBeDisabled()
  expect(next).toBeEnabled()
  expect(previous.querySelector('svg')).toBeInTheDocument()
  expect(next.querySelector('svg')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Archive Resplendent Quetzal' }))
  let confirmation = screen.getByRole('alertdialog', { name: 'Confirm destructive action' })
  expect(confirmation).toHaveTextContent('archive Resplendent Quetzal')
  fireEvent.click(document.querySelector('.admin-operation-backdrop'))
  expect(screen.queryByRole('alertdialog', { name: 'Confirm destructive action' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Archive Resplendent Quetzal' }))
  confirmation = screen.getByRole('alertdialog', { name: 'Confirm destructive action' })
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
  expect(state.remove).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Archive Resplendent Quetzal' }))
  state.isRemoving = true
  rerender(<AdminMaintenance resource="birds" getAccessToken={getAccessToken} />)
  confirmation = screen.getByRole('alertdialog', { name: 'Confirm destructive action' })
  fireEvent.click(document.querySelector('.admin-operation-backdrop'))
  expect(confirmation).toBeInTheDocument()
  expect(confirmation).toHaveAttribute('aria-busy', 'true')
  state.isRemoving = false
  rerender(<AdminMaintenance resource="birds" getAccessToken={getAccessToken} />)
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }))
  await waitFor(() => expect(state.remove).toHaveBeenCalledWith(4))

  state.meta = { page: 2, limit: 25, total: 26, totalPages: 2 }
  rerender(<AdminMaintenance resource="birds" getAccessToken={getAccessToken} />)
  expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
})

test.each([
  ['zones', { id: 2, countryId: 1, countryName: 'Costa Rica', name: 'Northern zone', rank: 1, isActive: true }, ['Name', 'Default country', 'Rank', 'Status']],
  ['birds', { id: 4, name: 'Resplendent Quetzal', speciesCode: 'RESQUE', tags: ['forest', 'highlands'], isActive: true }, ['Name', 'Species code', 'Tags', 'Status']],
])('%s renders resource-appropriate grid columns', async (resource, item, headings) => {
  useAdminMaintenance.mockReturnValue(maintenanceState([item], { meta: { page: 1, limit: 25, total: 1, totalPages: 1 } }))
  render(<AdminMaintenance resource={resource} getAccessToken={jest.fn().mockResolvedValue('token')} />)
  await screen.findByRole('table')
  await waitFor(() => expect(screen.getByRole('button', { name: `Create ${resource === 'zones' ? 'zone' : 'bird'}` })).toBeEnabled())
  for (const heading of headings) expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('Bird create modal keeps validation visible and closes after a successful save', async () => {
  const state = maintenanceState([], { meta: { page: 1, limit: 25, total: 0, totalPages: 0 } })
  useAdminMaintenance.mockReturnValue(state)
  render(<AdminMaintenance resource="birds" getAccessToken={jest.fn().mockResolvedValue('token')} />)
  const create = await screen.findByRole('button', { name: 'Create bird' })
  await waitFor(() => expect(create).toBeEnabled())
  fireEvent.click(create)
  const dialog = screen.getByRole('dialog', { name: 'Create bird' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create bird' }))
  expect(within(dialog).getByText('Required')).toBeInTheDocument()
  expect(state.save).not.toHaveBeenCalled()

  fireEvent.change(within(dialog).getByRole('textbox', { name: /bird name/i }), { target: { value: 'Snowcap' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create bird' }))
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ name: 'Snowcap' }),
  })))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create bird' })).not.toBeInTheDocument())
  expect(create).toHaveFocus()
})

test('safe API errors are rendered inside the editor dialog', async () => {
  const state = maintenanceState(references.birds, { error: 'The bird could not be saved.' })
  useAdminMaintenance.mockReturnValue(state)
  render(<AdminMaintenance resource="birds" getAccessToken={jest.fn().mockResolvedValue('token')} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create bird' })).toBeEnabled())
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Resplendent Quetzal' }))
  expect(screen.getByRole('alert')).toHaveTextContent('The bird could not be saved.')
})

test('grid reports loading, empty, and mutation-success states clearly', async () => {
  const state = maintenanceState([], { status: 'loading', notice: 'Record created.' })
  useAdminMaintenance.mockReturnValue(state)
  const getAccessToken = jest.fn().mockResolvedValue('token')
  const { rerender } = render(<AdminMaintenance resource="birds" getAccessToken={getAccessToken} />)
  expect(screen.getByText('Loading birds…')).toHaveAttribute('role', 'status')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create bird' })).toBeEnabled())

  state.status = 'success'
  rerender(<AdminMaintenance resource="birds" getAccessToken={getAccessToken} />)
  expect(screen.getByText('No records found.')).toBeInTheDocument()
  expect(screen.getByText('Record created.')).toHaveAttribute('role', 'status')
})
