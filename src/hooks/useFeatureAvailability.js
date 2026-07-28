import { useCallback, useEffect, useMemo, useState } from 'react'
import { getFeatureAvailability } from '../api/featureAvailabilityApi'

const MESSAGES = {
  voice_ai: 'Voice messages are temporarily unavailable.',
  multimodal_bird_identification: 'Bird identification is temporarily unavailable.',
  agent_booking: 'AI-assisted booking is temporarily unavailable.',
}

export default function useFeatureAvailability() {
  const [features, setFeatures] = useState({})
  const [now, setNow] = useState(() => Date.now())
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    getFeatureAvailability({ signal: controller.signal })
      .then(({ features: next }) => {
        setFeatures(Object.fromEntries(next.map((feature) => [feature.name, feature])))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [refreshKey])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    window.addEventListener('birdwatching:feature-availability-changed', refresh)
    return () => window.removeEventListener('birdwatching:feature-availability-changed', refresh)
  }, [refresh])

  const nextExpiration = useMemo(() => Math.min(
    ...Object.values(features)
      .map((feature) => feature.disabledUntil ? new Date(feature.disabledUntil).getTime() : Infinity)
      .filter((value) => value > Date.now())
  ), [features])

  useEffect(() => {
    if (!Number.isFinite(nextExpiration)) return undefined
    const timer = window.setTimeout(refresh, nextExpiration - Date.now() + 25)
    return () => window.clearTimeout(timer)
  }, [nextExpiration, refresh])

  const getFeature = useCallback((name) => {
    const feature = features[name]
    if (!feature) {
      return {
        name,
        enabled: true,
        status: 'enabled',
        disabledUntil: null,
        message: '',
        remainingMinutes: null,
      }
    }
    const remainingMinutes = feature.disabledUntil
      ? Math.max(0, Math.ceil((new Date(feature.disabledUntil).getTime() - now) / 60_000))
      : null
    return {
      ...feature,
      message: MESSAGES[name],
      remainingMinutes,
    }
  }, [features, now])

  return { getFeature, refresh }
}
