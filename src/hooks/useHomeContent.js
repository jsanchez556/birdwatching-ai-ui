import { useEffect, useState } from 'react'
import {
  loadBirdHighlights,
  loadFeaturedTours,
  loadHeroContent,
  loadTransportationAddOns,
} from '../api/homeApi'

const initialState = {
  hero: null,
  tours: [],
  birds: [],
  transportation: [],
  isLoading: true,
  error: null,
}

export default function useHomeContent() {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadContent() {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: null,
      }))

      try {
        const [hero, tours, birds, transportation] = await Promise.all([
          loadHeroContent().catch(() => null),
          loadFeaturedTours(),
          loadBirdHighlights(),
          loadTransportationAddOns(),
        ])

        if (isMounted) {
          setState({
            hero,
            tours,
            birds,
            transportation,
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
            transportation: [],
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
  }, [])

  return state
}
