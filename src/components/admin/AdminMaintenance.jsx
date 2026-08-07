import { useEffect, useMemo, useRef, useState } from 'react'
import {
  getTourImageReference,
  listMaintenance,
} from '../../api/adminMaintenanceApi'
import { DEFAULT_TOUR_TYPE, TOUR_TYPES } from '../../constants/tourTypes'
import { useResolvedMedia } from '../../hooks/useResolvedMediaUrl'
import useAdminMaintenance from '../../hooks/useAdminMaintenance'
import { loadMyTourReferences } from '../../api/myToursApi'
import MaintenanceEditorDialog from './MaintenanceEditorDialog'
import {
  ArchiveIcon, ChevronLeftIcon, ChevronRightIcon, CreateIcon, EditIcon, SearchIcon,
} from './MaintenanceIcons'
import NodeMaintenanceDialog from './NodeMaintenanceDialog'
import { formatTourDuration, TOUR_DURATION_UNITS } from '../../utils/tourDuration'

const TOUR_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const TOUR_IMAGE_MIME_TYPE = 'image/png'

export const RESOURCE_DEFINITIONS = Object.freeze({
  countries: { label: 'Countries', singular: 'country', title: (item) => item.name, detail: (item) => item.acr },
  zones: { label: 'Zones', singular: 'zone', title: (item) => item.name, detail: (item) => item.countryName },
  nodes: { label: 'Nodes', singular: 'node', title: (item) => item.name, detail: (item) => item.zoneName },
  birds: { label: 'Birds', singular: 'bird', title: (item) => item.name, detail: (item) => item.speciesCode || 'No species code' },
  'birds-by-node': { label: 'Birds by node', singular: 'bird assignment', title: (item) => item.birdName, detail: (item) => item.nodeName },
  tours: { label: 'Tours', singular: 'tour', title: (item) => item.name, detail: (item) => `${item.type || DEFAULT_TOUR_TYPE} · ${item.nodeName || ''}` },
})

const EMPTY_BY_RESOURCE = Object.freeze({
  countries: { name: '', acr: '', latitude: '', longitude: '', zoom: '' },
  zones: { countryId: '', name: '', description: '', rank: 0, isActive: true },
  nodes: { countryId: '', zoneId: '', parentId: '', name: '', description: '', rank: 0, lat: '', lon: '', isActive: true },
  birds: { speciesCode: '', name: '', tags: '', isActive: true },
  'birds-by-node': { nodeId: '', birdId: '', rank: 0, isActive: true },
  tours: {
    countryId: '', zoneId: '', nodeId: '', name: '', description: '', type: DEFAULT_TOUR_TYPE,
    price: '', availableSlots: '', durationValue: '', durationUnit: 'hours', difficulty: 'easy',
    startDate: '', endDate: '', sourceUrl: '', tourType: 'unscheduled', isActive: true,
    maxParticipants: '', minimumPrice: '',
  },
})

