import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createMaintenance, deleteMaintenance, listMaintenance, searchAdminLocations,
  reverseGeocodeAdminLocation, updateMaintenance,
} from '../../api/adminMaintenanceApi'
import CoordinatePickerMap from './CoordinatePickerMap'
import { CurrentLocationIcon, SearchIcon } from './MaintenanceIcons'
import {
  DEVICE_LOCATION_OPTIONS, distanceBetweenCoordinates, MAX_DEVICE_LOCATION_ACCURACY_METERS,
  MAX_REVERSE_LABEL_DISTANCE_METERS, validateDevicePosition,
} from '../../config/geolocation'

const EMPTY_NODE = Object.freeze({
  zoneId: '', parentId: '', name: '', description: '', rank: 0,
  lat: '', lon: '', isActive: true,
})

function validCoordinate(value, min, max) {
  if (value === '' || value === null || value === undefined) return false
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max
}

function formattedCoordinates(latitude, longitude) {
  return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
}

function geolocationErrorMessage(error) {
  if (error?.code === 1) return 'Location permission was denied. Enable location access in your browser settings and try again.'
  if (error?.code === 2) return 'Your current location is unavailable. Check your device location settings and try again.'
  if (error?.code === 3) return 'Finding your current location timed out. Check your connection and try again.'
  return 'Your current location could not be determined. Please try again or place the marker manually.'
}

export function validateNode(values) {
  const errors = {}
  if (!values.zoneId) errors.zoneId = 'Select a zone.'
  if (!String(values.name || '').trim()) errors.name = 'Enter a node name.'
  if (!validCoordinate(values.lat, -90, 90)) errors.lat = 'Latitude must be between -90 and 90.'
  if (!validCoordinate(values.lon, -180, 180)) errors.lon = 'Longitude must be between -180 and 180.'
  return errors
}

function Field({ label, name, values, setValues, errors, onValueChange, ...props }) {
  const errorId = `node-${name}-error`
  return <label className="maintenance-field"><span>{label}</span><input name={name} value={values[name] ?? ''}
    aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? errorId : undefined}
    onChange={(event) => onValueChange
      ? onValueChange(event.target.value)
      : setValues((current) => ({ ...current, [name]: event.target.value }))} {...props} />
    {errors[name] && <small id={errorId} className="maintenance-field-error">{errors[name]}</small>}</label>
}

