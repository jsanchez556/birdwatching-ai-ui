import { useCallback, useEffect, useRef, useState } from 'react'
import { ADMIN_SECTION_IDS, loadAdminSection } from '../api/adminApi'

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today', days: 1 },
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
]

export const ADMIN_SECTIONS = Object.freeze([
  { id: ADMIN_SECTION_IDS.AI_OPERATIONS, label: 'AI Operations', rangeDependent: true },
  { id: ADMIN_SECTION_IDS.CONTEXT_ENGINEERING, label: 'Context engineering', rangeDependent: true },
  { id: ADMIN_SECTION_IDS.COMMERCIAL, label: 'Commercial administration', rangeDependent: false },
  { id: ADMIN_SECTION_IDS.EMERGENCY, label: 'Emergency controls', rangeDependent: false },
])

const SECTION_BY_ID = new Map(ADMIN_SECTIONS.map((section) => [section.id, section]))
const EMPTY_SECTION_STATE = Object.freeze({
  status: 'idle',
  data: null,
  error: null,
})

function createSectionStates() {
  return Object.fromEntries(ADMIN_SECTIONS.map(({ id }) => [id, { ...EMPTY_SECTION_STATE }]))
}

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
  const [activeSection, setActiveSectionState] = useState(ADMIN_SECTION_IDS.AI_OPERATIONS)
  const [range, setRangeState] = useState('30d')
  const [sectionStates, setSectionStates] = useState(createSectionStates)
  const [now, setNow] = useState(() => Date.now())
  const mountedRef = useRef(true)
  const requestSequenceRef = useRef(0)
  const pendingBySectionRef = useRef(new Map())
  const requestVersionBySectionRef = useRef(new Map())

  const getSectionState = useCallback((sectionId) => (
    sectionStates[sectionId] || EMPTY_SECTION_STATE
  ), [sectionStates])

  const loadSection = useCallback(async (sectionId, { force = false } = {}) => {
    if (!SECTION_BY_ID.has(sectionId)) return null
    const currentState = sectionStates[sectionId]
    if (pendingBySectionRef.current.has(sectionId)) {
      return currentState?.data || null
    }
    if (!force && (currentState?.status === 'success' || currentState?.status === 'error')) {
      return currentState?.data || null
    }

    const requestId = ++requestSequenceRef.current
    pendingBySectionRef.current.set(sectionId, requestId)
    requestVersionBySectionRef.current.set(sectionId, requestId)
    setSectionStates((current) => ({
      ...current,
      [sectionId]: {
        status: 'loading',
        data: null,
        error: null,
      },
    }))

    try {
      const token = await getAccessToken()
      const section = SECTION_BY_ID.get(sectionId)
      const data = await loadAdminSection(sectionId, {
        token,
        ...(section.rangeDependent ? getUtcRange(range) : {}),
      })
      if (
        mountedRef.current
        && requestVersionBySectionRef.current.get(sectionId) === requestId
      ) {
        setSectionStates((current) => ({
          ...current,
          [sectionId]: {
            status: 'success',
            data,
            error: null,
          },
        }))
      }
      return data
    } catch (error) {
      if (
        mountedRef.current
        && requestVersionBySectionRef.current.get(sectionId) === requestId
      ) {
        setSectionStates((current) => ({
          ...current,
          [sectionId]: {
            status: 'error',
            data: null,
            error: error?.message || `Unable to load ${SECTION_BY_ID.get(sectionId).label}.`,
          },
        }))
      }
      return null
    } finally {
      if (pendingBySectionRef.current.get(sectionId) === requestId) {
        pendingBySectionRef.current.delete(sectionId)
      }
    }
  }, [getAccessToken, range, sectionStates])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      requestVersionBySectionRef.current.clear()
      pendingBySectionRef.current.clear()
    }
  }, [])

  useEffect(() => {
    loadSection(activeSection)
  }, [activeSection, loadSection])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const setActiveSection = useCallback((sectionId) => {
    if (SECTION_BY_ID.has(sectionId)) setActiveSectionState(sectionId)
  }, [])

  const invalidateSections = useCallback((sectionIds) => {
    const targets = new Set(sectionIds.filter((id) => SECTION_BY_ID.has(id)))
    for (const sectionId of targets) {
      requestVersionBySectionRef.current.set(sectionId, ++requestSequenceRef.current)
      pendingBySectionRef.current.delete(sectionId)
    }
    setSectionStates((current) => {
      const next = { ...current }
      for (const sectionId of targets) next[sectionId] = { ...EMPTY_SECTION_STATE }
      return next
    })
  }, [])

  const setRange = useCallback((nextRange) => {
    if (!RANGE_OPTIONS.some(({ value }) => value === nextRange) || nextRange === range) return
    const dependentIds = ADMIN_SECTIONS
      .filter(({ rangeDependent }) => rangeDependent)
      .map(({ id }) => id)
    invalidateSections(dependentIds)
    setRangeState(nextRange)
  }, [invalidateSections, range])

  const refresh = useCallback(() => loadSection(activeSection, { force: true }), [
    activeSection,
    loadSection,
  ])

  const refreshSections = useCallback((sectionIds, { loadedOnly = true } = {}) => {
    return Promise.all(sectionIds.map((sectionId) => {
      const state = sectionStates[sectionId]
      if (loadedOnly && sectionId !== activeSection && state?.status !== 'success') return null
      return loadSection(sectionId, { force: true })
    }))
  }, [activeSection, loadSection, sectionStates])

  const activeState = sectionStates[activeSection] || EMPTY_SECTION_STATE

  return {
    activeSection,
    activeState,
    getSectionState,
    invalidateSections,
    isLoading: activeState.status === 'loading',
    now,
    range,
    rangeOptions: RANGE_OPTIONS,
    refresh,
    refreshSections,
    sections: ADMIN_SECTIONS,
    setActiveSection,
    setRange,
  }
}

export {
  ADMIN_SECTION_IDS,
  EMPTY_SECTION_STATE,
  getUtcRange,
  RANGE_OPTIONS,
}