function nullableNumber(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

function payloadFor(resource, values) {
  const payload = Object.fromEntries(
    Object.keys(EMPTY_BY_RESOURCE[resource]).map((key) => [key, values[key]])
  )
  delete payload.countryId
  delete payload.zoneId
  if (resource !== 'tours' && resource !== 'nodes') {
    if (resource !== 'zones') delete payload.countryId
  }
  if (resource === 'countries') {
    for (const key of ['latitude', 'longitude', 'zoom']) {
      payload[key] = nullableNumber(values[key])
    }
    payload.acr = values.acr.trim().toUpperCase()
  }
  if (resource === 'zones') payload.countryId = Number(values.countryId)
  if (resource === 'nodes') {
    payload.zoneId = Number(values.zoneId)
    payload.parentId = values.parentId ? Number(values.parentId) : null
    payload.lat = nullableNumber(values.lat)
    payload.lon = nullableNumber(values.lon)
  }
  if (resource === 'birds') {
    payload.speciesCode = values.speciesCode.trim() || null
    payload.tags = String(values.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean)
  }
  if (resource === 'birds-by-node') {
    payload.nodeId = Number(values.nodeId)
    payload.birdId = Number(values.birdId)
  }
  if (resource === 'tours') {
    payload.nodeId = Number(values.nodeId)
    for (const key of ['price', 'minimumPrice']) payload[key] = nullableNumber(values[key])
    payload.durationValue = nullableNumber(values.durationValue)
    for (const key of ['description', 'sourceUrl']) payload[key] = values[key] || null
    if (values.tourType === 'scheduled') {
      payload.availableSlots = nullableNumber(values.availableSlots)
      payload.startDate = values.startDate || null
      payload.endDate = values.endDate || null
      delete payload.maxParticipants
    } else {
      payload.maxParticipants = nullableNumber(values.maxParticipants)
      delete payload.availableSlots
      delete payload.startDate
      delete payload.endDate
    }
  }
  return payload
}

function validateForm(resource, values, references = null) {
  const errors = {}
  const required = {
    countries: ['name', 'acr'], zones: ['countryId', 'name', 'description'],
    nodes: ['zoneId', 'name'], birds: ['name'], 'birds-by-node': ['nodeId', 'birdId'],
    tours: ['countryId', 'zoneId', 'nodeId', 'name', 'type', 'price', 'durationValue', 'durationUnit', 'difficulty'],
  }[resource]
  for (const field of required) {
    if (values[field] === undefined || values[field] === '' || values[field] === null) errors[field] = 'Required'
  }
  const lat = nullableNumber(values.lat)
  const lon = nullableNumber(values.lon)
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) errors.lat = 'Latitude must be between -90 and 90.'
  if (lon !== null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) errors.lon = 'Longitude must be between -180 and 180.'
  if (resource === 'countries') {
    const latitude = nullableNumber(values.latitude)
    const longitude = nullableNumber(values.longitude)
    const zoom = nullableNumber(values.zoom)
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) errors.latitude = 'Latitude must be between -90 and 90.'
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) errors.longitude = 'Longitude must be between -180 and 180.'
    if (zoom !== null && (!Number.isInteger(zoom) || zoom < 0 || zoom > 19)) errors.zoom = 'Zoom must be a whole number from 0 through 19.'
  }
  if (resource === 'tours') {
    const numberRules = [
      ['price', 0, false], ['minimumPrice', 0, false], ['durationValue', 1, true],
    ]
    for (const [field, minimum, integer] of numberRules) {
      const value = nullableNumber(values[field])
      if (value !== null && (!Number.isFinite(value) || value < minimum || (integer && !Number.isInteger(value)))) {
        errors[field] = `${field === 'durationValue' ? 'Duration' : field === 'maxParticipants' ? 'Maximum participants' : 'Price'} must be ${integer ? 'a whole number' : 'a number'} of at least ${minimum}.`
      }
    }
    if (!TOUR_DURATION_UNITS.includes(values.durationUnit)) errors.durationUnit = 'Choose hours or days.'
    if (values.tourType === 'scheduled') {
      for (const field of ['availableSlots', 'startDate', 'endDate']) {
        if (values[field] === '' || values[field] === null) errors[field] = 'Required for scheduled tours'
      }
    } else {
      const maxParticipants = nullableNumber(values.maxParticipants)
      if (values.maxParticipants === '' || values.maxParticipants === null
        || values.maxParticipants === undefined) errors.maxParticipants = 'Required for flexible-date tours'
      else if (!Number.isInteger(maxParticipants) || maxParticipants < 1) {
        errors.maxParticipants = 'Maximum participants must be a whole number of at least 1.'
      }
      const slots = nullableNumber(values.availableSlots)
      if (slots !== null && (!Number.isInteger(slots) || slots < 0)) {
        errors.availableSlots = 'Available slots must be a whole number of at least 0.'
      }
    }
    if (!TOUR_TYPES.includes(values.type)) errors.type = 'Choose a supported activity type.'
    if (references) {
      const node = references.nodes?.find((item) => String(item.id) === String(values.nodeId))
      if (!node) errors.nodeId = 'Select an existing node.'
      else if (node.lat === null || node.lat === '' || !Number.isFinite(Number(node.lat))
        || node.lon === null || node.lon === '' || !Number.isFinite(Number(node.lon))) {
        errors.nodeId = 'This node needs valid coordinates before the tour can be saved.'
      }
    }
  }
  if (resource === 'tours' && values.tourType === 'scheduled'
    && values.startDate && values.endDate && values.startDate > values.endDate) {
    errors.endDate = 'End date must not precede start date.'
  }
  return errors
}

function Field({ label, name, values, setValues, errors, type = 'text', ...props }) {
  const errorId = `${name}-error`
  return (
    <label className="maintenance-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={values[name] ?? ''}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? errorId : undefined}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        {...props}
      />
      {errors[name] && <small id={errorId} className="maintenance-field-error">{errors[name]}</small>}
    </label>
  )
}

function SelectField({ label, name, values, setValues, errors, children, ...props }) {
  return (
    <label className="maintenance-field">
      <span>{label}</span>
      <select
        name={name} value={values[name] ?? ''} aria-invalid={Boolean(errors[name])}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        {...props}
      >{children}</select>
      {errors[name] && <small className="maintenance-field-error">{errors[name]}</small>}
    </label>
  )
}

function ActiveField({ values, setValues }) {
  return (
    <label className="maintenance-check">
      <input type="checkbox" checked={values.isActive !== false}
        onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.checked }))} />
      <span>Published / active</span>
    </label>
  )
}