function NodeMaintenanceDialog({
  node, defaultCountry, zones, nodes, birds, getAccessToken, onClose, onSaved, returnFocusRef,
}) {
  const dialogRef = useRef(null)
  const keepEditingRef = useRef(null)
  const dirtyRef = useRef(false)
  const blockingRef = useRef(false)
  const confirmAssignmentRef = useRef(null)
  const confirmCloseRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const mountedRef = useRef(true)
  const reverseRequestRef = useRef(0)
  const locationRequestRef = useRef(0)
  const coordinateSelectionRef = useRef(0)
  const focusSequenceRef = useRef(0)
  const initial = useMemo(() => ({ ...EMPTY_NODE, ...(node || {}) }), [node])
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [savedNode, setSavedNode] = useState(node || null)
  const [assignments, setAssignments] = useState([])
  const [assignmentStatus, setAssignmentStatus] = useState(node ? 'loading' : 'idle')
  const [birdId, setBirdId] = useState('')
  const [confirmAssignment, setConfirmAssignment] = useState(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [search, setSearch] = useState('')
  const [searchStatus, setSearchStatus] = useState('idle')
  const [searchError, setSearchError] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [focusPoint, setFocusPoint] = useState(null)
  const [reverseStatus, setReverseStatus] = useState('idle')
  const [locationStatus, setLocationStatus] = useState('idle')
  const [locationError, setLocationError] = useState('')
  const [locationAccuracy, setLocationAccuracy] = useState(null)
  const geolocationSupported = typeof navigator !== 'undefined'
    && typeof navigator.geolocation?.getCurrentPosition === 'function'
  const secureContext = typeof window !== 'undefined' && window.isSecureContext === true
  const geolocationAvailable = geolocationSupported && secureContext
  const [geolocationPermission, setGeolocationPermission] = useState('checking')
  const blocking = status === 'saving' || assignmentStatus === 'loading' || searchStatus === 'loading'
    || reverseStatus === 'loading' || locationStatus === 'loading'
  dirtyRef.current = dirty
  blockingRef.current = blocking
  confirmAssignmentRef.current = confirmAssignment
  confirmCloseRef.current = confirmClose
  onCloseRef.current = onClose
  const countryZones = zones.filter((zone) => String(zone.countryId) === String(defaultCountry?.id))
  const parentNodes = nodes.filter((item) => String(item.zoneId) === String(values.zoneId) && item.id !== savedNode?.id)
  const locationAvailabilityMessage = !geolocationSupported
    ? 'Current location is not supported by this browser. Search by name or place the marker manually.'
    : !secureContext
      ? 'Current location requires a secure HTTPS connection. Search by name or place the marker manually.'
      : geolocationPermission === 'checking'
        ? 'Checking current-location permission…'
        : geolocationPermission === 'denied'
          ? 'Current-location permission is denied. Enable it in your browser settings to use this action.'
          : ''

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      reverseRequestRef.current += 1
      locationRequestRef.current += 1
      coordinateSelectionRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (!geolocationSupported) { setGeolocationPermission('unsupported'); return undefined }
    if (!secureContext) { setGeolocationPermission('insecure'); return undefined }
    if (typeof navigator.permissions?.query !== 'function') {
      setGeolocationPermission('prompt')
      return undefined
    }
    let active = true
    let permissionStatus
    const updatePermission = () => {
      if (!active) return
      const nextState = permissionStatus?.state
      setGeolocationPermission(['granted', 'prompt', 'denied'].includes(nextState) ? nextState : 'prompt')
    }
    setGeolocationPermission('checking')
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (!active) return
      permissionStatus = result
      updatePermission()
      if (typeof permissionStatus.addEventListener === 'function') {
        permissionStatus.addEventListener('change', updatePermission)
      } else {
        permissionStatus.onchange = updatePermission
      }
    }).catch(() => {
      if (active) setGeolocationPermission('prompt')
    })
    return () => {
      active = false
      if (typeof permissionStatus?.removeEventListener === 'function') {
        permissionStatus.removeEventListener('change', updatePermission)
      } else if (permissionStatus?.onchange === updatePermission) {
        permissionStatus.onchange = null
      }
    }
  }, [geolocationSupported, secureContext])

  useEffect(() => {
    dialogRef.current?.querySelector('button, input, select')?.focus()
    const keydown = (event) => {
      if (event.key === 'Escape' && !blockingRef.current) {
        event.preventDefault()
        if (confirmAssignmentRef.current) setConfirmAssignment(null)
        else if (confirmCloseRef.current) setConfirmClose(false)
        else if (dirtyRef.current) setConfirmClose(true)
        else onCloseRef.current()
      }
      if (event.key !== 'Tab') return
      const focusScope = dialogRef.current?.querySelector('[role="alertdialog"]') || dialogRef.current
      const controls = [...(focusScope?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])]
      if (!controls.length) return
      const first = controls[0]; const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); returnFocusRef?.current?.focus() }
  }, [returnFocusRef])

  useEffect(() => {
    if (confirmClose) keepEditingRef.current?.focus()
  }, [confirmClose])

  useEffect(() => {
    if (!savedNode?.id) return
    let active = true
    setAssignmentStatus('loading')
    getAccessToken().then((token) => listMaintenance('birds-by-node', {
      token, nodeId: savedNode.id, limit: 100,
    })).then((result) => {
      if (active) { setAssignments(result.items); setAssignmentStatus('success') }
    }).catch((error) => {
      if (active) { setMessage(error.message); setAssignmentStatus('error') }
    })
    return () => { active = false }
  }, [getAccessToken, savedNode?.id])

  const updateValues = (updater) => { setDirty(true); setValues(updater) }
  const updateCoordinateValue = (name, value) => {
    coordinateSelectionRef.current += 1
    locationRequestRef.current += 1
    reverseRequestRef.current += 1
    setLocationStatus('idle')
    setReverseStatus('idle')
    setLocationError('')
    setLocationAccuracy(null)
    updateValues((current) => ({ ...current, [name]: value }))
  }
  const requestClose = () => {
    if (blocking || confirmAssignment || confirmClose) return
    if (dirty) setConfirmClose(true); else onClose()
  }

  const saveNode = async (event) => {
    event.preventDefault()
    if (blocking) return
    const nextErrors = validateNode(values); setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setStatus('saving'); setMessage('')
    try {
      const token = await getAccessToken()
      const payload = {
        zoneId: Number(values.zoneId), parentId: values.parentId ? Number(values.parentId) : null,
        name: values.name.trim(), description: values.description || '', rank: Number(values.rank) || 0,
        lat: Number(values.lat), lon: Number(values.lon), isActive: values.isActive !== false,
      }
      const entity = savedNode?.id
        ? await updateMaintenance('nodes', savedNode.id, payload, { token })
        : await createMaintenance('nodes', payload, { token })
      const normalized = { ...entity, zoneId: Number(entity.zoneId || payload.zoneId) }
      setSavedNode(normalized); setValues((current) => ({ ...current, ...normalized })); setDirty(false)
      setStatus('success'); setMessage(savedNode?.id ? 'Node updated.' : 'Node created and selected for this tour.')
      onSaved(normalized)
    } catch (error) { setStatus('error'); setMessage(error.message || 'Unable to save the node.') }
  }

  const focusCoordinates = ({ latitude, longitude }) => {
    focusSequenceRef.current += 1
    setFocusPoint({ latitude, longitude, key: focusSequenceRef.current })
  }

  const reverseCoordinates = async ({ latitude, longitude }, selectionId) => {
    const requestId = ++reverseRequestRef.current
    const fallbackName = formattedCoordinates(latitude, longitude)
    setReverseStatus('loading'); setSearchError(''); setSearchResults([]); setSearch(fallbackName)
    try {
      const token = await getAccessToken()
      const location = await reverseGeocodeAdminLocation({ latitude, longitude }, { token })
      if (!mountedRef.current || requestId !== reverseRequestRef.current
        || selectionId !== coordinateSelectionRef.current) return
      const labelDistance = location && distanceBetweenCoordinates(
        { latitude, longitude },
        { latitude: location.latitude, longitude: location.longitude },
      )
      if (Number.isFinite(labelDistance) && labelDistance > MAX_REVERSE_LABEL_DISTANCE_METERS) {
        setSearch(fallbackName)
        setSearchError('Coordinates selected, but the location provider returned a distant place name. The device coordinates were kept. Review the marker or retry current location.')
        setReverseStatus('error')
        return
      }
      setSearch(String(location?.name || '').trim() || fallbackName)
      setReverseStatus('success')
    } catch (error) {
      if (!mountedRef.current || requestId !== reverseRequestRef.current
        || selectionId !== coordinateSelectionRef.current) return
      setSearch(fallbackName)
      setSearchError(`Coordinates selected, but the place name could not be loaded. ${error.message || 'Try searching by name.'}`)
      setReverseStatus('error')
    }
  }

  const selectCoordinates = ({ latitude, longitude }, {
    resolveName = true, selectionId: suppliedSelectionId, accuracy = null, source = 'map',
  } = {}) => {
    const selectionId = suppliedSelectionId ?? (coordinateSelectionRef.current + 1)
    coordinateSelectionRef.current = selectionId
    reverseRequestRef.current += 1
    if (source !== 'device') {
      locationRequestRef.current += 1
      setLocationStatus('idle')
      setLocationError('')
    }
    setLocationAccuracy(accuracy)
    setDirty(true)
    setValues((current) => ({ ...current, lat: latitude, lon: longitude }))
    setErrors((current) => ({ ...current, lat: undefined, lon: undefined }))
    focusCoordinates({ latitude, longitude })
    if (resolveName) void reverseCoordinates({ latitude, longitude }, selectionId)
  }

  const useCurrentLocation = () => {
    setLocationError('')
    setLocationAccuracy(null)
    if (!geolocationSupported) {
      setLocationStatus('error')
      setLocationError('Current location is not supported by this browser. Search by name or place the marker manually.')
      return
    }
    if (!secureContext) {
      setLocationStatus('error')
      setLocationError('Current location requires a secure HTTPS connection. Search by name or place the marker manually.')
      return
    }
    if (geolocationPermission === 'denied') {
      setLocationStatus('error')
      setLocationError('Location permission is denied. Enable it in your browser settings and try again.')
      return
    }
    const requestId = ++locationRequestRef.current
    const selectionId = ++coordinateSelectionRef.current
    reverseRequestRef.current += 1
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition((position) => {
      if (!mountedRef.current || requestId !== locationRequestRef.current
        || selectionId !== coordinateSelectionRef.current) return
      const validated = validateDevicePosition(position)
      if (!validated.valid) {
        setLocationStatus('error')
        if (validated.reason === 'poor_accuracy') {
          setLocationAccuracy({ meters: validated.accuracy, rejected: true })
          setLocationError(`Your device reported accuracy of approximately ${Math.round(validated.accuracy)} m, which is too imprecise to use. Retry outdoors or place the marker manually. The maximum accepted uncertainty is ${MAX_DEVICE_LOCATION_ACCURACY_METERS} m.`)
        } else if (validated.reason === 'stale') {
          setLocationError('Your device returned an old or invalidly timestamped position. Retry to request a fresh location, search by name, or place the marker manually.')
        } else if (validated.reason === 'accuracy') {
          setLocationError('Your device did not report usable location accuracy. Retry or place the marker manually.')
        } else {
          setLocationError('Your device returned invalid coordinates. Search by name or place the marker manually.')
        }
        return
      }
      setLocationStatus('success')
      selectCoordinates({ latitude: validated.latitude, longitude: validated.longitude }, {
        selectionId,
        source: 'device',
        accuracy: { meters: validated.accuracy, approximate: validated.approximate },
      })
    }, (error) => {
      if (!mountedRef.current || requestId !== locationRequestRef.current
        || selectionId !== coordinateSelectionRef.current) return
      setLocationStatus('error')
      if (error?.code === 1) setGeolocationPermission('denied')
      setLocationError(geolocationErrorMessage(error))
    }, DEVICE_LOCATION_OPTIONS)
  }

  const runSearch = async (event) => {
    event.preventDefault(); setSearchError(''); setSearchResults([])
    if (search.trim().length < 2) { setSearchError('Enter at least two characters.'); return }
    setSearchStatus('loading')
    try {
      const token = await getAccessToken()
      const results = await searchAdminLocations(search, { token, countryCode: defaultCountry?.acr })
      setSearchResults(results); setSearchStatus(results.length ? 'success' : 'empty')
    } catch (error) { setSearchError(error.message); setSearchStatus('error') }
  }

  const selectSearchResult = (result) => {
    setSearch(result.name || formattedCoordinates(result.latitude, result.longitude))
    setSearchResults([]); setSearchError(''); setSearchStatus('success'); setReverseStatus('idle')
    selectCoordinates(result, { resolveName: false })
  }

  const addBird = async () => {
    if (!birdId || !savedNode?.id) return
    setAssignmentStatus('loading'); setMessage('')
    try {
      const token = await getAccessToken()
      const entity = await createMaintenance('birds-by-node', {
        nodeId: savedNode.id, birdId: Number(birdId), rank: assignments.length + 1, isActive: true,
      }, { token })
      setAssignments((current) => [...current.filter((item) => item.id !== entity.id), entity])
      setBirdId(''); setAssignmentStatus('success'); setMessage('Bird assigned to this node.')
    } catch (error) { setAssignmentStatus('error'); setMessage(error.message) }
  }

  const removeBird = async () => {
    if (!confirmAssignment) return
    setAssignmentStatus('loading')
    try {
      const token = await getAccessToken()
      await deleteMaintenance('birds-by-node', confirmAssignment.id, { token })
      setAssignments((current) => current.filter((item) => item.id !== confirmAssignment.id))
      setConfirmAssignment(null); setAssignmentStatus('success'); setMessage('Bird assignment removed.')
    } catch (error) { setConfirmAssignment(null); setAssignmentStatus('error'); setMessage(error.message) }
  }

  return <div className="admin-operation-backdrop node-dialog-backdrop" role="presentation"
    onClick={(event) => { if (event.target === event.currentTarget) requestClose() }}><section ref={dialogRef}
    className="admin-operation-dialog node-maintenance-dialog" role="dialog" aria-modal="true"
    aria-labelledby="node-dialog-title" aria-busy={blocking}>
    <header className="node-dialog-header"><div><p className="admin-eyebrow">Tour location</p><h2 id="node-dialog-title">{savedNode ? 'Edit node' : 'Create node'}</h2>
      <p>Set one authoritative location for every tour using this node.</p></div><button type="button" onClick={requestClose} disabled={blocking}>Close</button></header>
    {!defaultCountry && <div className="admin-alert" role="alert"><strong>No country is configured</strong><p>Create a country record through the admin API or database migration before adding nodes.</p></div>}
    <form onSubmit={saveNode} noValidate>
      <div className="maintenance-form-grid"><label className="maintenance-field"><span>Zone</span><select value={values.zoneId}
        aria-invalid={Boolean(errors.zoneId)} onChange={(event) => updateValues((current) => ({ ...current, zoneId: event.target.value, parentId: '' }))}>
        <option value="">Select zone</option>{countryZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select>
        {errors.zoneId && <small className="maintenance-field-error">{errors.zoneId}</small>}</label>
        <label className="maintenance-field"><span>Parent node (optional)</span><select value={values.parentId || ''}
          onChange={(event) => updateValues((current) => ({ ...current, parentId: event.target.value }))}><option value="">No parent</option>
          {parentNodes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <Field label="Node name" name="name" values={values} setValues={updateValues} errors={errors} />
        <Field label="Description" name="description" values={values} setValues={updateValues} errors={errors} />
      </div>
      <div className="node-location-search" role="search">
        <div className="maintenance-field node-location-search-field"><label htmlFor="node-location-query">Find a place by name</label>
          <span className={`node-location-search-input${geolocationAvailable ? ' has-location-action' : ''}`}><SearchIcon />
            <input id="node-location-query" type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) runSearch(event) }} />
            {geolocationAvailable && <button type="button" className="maintenance-icon-button node-location-input-action"
              aria-label="Use current location" title="Use current location"
              aria-describedby={locationAvailabilityMessage ? 'node-location-availability' : undefined}
              aria-busy={locationStatus === 'loading'} onClick={useCurrentLocation}
              disabled={blocking || geolocationPermission === 'checking' || geolocationPermission === 'denied'}><CurrentLocationIcon /></button>}
          </span></div>
        <button type="button" className="maintenance-icon-button node-location-search-action" aria-label="Search map" title="Search map"
          onClick={runSearch} disabled={blocking}><SearchIcon /></button>
      </div>
      {locationAvailabilityMessage && <p id="node-location-availability" className="admin-muted node-location-unavailable" role="status">{locationAvailabilityMessage}</p>}
      {locationError && <p className="maintenance-field-error" role="alert">{locationError}</p>}
      {locationAccuracy && !locationAccuracy.rejected && <p className={locationAccuracy.approximate ? 'admin-alert node-location-accuracy' : 'maintenance-success node-location-accuracy'} role="status">
        Accurate within approximately {Math.max(1, Math.round(locationAccuracy.meters))} m.
        {locationAccuracy.approximate && ' This reading is approximate; review the marker before saving.'}
      </p>}
      {geolocationAvailable && (locationStatus === 'success' || locationStatus === 'error') && <button type="button"
        className="node-location-retry" onClick={useCurrentLocation} disabled={blocking}>Retry current location</button>}
      {searchError && <p className="maintenance-field-error" role="alert">{searchError}</p>}
      {reverseStatus === 'loading' && <p role="status">Finding a readable place name…</p>}
      {searchStatus === 'empty' && <p role="status">No matching places found. Try a nearby town or place the marker manually.</p>}
      {searchResults.length > 0 && <ul className="location-search-results">{searchResults.map((result) => <li key={`${result.latitude}:${result.longitude}`}><button type="button" onClick={() => selectSearchResult(result)}>{result.name}</button></li>)}</ul>}
      <CoordinatePickerMap country={defaultCountry} latitude={values.lat} longitude={values.lon} focusPoint={focusPoint}
        onChange={selectCoordinates} />
      <div className="maintenance-form-grid"><Field label="Latitude" name="lat" type="number" step="0.000001" min="-90" max="90" values={values} setValues={updateValues} errors={errors}
        onValueChange={(value) => updateCoordinateValue('lat', value)} />
        <Field label="Longitude" name="lon" type="number" step="0.000001" min="-180" max="180" values={values} setValues={updateValues} errors={errors}
          onValueChange={(value) => updateCoordinateValue('lon', value)} /></div>
      <label className="maintenance-check"><input type="checkbox" checked={values.isActive !== false}
        onChange={(event) => updateValues((current) => ({ ...current, isActive: event.target.checked }))} /><span>Active node</span></label>
      <button type="submit" className="maintenance-save" disabled={!defaultCountry || blocking}>{status === 'saving' ? 'Saving…' : savedNode ? 'Save node changes' : 'Create node'}</button>
    </form>
    {message && <p className={status === 'error' || assignmentStatus === 'error' ? 'admin-alert' : 'maintenance-success'} role={status === 'error' || assignmentStatus === 'error' ? 'alert' : 'status'}>{message}</p>}
    <section className="node-bird-manager" aria-labelledby="node-birds-title"><h3 id="node-birds-title">Birds at this node</h3>
      {!savedNode && <p className="admin-muted">Save the node first, then assign birds without leaving this dialog.</p>}
      {savedNode && <><div className="node-bird-add"><label className="maintenance-field"><span>Bird</span><select value={birdId} onChange={(event) => setBirdId(event.target.value)}><option value="">Select bird</option>{birds.filter((bird) => !assignments.some((item) => Number(item.birdId) === Number(bird.id))).map((bird) => <option key={bird.id} value={bird.id}>{bird.name}</option>)}</select></label><button type="button" disabled={!birdId || assignmentStatus === 'loading'} onClick={addBird}>Assign bird</button></div>
        {assignmentStatus === 'loading' && <p role="status">Loading bird assignments…</p>}
        {assignmentStatus !== 'loading' && assignments.length === 0 && <p>No birds are assigned yet.</p>}
        <ul className="node-bird-list">{assignments.map((item) => <li key={item.id}><span>{item.birdName || birds.find((bird) => bird.id === item.birdId)?.name || `Bird ${item.birdId}`}</span><button type="button" className="admin-danger-action" onClick={() => setConfirmAssignment(item)}>Remove</button></li>)}</ul></>}
    </section>
    {confirmAssignment && <div className="node-inline-confirm" role="alertdialog" aria-modal="true" aria-labelledby="remove-bird-title"><h3 id="remove-bird-title">Remove this bird assignment?</h3><p>The bird record itself will not be deleted.</p><div><button type="button" onClick={() => setConfirmAssignment(null)}>Cancel</button><button type="button" className="admin-danger-action" onClick={removeBird}>Remove assignment</button></div></div>}
    {confirmClose && <div className="node-inline-confirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-node-title"><h3 id="discard-node-title">Discard unsaved node changes?</h3><p>Your tour form will remain unchanged.</p><div><button ref={keepEditingRef} type="button" onClick={() => setConfirmClose(false)}>Keep editing</button><button type="button" className="admin-danger-action" onClick={onClose}>Discard changes</button></div></div>}
  </section></div>
}

export default NodeMaintenanceDialog
