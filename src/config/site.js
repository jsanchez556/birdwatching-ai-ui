const DEFAULT_COMPANY_NAME = 'RCN'
const DEFAULT_COMPANY_LOCATION = 'Costa Rica'

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function buildWhatsAppUrl(value) {
  const digits = trimmed(value).replace(/\D/g, '')
  return /^\d{8,15}$/.test(digits) ? `https://wa.me/${digits}` : ''
}

export function buildPhoneUrl(value) {
  const input = trimmed(value)
  if (!input || /[^\d+().\s-]/.test(input)) return ''

  const digits = input.replace(/\D/g, '')
  if (!/^\d{7,15}$/.test(digits)) return ''

  return `tel:${input.startsWith('+') ? '+' : ''}${digits}`
}

export function buildEmailUrl(value) {
  const email = trimmed(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : ''
}

export function normalizeExternalUrl(value) {
  const input = trimmed(value)
  if (!input) return ''

  try {
    const url = new URL(input)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function browserEnvironment() {
  return {
    VITE_COMPANY_NAME: import.meta.env.VITE_COMPANY_NAME,
    VITE_CONTACT_PHONE: import.meta.env.VITE_CONTACT_PHONE,
    VITE_WHATSAPP_NUMBER: import.meta.env.VITE_WHATSAPP_NUMBER,
    VITE_CONTACT_EMAIL: import.meta.env.VITE_CONTACT_EMAIL,
    VITE_BUSINESS_HOURS: import.meta.env.VITE_BUSINESS_HOURS,
    VITE_COMPANY_LOCATION: import.meta.env.VITE_COMPANY_LOCATION,
    VITE_FACEBOOK_URL: import.meta.env.VITE_FACEBOOK_URL,
    VITE_INSTAGRAM_URL: import.meta.env.VITE_INSTAGRAM_URL,
    VITE_TRIPADVISOR_URL: import.meta.env.VITE_TRIPADVISOR_URL,
    VITE_GOOGLE_REVIEWS_URL: import.meta.env.VITE_GOOGLE_REVIEWS_URL,
    VITE_YOUTUBE_URL: import.meta.env.VITE_YOUTUBE_URL,
  }
}

export function getSiteConfig(environment = browserEnvironment()) {
  const phone = trimmed(environment.VITE_CONTACT_PHONE)
  const email = trimmed(environment.VITE_CONTACT_EMAIL)
  const whatsappNumber = trimmed(environment.VITE_WHATSAPP_NUMBER)
  const phoneUrl = buildPhoneUrl(phone)
  const emailUrl = buildEmailUrl(email)
  const whatsappUrl = buildWhatsAppUrl(whatsappNumber)
  const socialLinks = [
    ['Facebook', environment.VITE_FACEBOOK_URL],
    ['Instagram', environment.VITE_INSTAGRAM_URL],
    ['TripAdvisor', environment.VITE_TRIPADVISOR_URL],
    ['Google Reviews', environment.VITE_GOOGLE_REVIEWS_URL],
    ['YouTube', environment.VITE_YOUTUBE_URL],
  ].flatMap(([label, value]) => {
    const href = normalizeExternalUrl(value)
    return href ? [{ href, label }] : []
  })

  return {
    companyName: trimmed(environment.VITE_COMPANY_NAME) || DEFAULT_COMPANY_NAME,
    location: trimmed(environment.VITE_COMPANY_LOCATION) || DEFAULT_COMPANY_LOCATION,
    businessHours: trimmed(environment.VITE_BUSINESS_HOURS),
    phone: phoneUrl ? { display: phone, href: phoneUrl } : null,
    email: emailUrl ? { display: email, href: emailUrl } : null,
    whatsapp: whatsappUrl ? { display: whatsappNumber, href: whatsappUrl } : null,
    socialLinks,
  }
}
