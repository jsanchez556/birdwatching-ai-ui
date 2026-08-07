import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createMaintenance, deleteMaintenance, listMaintenance, updateMaintenance, uploadTourImage,
} from '../api/adminMaintenanceApi'
import { createMyTour, listMyTours, updateMyTour } from '../api/myToursApi'

export default function useAdminMaintenance({ resource, getAccessToken, filters = {}, scope = 'admin' }) {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 })
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const requestRef = useRef(0)
  const savePendingRef = useRef(false)
  const removePendingRef = useRef(false)

  const load = useCallback(async ({ page = meta.page || 1 } = {}) => {
    const requestId = ++requestRef.current
    setStatus('loading')
    setError(null)
    try {
      const token = await getAccessToken()
      const result = scope === 'my-tours'
        ? await listMyTours({ token, page, limit: 25, ...filters })
        : await listMaintenance(resource, { token, page, limit: 25, ...filters })
      if (requestRef.current === requestId) {
        setItems(result.items)
        setMeta(result.meta)
        setStatus('success')
      }
      return result
    } catch (loadError) {
      if (requestRef.current === requestId) {
        setError(loadError.message || 'Unable to load records.')
        setStatus('error')
      }
      return null
    }
  }, [filters, getAccessToken, meta.page, resource, scope])

  useEffect(() => {
    load({ page: 1 })
    return () => { requestRef.current += 1 }
  }, [resource, filters.search, filters.countryId, filters.zoneId, filters.nodeId,
    filters.type, filters.status, filters.difficulty])

  const save = useCallback(async ({ id, data, image }) => {
    if (savePendingRef.current) throw new Error('A save is already in progress.')
    savePendingRef.current = true
    setError(null)
    setNotice(null)
    setIsSaving(true)
    try {
      const token = await getAccessToken()
      let entity = null
      if (data !== null && data !== undefined) {
        entity = scope === 'my-tours'
          ? id ? await updateMyTour(id, data, { token }) : await createMyTour(data, { token })
          : id ? await updateMaintenance(resource, id, data, { token })
            : await createMaintenance(resource, data, { token })
      }
      const imageResult = image && id && resource === 'tours' && scope === 'admin'
        ? await uploadTourImage(id, image, { token })
        : null
      if (!entity && !imageResult) throw new Error('There are no changes to save.')
      setNotice(imageResult
        ? entity ? 'Changes and tour image saved.' : 'Tour image saved.'
        : id ? 'Changes saved.' : 'Record created.')
      await load({ page: id ? meta.page : 1 })
      return { entity, image: imageResult?.image || null }
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the record.')
      throw saveError
    } finally {
      savePendingRef.current = false
      setIsSaving(false)
    }
  }, [getAccessToken, load, meta.page, resource, scope])

  const remove = useCallback(async (id) => {
    if (scope === 'my-tours') throw new Error('Tours cannot be archived from this view.')
    if (removePendingRef.current) throw new Error('A delete or archive is already in progress.')
    removePendingRef.current = true
    setError(null)
    setNotice(null)
    setIsRemoving(true)
    try {
      const token = await getAccessToken()
      const result = await deleteMaintenance(resource, id, { token })
      setNotice(result.archived ? 'Record archived.' : 'Record deleted.')
      await load({ page: meta.page })
      return result
    } catch (removeError) {
      setError(removeError.message || 'Unable to remove the record.')
      throw removeError
    } finally {
      removePendingRef.current = false
      setIsRemoving(false)
    }
  }, [getAccessToken, load, meta.page, resource, scope])

  const clearError = useCallback(() => setError(null), [])

  return { clearError, error, isRemoving, isSaving, items, load, meta, notice, remove, save, status }
}
