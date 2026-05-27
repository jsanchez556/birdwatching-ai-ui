import { readJsonStorage, writeJsonStorage } from './storage'

const COOKIE_STORAGE_KEY = 'birdwatchingAI.cookieConsent'

const defaultConsent = {
  choice: null, // 'accepted' | 'declined' | 'customize'
  categories: {
    essential: true,
    analytics: false,
    personalization: false,
    marketing: false,
  },
  updatedAt: null,
}

export function readConsent() {
  try {
    const stored = readJsonStorage(COOKIE_STORAGE_KEY)
    return stored || { ...defaultConsent }
  } catch {
    return { ...defaultConsent }
  }
}

export function writeConsent(next) {
  const payload = {
    ...readConsent(),
    ...next,
    updatedAt: new Date().toISOString(),
  }
  try {
    writeJsonStorage(COOKIE_STORAGE_KEY, payload)
    return payload
  } catch {
    return payload
  }
}

export function isCategoryAllowed(category) {
  const consent = readConsent()
  if (!consent || !consent.choice) return category === 'essential'
  return Boolean(consent.categories && consent.categories[category])
}

export function clearConsent() {
  try {
    writeJsonStorage(COOKIE_STORAGE_KEY, null)
    return true
  } catch {
    return false
  }
}

export default {
  readConsent,
  writeConsent,
  isCategoryAllowed,
  clearConsent,
}
