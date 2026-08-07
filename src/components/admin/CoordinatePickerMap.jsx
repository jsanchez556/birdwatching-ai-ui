import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FOCUSED_LOCATION_ZOOM, getMapTileUrl, MAP_ATTRIBUTION_URL, MAP_TILE_SIZE,
  MAP_ZOOM_RANGE, mapWorldSize, projectMapPoint, resolveCountryMapView,
  unprojectMapPoint, WEB_MERCATOR_MAX_LATITUDE,
} from '../../config/map'

const DRAG_THRESHOLD_PX = 6
const KEYBOARD_PAN_FRACTION = 0.2
const TILE_RADIUS = 2

function finite(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function wrap(value, size) {
  return ((value % size) + size) % size
}

function viewFromWorldPoint(point, zoom) {
  const worldSize = mapWorldSize(zoom)
  return {
    ...unprojectMapPoint({ x: wrap(point.x, worldSize), y: clamp(point.y, 0, worldSize) }, zoom),
    zoom,
  }
}

function pointerPosition(event) {
  return { x: event.clientX, y: event.clientY }
}

function distance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function midpoint(first, second) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

function CoordinatePickerMap({ latitude, longitude, country, focusPoint, onChange }) {
  const mapRef = useRef(null)
  const pointersRef = useRef(new Map())
  const capturedPointerIdsRef = useRef(new Set())
  const captureTargetsRef = useRef(new Map())
  const gestureRef = useRef(null)
  const viewRef = useRef(null)
  const wheelDeltaRef = useRef(0)
  const lat = finite(latitude)
  const lon = finite(longitude)
  const focusLat = finite(focusPoint?.latitude)
  const focusLon = finite(focusPoint?.longitude)
  const hasFocusPoint = focusLat !== null && focusLon !== null
  const hasMarker = lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  const markerKey = hasMarker ? `${lat}:${lon}` : null
  const previousMarkerKeyRef = useRef(markerKey)
  const countryView = useMemo(() => resolveCountryMapView(country), [
    country?.latitude, country?.longitude, country?.zoom,
  ])
  const [view, setViewState] = useState(() => hasMarker
    ? { latitude: lat, longitude: lon, zoom: FOCUSED_LOCATION_ZOOM }
    : countryView)

  const setView = (nextView) => {
    setViewState((current) => {
      const resolved = typeof nextView === 'function' ? nextView(current) : nextView
      const safe = {
        latitude: clamp(resolved.latitude, -WEB_MERCATOR_MAX_LATITUDE, WEB_MERCATOR_MAX_LATITUDE),
        longitude: clamp(resolved.longitude, -180, 180),
        zoom: clamp(Math.round(resolved.zoom), MAP_ZOOM_RANGE.min, MAP_ZOOM_RANGE.max),
      }
      viewRef.current = safe
      return safe
    })
  }

  viewRef.current = view
  useEffect(() => {
    if (!hasMarker && !hasFocusPoint) setView(countryView)
  }, [countryView, hasFocusPoint, hasMarker])
  useEffect(() => {
    if (hasFocusPoint) {
      setView({ latitude: focusLat, longitude: focusLon, zoom: FOCUSED_LOCATION_ZOOM })
    }
  }, [focusLat, focusLon, hasFocusPoint, focusPoint?.key])
  useEffect(() => {
    if (markerKey && markerKey !== previousMarkerKeyRef.current) {
      setView((current) => ({ ...current, latitude: lat, longitude: lon }))
    }
    previousMarkerKeyRef.current = markerKey
  }, [lat, lon, markerKey])

  const centerWorldPoint = useMemo(() => projectMapPoint(view, view.zoom), [view])
  const worldSize = mapWorldSize(view.zoom)
  const tiles = useMemo(() => {
    const centerTileX = Math.floor(centerWorldPoint.x / MAP_TILE_SIZE)
    const centerTileY = Math.floor(centerWorldPoint.y / MAP_TILE_SIZE)
    const tileCount = 2 ** view.zoom
    const items = []
    for (let offsetY = -TILE_RADIUS; offsetY <= TILE_RADIUS; offsetY += 1) {
      const rawY = centerTileY + offsetY
      if (rawY < 0 || rawY >= tileCount) continue
      for (let offsetX = -TILE_RADIUS; offsetX <= TILE_RADIUS; offsetX += 1) {
        const rawX = centerTileX + offsetX
        const x = wrap(rawX, tileCount)
        items.push({
          key: `${view.zoom}:${rawX}:${rawY}`,
          url: getMapTileUrl({ zoom: view.zoom, x, y: rawY }),
          left: rawX * MAP_TILE_SIZE - centerWorldPoint.x,
          top: rawY * MAP_TILE_SIZE - centerWorldPoint.y,
          x,
          y: rawY,
        })
      }
    }
    return items
  }, [centerWorldPoint.x, centerWorldPoint.y, view.zoom])
  const markerPosition = useMemo(() => {
    if (!hasMarker) return null
    const point = projectMapPoint({ latitude: lat, longitude: lon }, view.zoom)
    let x = point.x - centerWorldPoint.x
    if (x > worldSize / 2) x -= worldSize
    if (x < -worldSize / 2) x += worldSize
    return { x, y: point.y - centerWorldPoint.y }
  }, [centerWorldPoint.x, centerWorldPoint.y, hasMarker, lat, lon, view.zoom, worldSize])
  const canZoomIn = view.zoom < MAP_ZOOM_RANGE.max
  const canZoomOut = view.zoom > MAP_ZOOM_RANGE.min

  const rectangleForMap = () => mapRef.current?.getBoundingClientRect()

  const mapPointAt = (clientX, clientY, sourceView = viewRef.current) => {
    const rectangle = rectangleForMap()
    if (!rectangle?.width || !rectangle?.height) return null
    const center = projectMapPoint(sourceView, sourceView.zoom)
    return {
      world: {
        x: center.x + clientX - rectangle.left - rectangle.width / 2,
        y: center.y + clientY - rectangle.top - rectangle.height / 2,
      },
      offset: {
        x: clientX - rectangle.left - rectangle.width / 2,
        y: clientY - rectangle.top - rectangle.height / 2,
      },
    }
  }

  const coordinatesAt = (clientX, clientY, sourceView = viewRef.current) => {
    const point = mapPointAt(clientX, clientY, sourceView)
    if (!point) return null
    const sourceWorldSize = mapWorldSize(sourceView.zoom)
    return unprojectMapPoint({
      x: wrap(point.world.x, sourceWorldSize),
      y: clamp(point.world.y, 0, sourceWorldSize),
    }, sourceView.zoom)
  }

  const placeMarker = (clientX, clientY) => {
    const coordinates = coordinatesAt(clientX, clientY)
    if (!coordinates) return
    onChange?.({
      latitude: Number(coordinates.latitude.toFixed(6)),
      longitude: Number(coordinates.longitude.toFixed(6)),
    })
  }

  const zoomTo = (nextZoom, clientX, clientY) => {
    setView((current) => {
      const zoom = clamp(Math.round(nextZoom), MAP_ZOOM_RANGE.min, MAP_ZOOM_RANGE.max)
      if (zoom === current.zoom) return current
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return { ...current, zoom }
      const anchor = coordinatesAt(clientX, clientY, current)
      const point = mapPointAt(clientX, clientY, current)
      if (!anchor || !point) return { ...current, zoom }
      const anchorAtNextZoom = projectMapPoint(anchor, zoom)
      return viewFromWorldPoint({
        x: anchorAtNextZoom.x - point.offset.x,
        y: anchorAtNextZoom.y - point.offset.y,
      }, zoom)
    })
  }

  const zoomBy = (amount) => zoomTo(viewRef.current.zoom + amount)

  const releasePointer = (pointerId) => {
    const map = captureTargetsRef.current.get(pointerId) || mapRef.current
    try {
      if (capturedPointerIdsRef.current.has(pointerId)
        && (!map?.hasPointerCapture || map.hasPointerCapture(pointerId))) {
        map?.releasePointerCapture?.(pointerId)
      }
    } catch {
      // Browsers may release capture automatically before pointer-up reaches React.
    }
    capturedPointerIdsRef.current.delete(pointerId)
    captureTargetsRef.current.delete(pointerId)
  }

  const resetPointerInteraction = () => {
    for (const pointerId of capturedPointerIdsRef.current) releasePointer(pointerId)
    capturedPointerIdsRef.current.clear()
    captureTargetsRef.current.clear()
    pointersRef.current.clear()
    gestureRef.current = null
  }

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') resetPointerInteraction()
    }
    window.addEventListener('blur', resetPointerInteraction)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('blur', resetPointerInteraction)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      resetPointerInteraction()
    }
  }, [])

  const startGesture = (event) => {
    const pointerId = event.pointerId ?? 1
    pointersRef.current.set(pointerId, pointerPosition(event))
    try {
      mapRef.current?.setPointerCapture?.(pointerId)
      capturedPointerIdsRef.current.add(pointerId)
      captureTargetsRef.current.set(pointerId, event.currentTarget)
    } catch {
      capturedPointerIdsRef.current.delete(pointerId)
      captureTargetsRef.current.delete(pointerId)
    }
    const points = [...pointersRef.current.values()]
    if (points.length === 1) {
      gestureRef.current = {
        kind: 'pan', startPoint: points[0], startView: viewRef.current, moved: false,
      }
    } else if (points.length === 2) {
      const startMidpoint = midpoint(points[0], points[1])
      gestureRef.current = {
        kind: 'pinch', startView: viewRef.current,
        startDistance: Math.max(1, distance(points[0], points[1])),
        anchor: coordinatesAt(startMidpoint.x, startMidpoint.y, viewRef.current),
        moved: true,
      }
    }
  }

  const moveGesture = (event) => {
    const pointerId = event.pointerId ?? 1
    if (!pointersRef.current.has(pointerId)) return
    pointersRef.current.set(pointerId, pointerPosition(event))
    const gesture = gestureRef.current
    const rectangle = rectangleForMap()
    if (!gesture || !rectangle?.width || !rectangle?.height) return
    const points = [...pointersRef.current.values()]

    if (points.length >= 2 && gesture.kind === 'pinch') {
      event.preventDefault()
      const currentMidpoint = midpoint(points[0], points[1])
      const scale = distance(points[0], points[1]) / gesture.startDistance
      const zoom = clamp(
        Math.round(gesture.startView.zoom + Math.log2(Math.max(0.25, scale))),
        MAP_ZOOM_RANGE.min,
        MAP_ZOOM_RANGE.max,
      )
      if (!gesture.anchor) return
      const anchorWorld = projectMapPoint(gesture.anchor, zoom)
      setView(viewFromWorldPoint({
        x: anchorWorld.x - (currentMidpoint.x - rectangle.left - rectangle.width / 2),
        y: anchorWorld.y - (currentMidpoint.y - rectangle.top - rectangle.height / 2),
      }, zoom))
      return
    }

    if (points.length === 1 && gesture.kind === 'pan') {
      const dx = points[0].x - gesture.startPoint.x
      const dy = points[0].y - gesture.startPoint.y
      if (!gesture.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      gesture.moved = true
      event.preventDefault()
      const startCenter = projectMapPoint(gesture.startView, gesture.startView.zoom)
      setView(viewFromWorldPoint({ x: startCenter.x - dx, y: startCenter.y - dy }, gesture.startView.zoom))
    }
  }

  const endGesture = (event) => {
    const pointerId = event.pointerId ?? 1
    const gesture = gestureRef.current
    const wasSingleTap = pointersRef.current.size === 1 && gesture?.kind === 'pan' && !gesture.moved
    pointersRef.current.delete(pointerId)
    releasePointer(pointerId)
    if (wasSingleTap) placeMarker(event.clientX, event.clientY)
    const remaining = [...pointersRef.current.values()]
    gestureRef.current = remaining.length === 1
      ? { kind: 'pan', startPoint: remaining[0], startView: viewRef.current, moved: true }
      : null
  }

  const cancelGesture = (event) => {
    releasePointer(event.pointerId ?? 1)
    resetPointerInteraction()
  }

  const losePointerCapture = (event) => {
    const pointerId = event.pointerId ?? 1
    capturedPointerIdsRef.current.delete(pointerId)
    captureTargetsRef.current.delete(pointerId)
    pointersRef.current.delete(pointerId)
    if (pointersRef.current.size === 0) gestureRef.current = null
  }

  const panByKeyboard = (key) => {
    setView((current) => {
      const rectangle = rectangleForMap()
      const horizontalStep = (rectangle?.width || MAP_TILE_SIZE) * KEYBOARD_PAN_FRACTION
      const verticalStep = (rectangle?.height || MAP_TILE_SIZE) * KEYBOARD_PAN_FRACTION
      const center = projectMapPoint(current, current.zoom)
      return viewFromWorldPoint({
        x: center.x + (key === 'ArrowRight' ? horizontalStep : key === 'ArrowLeft' ? -horizontalStep : 0),
        y: center.y + (key === 'ArrowDown' ? verticalStep : key === 'ArrowUp' ? -verticalStep : 0),
      }, current.zoom)
    })
  }

  return (
    <div className="coordinate-picker">
      <div className="coordinate-picker-map-shell">
        <div
          ref={mapRef}
          className="coordinate-picker-map"
          role="application"
          tabIndex="0"
          aria-label={`Coordinate map${country?.name ? ` centered on ${country.name}` : ''}. Drag to pan, use plus or minus to zoom, and press Enter or tap to set coordinates.`}
          data-center-latitude={view.latitude}
          data-center-longitude={view.longitude}
          data-zoom={view.zoom}
          onWheel={(event) => {
            event.preventDefault()
            if (!event.deltaY) return
            const normalizedDelta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1)
            wheelDeltaRef.current += normalizedDelta
            if (Math.abs(wheelDeltaRef.current) < 24) return
            zoomTo(viewRef.current.zoom + (wheelDeltaRef.current < 0 ? 1 : -1), event.clientX, event.clientY)
            wheelDeltaRef.current = 0
          }}
          onPointerDown={startGesture}
          onPointerMove={moveGesture}
          onPointerUp={endGesture}
          onPointerCancel={cancelGesture}
          onLostPointerCapture={losePointerCapture}
          onKeyDown={(event) => {
            if (['+', '='].includes(event.key)) {
              event.preventDefault(); zoomBy(1)
            } else if (['-', '_'].includes(event.key)) {
              event.preventDefault(); zoomBy(-1)
            } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
              event.preventDefault(); panByKeyboard(event.key)
            } else if (['Enter', ' '].includes(event.key)) {
              event.preventDefault()
              const rectangle = rectangleForMap()
              if (rectangle?.width && rectangle?.height) {
                placeMarker(rectangle.left + rectangle.width / 2, rectangle.top + rectangle.height / 2)
              }
            }
          }}
        >
          <div className="coordinate-map-tiles" aria-hidden="true">
            {tiles.map((tile) => <img key={tile.key} src={tile.url} alt="" draggable="false"
              data-tile-x={tile.x} data-tile-y={tile.y}
              style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }} />)}
          </div>
          <span className="coordinate-map-shade" aria-hidden="true" />
          {hasMarker && markerPosition && (
            <span
              className="coordinate-map-marker"
              aria-label={`Marker at latitude ${lat}, longitude ${lon}`}
              style={{
                left: `calc(50% + ${markerPosition.x}px)`,
                top: `calc(50% + ${markerPosition.y}px)`,
              }}
            >
              <svg viewBox="0 0 24 32" aria-hidden="true" focusable="false">
                <path d="M12 1C5.9 1 1 5.9 1 12c0 8.2 11 19 11 19s11-10.8 11-19C23 5.9 18.1 1 12 1Z" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </span>
          )}
        </div>
        <div className="coordinate-map-zoom-controls" role="group" aria-label="Map zoom controls">
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={!canZoomIn} onClick={() => zoomBy(1)}>+</button>
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={!canZoomOut} onClick={() => zoomBy(-1)}>−</button>
        </div>
      </div>
      <p className="admin-muted coordinate-map-help">
        Drag to pan. Scroll or pinch to zoom. Press Enter to place the marker at the map center.
      </p>
      <p className="admin-muted" role="status" aria-live="polite">
        View center: {view.latitude.toFixed(4)}, {view.longitude.toFixed(4)} · Zoom {view.zoom}
      </p>
      <a className="coordinate-map-attribution" href={MAP_ATTRIBUTION_URL} target="_blank" rel="noreferrer">Map data © OpenStreetMap contributors</a>
    </div>
  )
}

export default CoordinatePickerMap
