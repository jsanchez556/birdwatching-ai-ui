import {
  CookieStore,
  clearConsent,
  isCategoryAllowed,
  readCookie,
  readConsent,
  readJsonCookie,
  removeCookie,
  writeCookie,
  writeConsent,
  writeJsonCookie,
} from '../cookies'

describe('CookieStore', () => {
  const store = new CookieStore()

  beforeEach(() => {
    store.remove('test.cookie')
    store.remove('test.json')
  })

  afterEach(() => {
    store.remove('test.cookie')
    store.remove('test.json')
  })

  test('sets and reads a string cookie', () => {
    store.set('test.cookie', 'plain value', { maxAge: 60 })

    expect(store.get('test.cookie')).toBe('plain value')
  })

  test('sets and reads a JSON cookie', () => {
    store.setJson('test.json', { enabled: true, count: 2 }, { maxAge: 60 })

    expect(store.getJson('test.json')).toEqual({
      enabled: true,
      count: 2,
    })
  })

  test('removes a cookie', () => {
    store.set('test.cookie', 'remove me', { maxAge: 60 })
    store.remove('test.cookie')

    expect(store.get('test.cookie')).toBeNull()
  })

  test('reads and writes cookies through generic helper functions', () => {
    writeCookie('test.cookie', 'helper value', { maxAge: 60 })
    writeJsonCookie('test.json', { helper: true }, { maxAge: 60 })

    expect(readCookie('test.cookie')).toBe('helper value')
    expect(readJsonCookie('test.json')).toEqual({ helper: true })

    removeCookie('test.cookie')
    removeCookie('test.json')

    expect(readCookie('test.cookie')).toBeNull()
    expect(readJsonCookie('test.json')).toBeNull()
  })

  test('reads and writes cookie consent preferences', () => {
    clearConsent()

    expect(readConsent()).toMatchObject({
      choice: null,
      categories: {
        essential: true,
        analytics: false,
      },
    })
    expect(isCategoryAllowed('essential')).toBe(true)
    expect(isCategoryAllowed('analytics')).toBe(false)

    const written = writeConsent({
      choice: 'accepted',
      categories: {
        essential: true,
        analytics: true,
        personalization: true,
        marketing: true,
      },
    })

    expect(written.choice).toBe('accepted')
    expect(written.updatedAt).toEqual(expect.any(String))
    expect(readConsent().categories.analytics).toBe(true)
    expect(isCategoryAllowed('analytics')).toBe(true)

    clearConsent()
  })
})