function GeographyFields({ values, setValues, errors, references, includeParent = false }) {
  const zones = references.zones.filter((zone) => !values.countryId || String(zone.countryId) === String(values.countryId))
  const nodes = references.nodes.filter((node) => !values.zoneId || String(node.zoneId) === String(values.zoneId))
  return (
    <div className="maintenance-form-grid">
      <SelectField label="Country" name="countryId" values={values} setValues={(updater) => setValues((current) => {
        const next = updater(current); return { ...next, zoneId: '', nodeId: '', parentId: '' }
      })} errors={errors}>
        <option value="">Select country</option>
        {references.countries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </SelectField>
      <SelectField label="Zone" name="zoneId" values={values} setValues={(updater) => setValues((current) => {
        const next = updater(current); return { ...next, nodeId: '', parentId: '' }
      })} errors={errors}>
        <option value="">Select zone</option>
        {zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </SelectField>
      {includeParent ? (
        <SelectField label="Parent node (optional)" name="parentId" values={values} setValues={setValues} errors={errors}>
          <option value="">No parent</option>
          {nodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </SelectField>
      ) : (
        <SelectField label="Node / location" name="nodeId" values={values} setValues={setValues} errors={errors}>
          <option value="">Select node</option>
          {nodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </SelectField>
      )}
    </div>
  )
}

function TourImageField({
  error, file, imageUpdate, onChange, onClear, pending, previewUrl, tour,
}) {
  const imageReference = imageUpdate?.url || getTourImageReference(
    tour?.id,
    tour?.imagePath,
    tour?.imageVersion || tour?.updatedAt,
  )
  const resolvedImage = useResolvedMedia(imageReference)
  const [imageFailed, setImageFailed] = useState(false)
  const currentImageUrl = resolvedImage.url
  const displayedImage = previewUrl || (!imageFailed ? currentImageUrl : '')

  useEffect(() => {
    setImageFailed(false)
  }, [currentImageUrl])

  if (!tour?.id) {
    return <p className="admin-muted">Save the tour before adding its image.</p>
  }

  return (
    <div className="tour-image-editor">
      <div className="tour-image-preview">
        {displayedImage ? (
          <img
            src={displayedImage}
            alt={previewUrl ? `New image preview for ${tour.name}` : `Current image for ${tour.name}`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{resolvedImage.isResolving ? 'Loading current image…' : 'No current image is available.'}</span>
        )}
      </div>
      <div className="maintenance-field tour-image-input">
        <label htmlFor={`tour-image-${tour.id}`}>Tour image</label>
        <input
          id={`tour-image-${tour.id}`}
          type="file"
          accept={TOUR_IMAGE_MIME_TYPE}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'tour-image-error' : 'tour-image-hint'}
          disabled={pending}
          onChange={onChange}
        />
        <small id="tour-image-hint">PNG only, up to 5 MB. Saving creates a new private media reference.</small>
        {error && <small id="tour-image-error" className="maintenance-field-error">{error}</small>}
      </div>
      {file && (
        <div className="tour-image-selection">
          <span
            className="tour-image-selection-summary"
            role="status"
            aria-live="polite"
            title={file.name}
          >
            {pending ? `Saving tour and uploading ${file.name}…` : `Selected: ${file.name}`}
          </span>
          <button
            className="maintenance-labeled-action tour-image-remove"
            type="button"
            disabled={pending}
            onClick={onClear}
          >
            Remove selected image
          </button>
        </div>
      )}
    </div>
  )
}

function TourForm({
  values, setValues, errors, references, onCreateNode, nodeActionRef, canManageNodes,
  canManageImage,
  editingTour, imageError, imageFile, imagePreviewUrl, imageUpdate,
  onImageChange, onClearImage, imagePending,
}) {
  const selectedCountry = references.countries[0]
  const zones = references.zones.filter((zone) => String(zone.countryId) === String(selectedCountry?.id))
  const nodes = references.nodes.filter((node) => String(node.zoneId) === String(values.zoneId))
  const selectedNode = references.nodes.find((node) => String(node.id) === String(values.nodeId))
  const nodeHasCoordinates = selectedNode && selectedNode.lat !== null && selectedNode.lat !== ''
    && selectedNode.lon !== null && selectedNode.lon !== ''
    && Number.isFinite(Number(selectedNode.lat)) && Number.isFinite(Number(selectedNode.lon))
  return (
    <div className="tour-editor-sections">
      <fieldset><legend>1. Basic information</legend>
        <div className="maintenance-form-grid"><Field label="Tour name" name="name" values={values} setValues={setValues} errors={errors} />
          <Field label="Source or media URL" name="sourceUrl" type="url" values={values} setValues={setValues} errors={errors} /></div>
      </fieldset>
      <fieldset><legend>2. Tour type and description</legend>
        <div className="maintenance-form-grid"><SelectField label="Activity type" name="type" values={values} setValues={setValues} errors={errors}>
          {TOUR_TYPES.map((type) => <option key={type}>{type}</option>)}
        </SelectField>
        <label className="maintenance-field maintenance-field-wide"><span>Description</span><textarea value={values.description}
          onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} /></label></div>
      </fieldset>
      <fieldset><legend>3. Country, zone, and node/location</legend>
        <div className="maintenance-form-grid">
          <div className="maintenance-readonly-field"><span>Default country</span><strong>{selectedCountry?.name || 'No country configured'}</strong></div>
          <SelectField label="Zone" name="zoneId" values={values} setValues={(updater) => setValues((current) => {
            const next = updater(current); return { ...next, nodeId: '' }
          })} errors={errors}><option value="">Select zone</option>{zones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
          <div className="tour-node-picker">
            <SelectField label="Node / location" name="nodeId" values={values} setValues={setValues} errors={errors}><option value="">Select node</option>{nodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
            {canManageNodes && <button type="button" ref={nodeActionRef} onClick={(event) => onCreateNode(event.currentTarget)}>Create node</button>}
          </div>
        </div>
        {selectedNode && <div className={nodeHasCoordinates ? 'tour-node-location' : 'admin-alert'} role={nodeHasCoordinates ? 'status' : 'alert'}>
          <strong>{selectedNode.name}</strong>{nodeHasCoordinates
            ? <span>Location from node: {Number(selectedNode.lat).toFixed(6)}, {Number(selectedNode.lon).toFixed(6)}</span>
            : <span>This node has no valid coordinates. Edit it before saving the tour.</span>}</div>}
      </fieldset>
      <fieldset><legend>4. Schedule, duration, capacity, and pricing</legend>
        <div className="maintenance-form-grid">
          <SelectField label="Schedule mode" name="tourType" values={values} setValues={setValues} errors={errors}><option value="unscheduled">Flexible dates</option><option value="scheduled">Scheduled</option></SelectField>
          <Field label="Duration" name="durationValue" type="number" min="1" step="1" values={values} setValues={setValues} errors={errors} />
          <SelectField label="Duration unit" name="durationUnit" values={values} setValues={setValues} errors={errors}><option value="hours">Hours</option><option value="days">Days</option></SelectField>
          <SelectField label="Difficulty" name="difficulty" values={values} setValues={setValues} errors={errors}><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="challenging">Challenging</option></SelectField>
          {values.tourType === 'scheduled' && <Field label="Available slots" name="availableSlots" type="number" min="0" values={values} setValues={setValues} errors={errors} />}
          {values.tourType === 'unscheduled' && <Field label="Maximum participants" name="maxParticipants" type="number" min="1" values={values} setValues={setValues} errors={errors} />}
          <Field label="Price per person (USD)" name="price" type="number" min="0" step="0.01" values={values} setValues={setValues} errors={errors} />
          <Field label="Minimum price (USD)" name="minimumPrice" type="number" min="0" step="0.01" values={values} setValues={setValues} errors={errors} />
          {values.tourType === 'scheduled' && <Field label="Start date" name="startDate" type="date" values={values} setValues={setValues} errors={errors} />}
          {values.tourType === 'scheduled' && <Field label="End date" name="endDate" type="date" values={values} setValues={setValues} errors={errors} />}
        </div>
      </fieldset>
      <fieldset><legend>5. Media and publication status</legend>
        {canManageImage && (
          <TourImageField
            error={imageError}
            file={imageFile}
            imageUpdate={imageUpdate}
            onChange={onImageChange}
            onClear={onClearImage}
            pending={imagePending}
            previewUrl={imagePreviewUrl}
            tour={editingTour}
          />
        )}
        <ActiveField values={values} setValues={setValues} />
      </fieldset>
      <fieldset><legend>6. Review and save</legend><p className="admin-muted">Review the activity category, node-owned location, capacity, price, and publication state before saving.</p></fieldset>
    </div>
  )
}

function GenericForm({ resource, values, setValues, errors, references }) {
  if (resource === 'countries') return <div className="maintenance-form-grid">
    <Field label="Country name" name="name" values={values} setValues={setValues} errors={errors} />
    <Field label="Country code" name="acr" maxLength="8" values={values} setValues={setValues} errors={errors} />
    <Field label="Initial map latitude" name="latitude" type="number" step="0.000001" min="-90" max="90" values={values} setValues={setValues} errors={errors} />
    <Field label="Initial map longitude" name="longitude" type="number" step="0.000001" min="-180" max="180" values={values} setValues={setValues} errors={errors} />
    <Field label="Initial map zoom" name="zoom" type="number" step="1" min="0" max="19" values={values} setValues={setValues} errors={errors} />
  </div>
  if (resource === 'zones') return <div className="maintenance-form-grid">
    <div className="maintenance-readonly-field"><span>Country</span><strong>{references.countries.find((item) => String(item.id) === String(values.countryId))?.name || references.countries[0]?.name || 'No country configured'}</strong></div>
    <Field label="Zone name" name="name" values={values} setValues={setValues} errors={errors} />
    <Field label="Description" name="description" values={values} setValues={setValues} errors={errors} />
    <Field label="Rank" name="rank" type="number" min="0" values={values} setValues={setValues} errors={errors} /><ActiveField values={values} setValues={setValues} />
  </div>
  if (resource === 'nodes') return <><GeographyFields values={values} setValues={setValues} errors={errors} references={references} includeParent />
    <div className="maintenance-form-grid"><Field label="Node name" name="name" values={values} setValues={setValues} errors={errors} /><Field label="Description" name="description" values={values} setValues={setValues} errors={errors} /><Field label="Rank" name="rank" type="number" min="0" values={values} setValues={setValues} errors={errors} /><Field label="Latitude" name="lat" type="number" min="-90" max="90" values={values} setValues={setValues} errors={errors} /><Field label="Longitude" name="lon" type="number" min="-180" max="180" values={values} setValues={setValues} errors={errors} /><ActiveField values={values} setValues={setValues} /></div></>
  if (resource === 'birds') return <div className="maintenance-form-grid"><Field label="Bird name" name="name" values={values} setValues={setValues} errors={errors} /><Field label="Species code" name="speciesCode" values={values} setValues={setValues} errors={errors} /><Field label="Tags (comma separated)" name="tags" values={values} setValues={setValues} errors={errors} /><ActiveField values={values} setValues={setValues} /></div>
  return <div className="maintenance-form-grid"><SelectField label="Node" name="nodeId" values={values} setValues={setValues} errors={errors}><option value="">Select node</option>{references.nodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField><SelectField label="Bird" name="birdId" values={values} setValues={setValues} errors={errors}><option value="">Select bird</option>{references.birds.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField><Field label="Rank" name="rank" type="number" min="0" values={values} setValues={setValues} errors={errors} /><ActiveField values={values} setValues={setValues} /></div>
}

function normalizeEditValues(resource, item) {
  const values = { ...EMPTY_BY_RESOURCE[resource], ...item }
  if (resource === 'birds') values.tags = Array.isArray(item.tags) ? item.tags.join(', ') : ''
  if (resource === 'tours') {
    values.durationValue = item.durationValue ?? item.durationHours ?? ''
    values.durationUnit = item.durationUnit || 'hours'
    values.maxParticipants = item.maxParticipants ?? item.availableSlots ?? ''
  }
  return values
}

function statusLabel(item) {
  return item.isActive === false ? 'Inactive' : 'Active'
}

function gridColumns(resource, { showOwner = false } = {}) {
  if (resource === 'tours') return [
    { key: 'name', label: 'Name', render: (item) => <strong>{item.name}</strong> },
    { key: 'type', label: 'Type', render: (item) => item.type || DEFAULT_TOUR_TYPE },
    { key: 'node', label: 'Node / location', render: (item) => item.nodeName || 'Unknown node' },
    { key: 'duration', label: 'Duration', render: (item) => formatTourDuration(item) || '—' },
    { key: 'price', label: 'Price', render: (item) => Number.isFinite(Number(item.price)) ? `$${Number(item.price).toFixed(2)}` : '—' },
    { key: 'status', label: 'Publication', render: (item) => <div className="maintenance-status-cell"><span className={`maintenance-status-badge ${item.isActive === false ? 'is-inactive' : 'is-active'}`}>{item.isActive === false ? 'Unpublished' : 'Published'}</span>{item.ownerStatus === 'suspended' && <small className="maintenance-visibility-warning">Owner suspended; not public</small>}{item.ownerStatus === 'legacy' && <small>Legacy system inventory</small>}</div> },
    ...(showOwner ? [{ key: 'owner', label: 'Owner', render: (item) => item.ownerStatus === 'legacy' ? 'System / legacy' : item.ownerName || item.ownerEmail || `User ${item.createdByUserId}` }] : []),
  ]
  if (resource === 'zones') return [
    { key: 'name', label: 'Name', render: (item) => <strong>{item.name}</strong> },
    { key: 'country', label: 'Default country', render: (item) => item.countryName || 'Unknown country' },
    { key: 'rank', label: 'Rank', render: (item) => item.rank ?? 0 },
    { key: 'status', label: 'Status', render: (item) => <span className={`maintenance-status-badge ${item.isActive === false ? 'is-inactive' : 'is-active'}`}>{statusLabel(item)}</span> },
  ]
  if (resource === 'birds') return [
    { key: 'name', label: 'Name', render: (item) => <strong>{item.name}</strong> },
    { key: 'species', label: 'Species code', render: (item) => item.speciesCode || '—' },
    { key: 'tags', label: 'Tags', render: (item) => Array.isArray(item.tags) && item.tags.length ? item.tags.join(', ') : '—' },
    { key: 'status', label: 'Status', render: (item) => <span className={`maintenance-status-badge ${item.isActive === false ? 'is-inactive' : 'is-active'}`}>{statusLabel(item)}</span> },
  ]
  if (resource === 'nodes') return [
    { key: 'name', label: 'Name', render: (item) => <strong>{item.name}</strong> },
    { key: 'zone', label: 'Zone', render: (item) => item.zoneName || 'Unknown zone' },
    { key: 'coordinates', label: 'Coordinates', render: (item) => (
      Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon))
        ? `${Number(item.lat).toFixed(6)}, ${Number(item.lon).toFixed(6)}` : 'Missing coordinates'
    ) },
    { key: 'status', label: 'Status', render: (item) => <span className={`maintenance-status-badge ${item.isActive === false ? 'is-inactive' : 'is-active'}`}>{statusLabel(item)}</span> },
  ]
  return [
    { key: 'name', label: 'Name', render: (item) => <strong>{RESOURCE_DEFINITIONS[resource].title(item)}</strong> },
    { key: 'detail', label: 'Details', render: (item) => RESOURCE_DEFINITIONS[resource].detail(item) },
    { key: 'status', label: 'Status', render: (item) => statusLabel(item) },
  ]
}

function MaintenanceGrid({ resource, items, showOwner, scope, onEdit, onRemove }) {
  const columns = gridColumns(resource, { showOwner })
  return <div className="maintenance-table-scroll"><table className="maintenance-data-grid">
    <caption className="sr-only">{RESOURCE_DEFINITIONS[resource].label} maintenance records</caption>
    <thead><tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{items.map((item) => {
      const itemTitle = RESOURCE_DEFINITIONS[resource].title(item)
      const editLabel = `Edit ${itemTitle}`
      const archiveLabel = `Archive ${itemTitle}`
      return <tr key={item.id}>{columns.map((column) => <td key={column.key} data-label={column.label}>{column.render(item)}</td>)}
        <td data-label="Actions"><div className="maintenance-row-actions">
          <button type="button" className="maintenance-icon-button" aria-label={editLabel} title={editLabel}
            data-maintenance-edit-id={item.id} onClick={(event) => onEdit(item, event.currentTarget)}><EditIcon /></button>
          {scope !== 'my-tours' && <button type="button" className="maintenance-icon-button admin-danger-action" aria-label={archiveLabel}
            title={archiveLabel} onClick={() => onRemove(item)}><ArchiveIcon /></button>}
        </div></td></tr>
    })}</tbody>
  </table></div>
}

function AdminMaintenance({
  resource, getAccessToken, scope = 'admin', showOwner = false, onBack, onTourImageUpdated,
}) {
  const definition = RESOURCE_DEFINITIONS[resource]
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [values, setValues] = useState(() => ({ ...EMPTY_BY_RESOURCE[resource] }))
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(null)
  const [references, setReferences] = useState({ countries: [], zones: [], nodes: [], birds: [] })
  const [referenceStatus, setReferenceStatus] = useState('loading')
  const [referenceError, setReferenceError] = useState('')
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false)
  const [nodeDialogNode, setNodeDialogNode] = useState(null)
  const [tourImageFile, setTourImageFile] = useState(null)
  const [tourImagePreviewUrl, setTourImagePreviewUrl] = useState('')
  const [tourImageError, setTourImageError] = useState('')
  const [tourImageUpdates, setTourImageUpdates] = useState({})
  const nodeActionRef = useRef(null)
  const tourImageInputRef = useRef(null)
  const tourImageReadRef = useRef(0)
  const editorReturnFocusRef = useRef(null)
  const createActionRef = useRef(null)
  const filters = useMemo(() => ({
    search,
    ...(scope === 'my-tours' ? { type: typeFilter, status: statusFilter, difficulty: difficultyFilter } : {}),
  }), [difficultyFilter, scope, search, statusFilter, typeFilter])
  const maintenance = useAdminMaintenance({ resource, getAccessToken, filters, scope })

  useEffect(() => {
    let active = true
    setReferenceStatus('loading'); setReferenceError('')
    getAccessToken().then(async (token) => {
      if (scope === 'my-tours') {
        const result = await loadMyTourReferences({ token })
        if (active) { setReferences({ ...result, birds: [] }); setReferenceStatus('success') }
        return
      }
      const names = ['countries', 'zones', 'nodes', 'birds']
      const results = await Promise.all(names.map((name) => (
        listMaintenance(name, { token, limit: 100 })
      )))
      if (active) { setReferences(Object.fromEntries(names.map((name, index) => [name, results[index].items]))); setReferenceStatus('success') }
    }).catch((error) => { if (active) { setReferenceStatus('error'); setReferenceError(error.message || 'Unable to load reference data.') } })
    return () => { active = false }
  }, [getAccessToken, resource, scope])

  useEffect(() => {
    const country = references.countries[0]
    if (!country) return
    setValues((current) => current.countryId ? current : { ...current, countryId: String(country.id) })
  }, [references.countries])

  useEffect(() => {
    setEditing(null); setEditorOpen(false); setEditorDirty(false)
    setValues({ ...EMPTY_BY_RESOURCE[resource] }); setErrors({}); setSearch(''); setSearchInput('')
    setTypeFilter(''); setStatusFilter(''); setDifficultyFilter('')
    setTourImageFile(null); setTourImagePreviewUrl(''); setTourImageError('')
  }, [resource])

  const clearTourImageSelection = () => {
    tourImageReadRef.current += 1
    setTourImageFile(null)
    setTourImagePreviewUrl('')
    setTourImageError('')
    if (tourImageInputRef.current) tourImageInputRef.current.value = ''
  }

  const handleTourImageChange = (event) => {
    const file = event.target.files?.[0]
    tourImageInputRef.current = event.target
    if (!file) return
    if (file.type !== TOUR_IMAGE_MIME_TYPE) {
      setTourImageError('Choose a PNG image.')
      event.target.value = ''
      return
    }
    if (file.size > TOUR_IMAGE_MAX_BYTES) {
      setTourImageError('Tour image must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    const requestId = tourImageReadRef.current + 1
    tourImageReadRef.current = requestId
    setTourImageError('')
    setTourImageFile(file)
    setEditorDirty(true)
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (tourImageReadRef.current === requestId && typeof reader.result === 'string') {
        setTourImagePreviewUrl(reader.result)
      }
    })
    reader.addEventListener('error', () => {
      if (tourImageReadRef.current === requestId) {
        setTourImageFile(null)
        setTourImagePreviewUrl('')
        setTourImageError('The selected image could not be previewed.')
      }
    })
    reader.readAsDataURL(file)
  }

  const openEdit = (item, control) => {
    editorReturnFocusRef.current = control
    maintenance.clearError()
    if (resource === 'nodes') {
      setNodeDialogNode(item); setNodeDialogOpen(true)
      return
    }
    setEditing(item); setValues(normalizeEditValues(resource, item)); setErrors({})
    clearTourImageSelection()
    setEditorDirty(false); setEditorOpen(true)
  }
  const openCreate = (control = createActionRef.current) => {
    editorReturnFocusRef.current = control
    maintenance.clearError()
    if (resource === 'nodes') {
      setNodeDialogNode(null); setNodeDialogOpen(true)
      return
    }
    setEditing(null)
    clearTourImageSelection()
    setValues({ ...EMPTY_BY_RESOURCE[resource], countryId: references.countries[0]?.id ? String(references.countries[0].id) : '' })
    setErrors({}); setEditorDirty(false); setEditorOpen(true)
  }
  const closeEditor = () => {
    if (maintenance.isSaving) return
    setEditorOpen(false); setEditorDirty(false); setErrors({}); setNodeDialogOpen(false)
    clearTourImageSelection()
  }
  const updateValues = (updater) => {
    setEditorDirty(true)
    setValues(updater)
  }
  const submit = async (event) => {
    event.preventDefault()
    if (maintenance.isSaving) return
    const nextErrors = validateForm(resource, values, references)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length || tourImageError) return
    try {
      const data = payloadFor(resource, values)
      const isImageOnlyTourUpdate = resource === 'tours' && editing && tourImageFile
        && JSON.stringify(data) === JSON.stringify(
          payloadFor(resource, normalizeEditValues(resource, editing))
        )
      const result = await maintenance.save({
        id: editing?.id,
        data: isImageOnlyTourUpdate ? null : data,
        image: resource === 'tours' && editing ? tourImageFile : null,
      })
      if (result?.image?.key && editing?.id) {
        setTourImageUpdates((current) => ({ ...current, [editing.id]: result.image }))
        onTourImageUpdated?.({
          tourId: editing.id,
          imagePath: result.image.key,
          url: result.image.url,
          version: result.image.version,
        })
      }
      setEditorDirty(false)
      setEditorOpen(false)
      clearTourImageSelection()
    } catch { /* visible through hook state */ }
  }

  const cannotOpenEditor = referenceStatus !== 'success'
    || (resource !== 'birds' && references.countries.length === 0)

  const mergeNodeIntoReferences = (node, nodes = references.nodes) => (
    [...nodes.filter((item) => item.id !== node.id), node]
  )

  const handleTourNodeCreated = (node) => {
    setEditorDirty(true)
    setReferences((current) => ({ ...current, nodes: mergeNodeIntoReferences(node, current.nodes) }))
    setValues((current) => ({ ...current, countryId: String(references.countries[0]?.id || ''), zoneId: String(node.zoneId), nodeId: String(node.id) }))
    setNodeDialogOpen(false)
    getAccessToken().then((token) => listMaintenance('nodes', { token, limit: 100 }))
      .then((result) => setReferences((current) => ({ ...current, nodes: mergeNodeIntoReferences(node, result.items) })))
      .catch(() => { /* the created node remains available when refresh fails */ })
  }

  const handleStandaloneNodeSaved = (node) => {
    setReferences((current) => ({ ...current, nodes: mergeNodeIntoReferences(node, current.nodes) }))
    maintenance.load({ page: nodeDialogNode ? maintenance.meta.page : 1 })
  }

  return (
    <section className="admin-maintenance" aria-labelledby="maintenance-title">
      <header className="admin-dimension-header">
        <div><p className="admin-eyebrow">{scope === 'my-tours' ? 'Guide workspace' : 'Data maintenance'}</p><h2 id="maintenance-title">{scope === 'my-tours' ? 'My Tours' : definition.label}</h2><p>{scope === 'my-tours' ? 'Manage tour listings within your authorized ownership scope.' : `Search, create, edit, and safely retire ${definition.label.toLowerCase()}.`}</p></div>
        {onBack && <button type="button" onClick={onBack}>Back to home</button>}
      </header>
      {scope === 'my-tours' && <div className="maintenance-secondary-filters" aria-label="My Tours filters">
        <label><span>Tour type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All types</option>{TOUR_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label><span>Publication status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="active">Published</option><option value="inactive">Unpublished</option></select></label>
        <label><span>Difficulty</span><select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}><option value="">All difficulties</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="challenging">Challenging</option></select></label>
      </div>}
      <div className="maintenance-grid-panel">
          <div className="maintenance-grid-toolbar">
            <form role="search" className="maintenance-search" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()) }}>
              <label><span>Search {definition.label.toLowerCase()}</span><input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
              <button type="submit" className="maintenance-labeled-action"><SearchIcon /><span>Search</span></button>
            </form>
            <button ref={createActionRef} type="button" className="maintenance-create-action maintenance-labeled-action" disabled={cannotOpenEditor}
              onClick={(event) => openCreate(event.currentTarget)}><CreateIcon /><span>Create {definition.singular}</span></button>
          </div>
          {referenceStatus === 'loading' && <p role="status">Loading form reference data…</p>}
          {referenceStatus === 'error' && <div className="admin-alert" role="alert"><strong>Reference data is unavailable</strong><p>{referenceError}</p></div>}
          {referenceStatus === 'success' && references.countries.length === 0 && resource !== 'birds' && <div className="admin-alert" role="alert"><strong>No country is configured</strong><p>Add a country through the existing admin API or seed data before maintaining zones, nodes, or tours.</p></div>}
          {maintenance.status === 'loading' && <p role="status">Loading {definition.label.toLowerCase()}…</p>}
          {maintenance.status === 'error' && <div className="admin-alert" role="alert"><p>{maintenance.error}</p><button type="button" onClick={() => maintenance.load()}>Retry</button></div>}
          {!editorOpen && maintenance.status !== 'error' && maintenance.error && <div className="admin-alert" role="alert"><p>{maintenance.error}</p></div>}
          {maintenance.status === 'success' && maintenance.items.length === 0 && <p className="admin-empty-state">No records found.</p>}
          {maintenance.notice && <p className="maintenance-success" role="status">{maintenance.notice}</p>}
          {maintenance.items.length > 0 && <MaintenanceGrid resource={resource}
            items={maintenance.items} showOwner={showOwner} scope={scope} onEdit={openEdit} onRemove={setConfirming} />}
          {maintenance.meta.totalPages > 1 && <nav className="maintenance-pagination" aria-label={`${definition.label} pages`}>
            <button type="button" className="maintenance-icon-button" aria-label="Previous page" title="Previous page"
              disabled={maintenance.meta.page <= 1} onClick={() => maintenance.load({ page: maintenance.meta.page - 1 })}><ChevronLeftIcon /></button>
            <span>Page {maintenance.meta.page} of {maintenance.meta.totalPages}</span>
            <button type="button" className="maintenance-icon-button" aria-label="Next page" title="Next page"
              disabled={maintenance.meta.page >= maintenance.meta.totalPages} onClick={() => maintenance.load({ page: maintenance.meta.page + 1 })}><ChevronRightIcon /></button>
          </nav>}
      </div>
      {editorOpen && <MaintenanceEditorDialog title={editing ? `Edit ${definition.singular}` : `Create ${definition.singular}`}
        description={editing ? `Update ${definition.title(editing)} and save the changes.` : `Add a new ${definition.singular} record.`}
        dirty={editorDirty} pending={maintenance.isSaving} suspended={nodeDialogOpen} error={maintenance.error}
        onClose={closeEditor} onSubmit={submit} onDirty={() => setEditorDirty(true)} returnFocusRef={editorReturnFocusRef}
        submitLabel={editing ? 'Save changes' : `Create ${definition.singular}`} submitDisabled={cannotOpenEditor}>
        {resource === 'tours' ? <TourForm values={values} setValues={updateValues} errors={errors} references={references}
          canManageNodes={scope === 'admin'} nodeActionRef={nodeActionRef}
          canManageImage={scope === 'admin'}
          editingTour={editing} imageError={tourImageError} imageFile={tourImageFile}
          imagePreviewUrl={tourImagePreviewUrl} imageUpdate={tourImageUpdates[editing?.id]}
          imagePending={maintenance.isSaving}
          onImageChange={handleTourImageChange} onClearImage={clearTourImageSelection}
          onCreateNode={(control) => { nodeActionRef.current = control; setNodeDialogNode(null); setNodeDialogOpen(true) }} />
          : <GenericForm resource={resource} values={values} setValues={updateValues} errors={errors} references={references} />}
      </MaintenanceEditorDialog>}
      {confirming && <div className="admin-operation-backdrop" role="presentation"
        onClick={(event) => { if (event.target === event.currentTarget && !maintenance.isRemoving) setConfirming(null) }}><div className="admin-operation-dialog" role="alertdialog" aria-modal="true" aria-busy={maintenance.isRemoving} aria-labelledby="maintenance-confirm-title"><h2 id="maintenance-confirm-title">Confirm destructive action</h2><p>This will {resource === 'countries' ? 'delete' : 'archive'} {definition.title(confirming)}. Referenced records may prevent the action.</p><div className="admin-operation-actions"><button type="button" disabled={maintenance.isRemoving} onClick={() => setConfirming(null)}>Cancel</button><button type="button" className="admin-operation-confirm" disabled={maintenance.isRemoving} onClick={async () => { try { await maintenance.remove(confirming.id); setConfirming(null) } catch { setConfirming(null) } }}>{maintenance.isRemoving ? 'Working…' : 'Confirm'}</button></div></div></div>}
      {nodeDialogOpen && scope === 'admin' && <NodeMaintenanceDialog node={nodeDialogNode}
        defaultCountry={references.countries[0]} zones={references.zones} nodes={references.nodes} birds={references.birds}
        getAccessToken={getAccessToken} returnFocusRef={resource === 'nodes' ? editorReturnFocusRef : nodeActionRef}
        onClose={() => { setNodeDialogOpen(false); setNodeDialogNode(null) }}
        onSaved={resource === 'nodes' ? handleStandaloneNodeSaved : handleTourNodeCreated} />}
    </section>
  )
}

export { payloadFor, validateForm }
export default AdminMaintenance
