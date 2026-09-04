import { useState } from 'react'
import useGoogleCoordinatePickerMap from '../../hooks/useGoogleCoordinatePickerMap'

function CoordinatePickerMap({ latitude, longitude, country, focusPoint, onChange }) {
  const [mapElement, setMapElement] = useState(null)
  const status = useGoogleCoordinatePickerMap({ mapElement, latitude, longitude, country, focusPoint, onChange })

  return (
    <div className="coordinate-picker">
      <div
        ref={setMapElement}
        className="coordinate-picker-map"
        role="application"
        aria-label={`Coordinate map${country?.name ? ` centered on ${country.name}` : ''}. Click the map or drag the marker to set coordinates.`}
      />
      {status !== 'ready' && (
        <p className="coordinate-map-status" role={status === 'loading' ? 'status' : 'alert'}>
          {status === 'loading' ? 'Loading map…' : status}
        </p>
      )}
      <p className="admin-muted coordinate-map-help">Click the map or drag the marker to set coordinates.</p>
    </div>
  )
}

export default CoordinatePickerMap

