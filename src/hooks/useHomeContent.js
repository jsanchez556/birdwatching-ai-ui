import { useEffect, useState } from 'react'
import {
  loadBirdHighlights,
  loadFeaturedTours,
  loadHeroContent,
} from '../api/homeApi'

const initialState = {
  hero: null,
  tours: [],
  birds: [],
  isLoading: true,
  error: null,
}

export default function useHomeContent() {
  const [state, setState] = useState(initialState)
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    let isMounted = true

    async function loadContent() {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: null,
      }))

      try {
        const [hero, tours, birds] = await Promise.all([
          loadHeroContent().catch(() => null),
          loadFeaturedTours(),
          loadBirdHighlights(),
        ])

        if (isMounted) {
          setState({
            hero,
            tours,
            birds,
            isLoading: false,
            error: null,
          })
        }
      } catch (error) {
        if (isMounted) {
          setState({
            hero: null,
            tours: [],
            birds: [],
            isLoading: false,
            error: error.message || 'Unable to load homepage content',
          })
        }
      }
    }

    loadContent()

    return () => {
      isMounted = false
    }
  }, [requestVersion])

  return { ...state, retry: () => setRequestVersion((version) => version + 1) }
}
