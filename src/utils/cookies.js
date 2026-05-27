const DEFAULT_PATH = '/'
const DEFAULT_SAME_SITE = 'Lax'
const COOKIE_CONSENT_COOKIE = 'birdwatchingAI.cookieConsent'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

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

function hasDocumentCookie() {
  return typeof document !== 'undefined' && typeof document.cookie === 'string'
}

function encodeCookieValue(value) {
  return encodeURIComponent(value)
}

function decodeCookieValue(value) {
  return decodeURIComponent(value)
}

class CookieStore {
  constructor({ path = DEFAULT_PATH, sameSite = DEFAULT_SAME_SITE } = {}) {
    this.path = path
    this.sameSite = sameSite
  }

  get(name) {
    if (!hasDocumentCookie()) {
      return null
    }

    try {
      const prefix = `${name}=`
      const cookie = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(prefix))

      if (!cookie) {
        return null
      }

      return decodeCookieValue(cookie.slice(prefix.length))
    } catch {
      return null
    }
  }

  getJson(name) {
    const value = this.get(name)

    if (!value) {
      return null
    }

    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  set(name, value, options = {}) {
    if (!hasDocumentCookie()) {
      return false
    }

    const attributes = this.getAttributes(options)
    document.cookie = [
      `${name}=${encodeCookieValue(value)}`,
      ...attributes,
    ].join('; ')

    return true
  }

  setJson(name, value, options = {}) {
    return this.set(name, JSON.stringify(value), options)
  }

  remove(name, options = {}) {
    if (!hasDocumentCookie()) {
      return false
    }

    const attributes = this.getAttributes({
      ...options,
      maxAge: 0,
    })
    document.cookie = [
      `${name}=`,
      ...attributes,
    ].join('; ')

    return true
  }

  getAttributes(options = {}) {
    const path = options.path ?? this.path
    const sameSite = options.sameSite ?? this.sameSite
    const attributes = []

    if (path) {
      attributes.push(`path=${path}`)
    }

    if (typeof options.maxAge === 'number') {
      attributes.push(`max-age=${options.maxAge}`)
    }

    if (options.expires instanceof Date) {
      attributes.push(`expires=${options.expires.toUTCString()}`)
    }

    if (sameSite) {
      attributes.push(`SameSite=${sameSite}`)
    }

    if (options.secure) {
      attributes.push('Secure')
    }

    return attributes
  }
}

// Singleton instance for simple use cases
const defaultCookieStore = new CookieStore()

function readCookie(name) {
  return defaultCookieStore.get(name)
}

function readJsonCookie(name) {
  return defaultCookieStore.getJson(name)
}

function writeCookie(name, value, options = {}) {
  return defaultCookieStore.set(name, value, options)
}

function writeJsonCookie(name, value, options = {}) {
  return defaultCookieStore.setJson(name, value, options)
}

function removeCookie(name, options = {}) {
  return defaultCookieStore.remove(name, options)
}

function readConsent() {
  const stored = readJsonCookie(COOKIE_CONSENT_COOKIE)
  return stored || { ...defaultConsent }
}

function writeConsent(next) {
  const payload = {
    ...readConsent(),
    ...next,
    updatedAt: new Date().toISOString(),
  }
  writeJsonCookie(COOKIE_CONSENT_COOKIE, payload, {
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
  return payload
}

function isCategoryAllowed(category) {
  const consent = readConsent()
  if (!consent || !consent.choice) return category === 'essential'
  return Boolean(consent.categories && consent.categories[category])
}

function clearConsent() {
  return removeCookie(COOKIE_CONSENT_COOKIE)
}

export {
  COOKIE_CONSENT_COOKIE,
  CookieStore,
  clearConsent,
  defaultCookieStore,
  isCategoryAllowed,
  readCookie,
  readConsent,
  readJsonCookie,
  removeCookie,
  writeCookie,
  writeConsent,
  writeJsonCookie,
}
