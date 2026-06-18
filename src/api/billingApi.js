import {
  apiUrl,
  authHeaders,
  getApiErrorMessage,
  isObject,
  JSON_HEADERS,
  parseJsonResponse,
  validateEnvelope,
} from './http'

export async function createCheckoutSession({ token, provider, plan } = {}) {
  const response = await fetch(apiUrl('/billing/checkout'), {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      ...authHeaders(token),
    },
    body: JSON.stringify({
      ...(provider ? { provider } : {}),
      ...(plan ? { plan } : {}),
    }),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to start checkout. Please try again.'))
  }

  if (!validateEnvelope(data) || data.success !== true || !isObject(data.data) || typeof data.data.paymentUrl !== 'string') {
    throw new Error('Unexpected checkout response format')
  }

  return {
    provider: typeof data.data.provider === 'string' ? data.data.provider : null,
    plan: typeof data.data.plan === 'string' ? data.data.plan : null,
    paymentUrl: data.data.paymentUrl,
  }
}

export async function createCustomerPortalSession({ token, provider } = {}) {
  const response = await fetch(apiUrl('/billing/portal'), {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      ...authHeaders(token),
    },
    body: JSON.stringify({
      ...(provider ? { provider } : {}),
    }),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to open billing portal. Please try again.'))
  }

  if (!validateEnvelope(data) || data.success !== true || !isObject(data.data) || typeof data.data.managementUrl !== 'string') {
    throw new Error('Unexpected billing portal response format')
  }

  return {
    provider: typeof data.data.provider === 'string' ? data.data.provider : null,
    managementUrl: data.data.managementUrl,
  }
}

export async function getBillingUsage({ token } = {}) {
  const response = await fetch(apiUrl('/billing/usage'), {
    method: 'GET',
    headers: authHeaders(token),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, 'Unable to load billing usage.'))
  }

  if (!validateEnvelope(data) || data.success !== true || !isObject(data.data)) {
    throw new Error('Unexpected billing usage response format')
  }

  return {
    monthlyCost: Number(data.data.monthlyCost || 0),
    monthlyRequests: Number(data.data.monthlyRequests || 0),
  }
}
