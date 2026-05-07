const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function apiUrl(path) {
  return `${apiBaseUrl}${path}`
}

export async function sendChatMessage({ message, conversationId }) {
  const response = await fetch(apiUrl('/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, conversationId }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMessage = data.error?.message || data.error || 'Failed to get response'
    throw new Error(errorMessage)
  }

  if (!data.success || !data.data) {
    throw new Error('Unexpected chat response format')
  }

  const { conversationId: responseConversationId, response: aiResponse } = data.data

  if (typeof aiResponse !== 'string') {
    throw new Error('Unexpected chat response')
  }

  return {
    conversationId: responseConversationId || conversationId,
    response: aiResponse,
  }
}

export async function loadConversationMessages(conversationId) {
  const response = await fetch(apiUrl(`/chat/${encodeURIComponent(conversationId)}`))
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMessage = data.error?.message || data.error || 'Failed to load conversation'
    throw new Error(errorMessage)
  }

  if (!data.success || !data.data) {
    throw new Error('Unexpected conversation response format')
  }

  const { conversationId: responseConversationId, messages } = data.data

  if (!Array.isArray(messages)) {
    throw new Error('Unexpected conversation response')
  }

  return {
    conversationId: responseConversationId || conversationId,
    messages,
  }
}
