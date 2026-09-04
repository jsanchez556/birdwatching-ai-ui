import {
  buildEmailUrl,
  buildPhoneUrl,
  buildWhatsAppUrl,
  getSiteConfig,
  normalizeExternalUrl,
} from '../site'

describe('site configuration', () => {
  test('uses safe brand defaults and omits absent optional values', () => {
    expect(getSiteConfig({})).toEqual({
      companyName: 'RCN',
      location: 'Costa Rica',
      businessHours: '',
      phone: null,
      email: null,
      whatsapp: null,
      socialLinks: [],
    })
  })

  test('normalizes configured public contact and social values', () => {
    expect(getSiteConfig({
      VITE_COMPANY_NAME: ' Rainforest Costa Rica ',
      VITE_COMPANY_LOCATION: ' La Fortuna, Costa Rica ',
      VITE_CONTACT_PHONE: ' +506 2222-3333 ',
      VITE_CONTACT_EMAIL: ' hello@example.test ',
      VITE_WHATSAPP_NUMBER: ' +506 8888-9999 ',
      VITE_BUSINESS_HOURS: ' Daily, 6:00–18:00 ',
      VITE_INSTAGRAM_URL: 'https://instagram.com/example',
    })).toMatchObject({
      companyName: 'Rainforest Costa Rica',
      location: 'La Fortuna, Costa Rica',
      businessHours: 'Daily, 6:00–18:00',
      phone: { display: '+506 2222-3333', href: 'tel:+50622223333' },
      email: { display: 'hello@example.test', href: 'mailto:hello@example.test' },
      whatsapp: { display: '+506 8888-9999', href: 'https://wa.me/50688889999' },
      socialLinks: [{ label: 'Instagram', href: 'https://instagram.com/example' }],
    })
  })

  test('rejects malformed contact values and unsafe external schemes', () => {
    expect(buildWhatsAppUrl('123')).toBe('')
    expect(buildPhoneUrl('call-me-now')).toBe('')
    expect(buildEmailUrl('not-an-email')).toBe('')
    expect(normalizeExternalUrl('javascript:alert(1)')).toBe('')
    expect(getSiteConfig({
      VITE_CONTACT_PHONE: 'call-me-now',
      VITE_CONTACT_EMAIL: 'not-an-email',
      VITE_WHATSAPP_NUMBER: '123',
      VITE_FACEBOOK_URL: 'javascript:alert(1)',
    })).toMatchObject({
      phone: null,
      email: null,
      whatsapp: null,
      socialLinks: [],
    })
  })
})
