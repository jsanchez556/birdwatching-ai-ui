import { useCallback, useEffect, useState } from 'react'
import { getAdminUsers } from '../api/adminApi'

export default function useAdminUsers({ getAccessToken, initialResult }) {
  const [result, setResult] = useState(initialResult || { data: [], meta: {} })
  const [status, setStatus] = useState('success')
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { if (initialResult) setResult(initialResult) }, [initialResult])

  const load = useCallback(async ({ page = 1, query = search } = {}) => {
    setStatus('loading'); setError(null)
    try {
      const token = await getAccessToken()
      const next = await getAdminUsers({ token, page, limit: 25, search: query })
      setResult(next); setSearch(query); setStatus('success')
      return next
    } catch (requestError) {
      setError(requestError.message || 'Unable to load users.'); setStatus('error')
      return null
    }
  }, [getAccessToken, search])

  return { error, load, result, search, status }
}
