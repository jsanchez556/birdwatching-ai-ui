// Shared by the transportation map and the admin coordinate picker so the Google Maps
// script tag and browser API key configuration exist in exactly one place.
const DEFAULT_LIBRARIES = 'places,geometry'
let mapsPromise

export function loadGoogleMaps(libraries = DEFAULT_LIBRARIES) {
  if (window.google?.maps?.places) return Promise.resolve(window.google)
  if (mapsPromise) return mapsPromise
  const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_API_KEY
  if (!key) return Promise.reject(new Error('Google Maps is not configured.'))
  mapsPromise = new Promise((resolve, reject) => {
    const callback = `googleMapsReady${Date.now()}`
    window[callback] = () => { delete window[callback]; resolve(window.google) }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=${libraries}&callback=${callback}`
    script.async = true
    script.onerror = () => { mapsPromise = undefined; reject(new Error('Google Maps could not be loaded.')) }
    document.head.appendChild(script)
  })
  return mapsPromise
}
