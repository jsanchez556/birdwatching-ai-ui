export const AUTH_STORAGE_KEY = 'birdwatchingAI.authState'
export const CHAT_STORAGE_KEY = 'birdwatchingAI.chatState'

export function readJsonStorage(key) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStorageItem(key) {
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
