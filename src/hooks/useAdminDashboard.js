import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadAdminDashboard } from '../api/adminApi'

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today', days: 1 },
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
]

function getUtcRange(rangeValue, now = new Date()) {
  const selected = RANGE_OPTIONS.find((option) => option.value === rangeValue) || RANGE_OPTIONS[2]
  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ))

  start.setUTCDate(start.getUTCDate() - (selected.days - 1))

  return {
    startDate: start.toISOString(),
    endDate: now.toISOString(),
  }
}

export default function useAdminDashboard({ getAccessToken } = {}) {
  const [range, setRange] = useState('30d')
  const [refreshKey, setRefreshKey] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const dateRange = useMemo(() => getUtcRange(range), [range, refreshKey])

  useEffect(() => {
    let active = true

    if (data) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    Promise.resolve()
      .then(() => getAccessToken())
      .then((token) => loadAdminDashboard({
        token,
        ...dateRange,
      }))
      .then((result) => {
        if (active) {
          setData(result)
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || 'Unable to load the admin dashboard.')
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => {
      active = false
    }
  }, [dateRange, getAccessToken])

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1)
  }, [])

  return {
    data,
    error,
    isLoading,
    isRefreshing,
    range,
    rangeOptions: RANGE_OPTIONS,
    refresh,
    setRange,
  }
}

export { getUtcRange, RANGE_OPTIONS }
