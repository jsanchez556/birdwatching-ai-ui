import { useEffect, useState } from 'react'
import { isRelativeMediaPath, resolveMediaUrl } from '../api/mediaApi'

function getInitialState(value) {
  return {
    url: value && !isRelativeMediaPath(value) ? value : '',
    isResolving: Boolean(value && isRelativeMediaPath(value)),
    error: null,
  }
}

export function useResolvedMedia(value) {
  const [state, setState] = useState(() => getInitialState(value))

  useEffect(() => {
    let isActive = true

    if (!value) {
      setState({
        url: '',
        isResolving: false,
        error: null,
      })
      return undefined
    }

    if (!isRelativeMediaPath(value)) {
      setState({
        url: value,
        isResolving: false,
        error: null,
      })
      return undefined
    }

    setState({
      url: '',
      isResolving: true,
      error: null,
    })

    resolveMediaUrl(value)
      .then((url) => {
        if (isActive) {
          setState({
            url,
            isResolving: false,
            error: null,
          })
        }
      })
      .catch((error) => {
        if (isActive) {
          setState({
            url: '',
            isResolving: false,
            error,
          })
        }
      })

    return () => {
      isActive = false
    }
  }, [value])

  return state
}

export default function useResolvedMediaUrl(value) {
  return useResolvedMedia(value).url
}
