import { useSyncExternalStore } from 'react'
import featureFlags from '../featureFlags/featureFlag.service'

export default function useFeatureFlag(flag) {
  return useSyncExternalStore(
    featureFlags.subscribe,
    () => featureFlags.getValue(flag),
    () => featureFlags.getValue(flag),
  )
}
