import { useCallback, useEffect, useRef, useState } from 'react'
import { loadConversationMessages, loadLatestConversation, streamChatMessage } from '../api/chatApi'
import { sendVoiceChat } from '../api/voiceChatApi'
import { CHAT_STORAGE_KEY, readJsonStorage, writeJsonStorage } from '../utils/storage'

const REQUEST_FAILURE_MESSAGE = 'Sorry, something went wrong. Please try again.'
const MICROPHONE_PERMISSION_MESSAGE = 'Microphone access was blocked. Please allow microphone access and try again.'
const MICROPHONE_UNSUPPORTED_MESSAGE = 'Voice recording is not supported by this browser.'
const EMPTY_RECORDING_MESSAGE = 'I could not hear anything. Please try recording again.'
const STREAM_REVEAL_INTERVAL_MS = 28
const STREAM_REVEAL_CHARS = 3
const CONVERSATION_METADATA_KEYS = [
  'customerContext',
  'conversationSource',
  'conversationType',
  'entrySource',
  'reservationEntry',
  'reservation',
  'conversationId',
  'selectedTour',
  'selectedTourId',
  'selectedTransportation',
  'participants',
]

function createConversationId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getChatStorageKey(userId) {
  return userId ? `${CHAT_STORAGE_KEY}.${userId}` : CHAT_STORAGE_KEY
}

function normalizeAuth(authInput) {
  if (typeof authInput === 'string') {
    return {
      token: authInput,
      getAccessToken: null,
      user: null,
      userId: null,
      role: authInput ? 'customer' : 'visitor',
    }
  }

  const role = authInput?.role || authInput?.user?.role || (authInput?.token ? 'customer' : 'visitor')

  return {
    token: authInput?.token || null,
    getAccessToken: authInput?.getAccessToken || null,
    user: authInput?.user || null,
    userId: authInput?.user?.id ? String(authInput.user.id) : null,
    role,
  }
}

function getStoredChatState(userId) {
  const storedState = readJsonStorage(getChatStorageKey(userId))

  if (storedState && typeof storedState === 'object') {
    const storedUserId = storedState.userId ? String(storedState.userId) : null

    if (userId && storedUserId && storedUserId !== String(userId)) {
      return null
    }

    const storedMeta = storedState.meta || storedState.metadata || {}

    return {
      conversationId: typeof storedState.conversationId === 'string'
        ? storedState.conversationId
        : null,
      userId: storedUserId,
      customerContext: storedMeta.customerContext || storedState.customerContext || null,
      conversationMeta: storedMeta,
      messages: Array.isArray(storedState.messages) ? storedState.messages : undefined,
      hasStoredMessages: Array.isArray(storedState.messages),
    }
  }

  return null
}

function hasMetadata(metadata) {
  return metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0
}

function splitChatMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return {
      conversationMeta: {},
      messageMetadata: {},
    }
  }

  const conversationMeta = {}
  const messageMetadata = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (CONVERSATION_METADATA_KEYS.includes(key)) {
      conversationMeta[key] = value
    } else {
      messageMetadata[key] = value
    }
  }

  return {
    conversationMeta,
    messageMetadata,
  }
}

function createAssistantMessage(response, metadata = {}) {
  return {
    role: 'assistant',
    content: response,
    ...(hasMetadata(metadata)
      ? { metadata }
      : {}),
  }
}

function getRecentAssistantMetadata(messages = [], conversationMeta = {}) {
  const messageMetadata = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.metadata)
    ?.metadata
  const { customerContext, savedAt, ...conversationFlowMeta } = conversationMeta || {}

  return {
    ...(messageMetadata || {}),
    ...conversationFlowMeta,
  }
}

function persistChatState({
  conversationId,
  customerContext,
  conversationMeta,
  messages,
  userId,
  shouldPersist = true,
} = {}) {
  if (!shouldPersist) {
    return
  }

  writeJsonStorage(getChatStorageKey(userId), {
    conversationId,
    messages: Array.isArray(messages) ? messages : [],
    meta: {
      ...(conversationMeta || {}),
      customerContext: customerContext || conversationMeta?.customerContext || null,
      savedAt: new Date().toISOString(),
    },
  })
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'
}

function selectRecorderMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) {
    return ''
  }

  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ].find((type) => window.MediaRecorder.isTypeSupported(type)) || ''
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function audioBufferToWavBlob(audioBuffer) {
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => (
    audioBuffer.getChannelData(index)
  ))
  const channelCount = channels.length || 1
  const sampleRate = audioBuffer.sampleRate
  const bytesPerSample = 2
  const blockAlign = channelCount * bytesPerSample
  const dataSize = audioBuffer.length * blockAlign
  const wavBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(wavBuffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex]?.[sampleIndex] || 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' })
}

async function convertRecordingToWav(recordingBlob) {
  if (!recordingBlob || recordingBlob.size <= 0) {
    throw new Error(EMPTY_RECORDING_MESSAGE)
  }

  if (/audio\/(?:wav|wave|x-wav)/i.test(recordingBlob.type)) {
    return new Blob([await recordingBlob.arrayBuffer()], { type: 'audio/wav' })
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext

  if (!AudioContextClass) {
    throw new Error(MICROPHONE_UNSUPPORTED_MESSAGE)
  }

  const audioContext = new AudioContextClass()

  try {
    const audioBuffer = await audioContext.decodeAudioData(await recordingBlob.arrayBuffer())
    return audioBufferToWavBlob(audioBuffer)
  } finally {
    audioContext.close?.()
  }
}

function getInitialConversationState(auth, options = {}) {
  if (options.isEphemeral) {
    return {
      conversationId: null,
      customerContext: options.initialCustomerContext || null,
      conversationMeta: {
        ...(options.initialConversationMeta || {}),
        ...(options.initialCustomerContext ? { customerContext: options.initialCustomerContext } : {}),
      },
      messages: [],
      shouldLoadFromApi: false,
      shouldLoadLatestFromApi: false,
      isHydrating: false,
    }
  }

  const storedState = getStoredChatState(auth.userId)

  if (storedState?.conversationId) {
    persistChatState({
      ...storedState,
      userId: auth.userId,
    })

    return {
      conversationId: storedState.conversationId,
      customerContext: storedState.customerContext,
      conversationMeta: storedState.conversationMeta || {},
      messages: storedState.messages || [],
      shouldLoadFromApi: !storedState.hasStoredMessages,
      shouldLoadLatestFromApi: false,
      isHydrating: !storedState.hasStoredMessages,
    }
  }

  if (auth.userId && auth.token) {
    return {
      conversationId: null,
      customerContext: storedState?.customerContext || null,
      conversationMeta: storedState?.conversationMeta || {},
      messages: [],
      shouldLoadFromApi: false,
      shouldLoadLatestFromApi: true,
      isHydrating: true,
    }
  }

  const conversationId = createConversationId()
  const customerContext = storedState?.customerContext || null
  const conversationMeta = storedState?.conversationMeta || {}
  persistChatState({
    conversationId,
    customerContext,
    conversationMeta,
    messages: [],
    userId: auth.userId,
  })

  return {
    conversationId,
    customerContext,
    conversationMeta,
    messages: [],
    shouldLoadFromApi: false,
    shouldLoadLatestFromApi: false,
    isHydrating: false,
  }
}

export default function useChat(authInput, options = {}) {
  const auth = normalizeAuth(authInput)
  const shouldPersist = options.isEphemeral !== true
  const { token, getAccessToken, userId, role } = auth
  const [initialConversationState] = useState(() => getInitialConversationState(auth, options))
  const [conversationId, setConversationId] = useState(initialConversationState.conversationId)
  const [messages, setMessages] = useState(initialConversationState.messages)
  const [customerContext, setCustomerContextState] = useState(initialConversationState.customerContext)
  const [conversationMeta, setConversationMeta] = useState(initialConversationState.conversationMeta || {})
  const [isHydrating, setIsHydrating] = useState(initialConversationState.isHydrating)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('idle')
  const [error, setError] = useState(null)
  const activeAbortControllerRef = useRef(null)
  const activeAssistantMessageIdRef = useRef(null)
  const initialEntryIdRef = useRef(null)
  const initialEntryTimerRef = useRef(null)
  const streamBufferRef = useRef('')
  const streamRevealTimerRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const recordingChunksRef = useRef([])

  const appendToAssistantMessage = useCallback((messageId, content) => {
    if (!content) return

    setMessages((prev) => prev.map((item) => (
      item.id === messageId
        ? { ...item, content: `${item.content}${content}` }
        : item
    )))
  }, [])

  const clearRevealTimer = useCallback(() => {
    if (streamRevealTimerRef.current) {
      window.clearTimeout(streamRevealTimerRef.current)
      streamRevealTimerRef.current = null
    }
  }, [])

  const revealBufferedText = useCallback(() => {
    streamRevealTimerRef.current = null

    const messageId = activeAssistantMessageIdRef.current
    if (!messageId || !streamBufferRef.current) {
      return
    }

    const nextText = streamBufferRef.current.slice(0, STREAM_REVEAL_CHARS)
    streamBufferRef.current = streamBufferRef.current.slice(STREAM_REVEAL_CHARS)
    appendToAssistantMessage(messageId, nextText)

    if (streamBufferRef.current) {
      streamRevealTimerRef.current = window.setTimeout(
        revealBufferedText,
        STREAM_REVEAL_INTERVAL_MS
      )
    }
  }, [appendToAssistantMessage])

  const scheduleBufferedReveal = useCallback(() => {
    if (!streamRevealTimerRef.current) {
      streamRevealTimerRef.current = window.setTimeout(
        revealBufferedText,
        STREAM_REVEAL_INTERVAL_MS
      )
    }
  }, [revealBufferedText])

  const enqueueStreamChunk = useCallback((content) => {
    streamBufferRef.current += content
    scheduleBufferedReveal()
  }, [scheduleBufferedReveal])

  const flushBufferedText = useCallback(() => {
    clearRevealTimer()

    const messageId = activeAssistantMessageIdRef.current
    const bufferedText = streamBufferRef.current
    streamBufferRef.current = ''

    if (messageId && bufferedText) {
      appendToAssistantMessage(messageId, bufferedText)
    }
  }, [appendToAssistantMessage, clearRevealTimer])

  const discardBufferedText = useCallback(() => {
    clearRevealTimer()
    streamBufferRef.current = ''
  }, [clearRevealTimer])

  useEffect(() => {
    if (!initialConversationState.shouldLoadFromApi && !initialConversationState.shouldLoadLatestFromApi) {
      return undefined
    }

    let isMounted = true

    async function loadStoredConversation() {
      try {
        const result = initialConversationState.shouldLoadLatestFromApi
          ? await loadLatestConversation({ token: getAccessToken ? await getAccessToken() : token })
          : await loadConversationMessages(initialConversationState.conversationId, {
            token: getAccessToken ? await getAccessToken() : token,
          })

        if (!isMounted) return

        const loadedConversationId = result.conversationId || createConversationId()
        const loadedMessages = result.messages
        const loadedMeta = result.meta || {}
        const loadedCustomerContext = loadedMeta.customerContext || initialConversationState.customerContext

        persistChatState({
          conversationId: loadedConversationId,
          customerContext: loadedCustomerContext,
          conversationMeta: loadedMeta,
          messages: loadedMessages,
          userId,
          shouldPersist,
        })
        setConversationId(loadedConversationId)
        setCustomerContextState(loadedCustomerContext)
        setConversationMeta(loadedMeta)
        setMessages(loadedMessages)
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message)
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false)
        }
      }
    }

    loadStoredConversation()

    return () => {
      isMounted = false
    }
  }, [
    initialConversationState.customerContext,
    initialConversationState.conversationId,
    initialConversationState.shouldLoadFromApi,
    initialConversationState.shouldLoadLatestFromApi,
    token,
    getAccessToken,
    userId,
    shouldPersist,
  ])

  useEffect(() => () => {
    if (initialEntryTimerRef.current) {
      window.clearTimeout(initialEntryTimerRef.current)
      initialEntryTimerRef.current = null
    }
    activeAbortControllerRef.current?.abort()
    mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current.stop()
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop())
    clearRevealTimer()
  }, [clearRevealTimer])

  const stopGenerating = useCallback(() => {
    const messageId = activeAssistantMessageIdRef.current

    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    discardBufferedText()

    if (messageId) {
      setMessages((prev) => prev.map((item) => (
        item.id === messageId
          ? { ...item, isStreaming: false, isStopped: true }
          : item
      )))
    }

    setIsLoading(false)
    setIsStreaming(false)
    activeAssistantMessageIdRef.current = null
  }, [discardBufferedText])

  const setCustomerContext = useCallback((nextCustomerContext) => {
    setCustomerContextState(nextCustomerContext)
    setConversationMeta((prev) => ({
      ...prev,
      customerContext: nextCustomerContext,
    }))
    persistChatState({
      conversationId,
      customerContext: nextCustomerContext,
      conversationMeta: {
        ...conversationMeta,
        customerContext: nextCustomerContext,
      },
      messages,
      userId,
      shouldPersist,
    })
  }, [conversationId, conversationMeta, messages, userId, shouldPersist])

  const sendMessage = async (message, sendOptions = {}) => {
    const recentAssistantMetadata = {
      ...getRecentAssistantMetadata(messages, conversationMeta),
      ...(sendOptions.recentAssistantMetadata || {}),
    }
    const nextConversationContext = {
      recentAssistantMetadata,
      ...(sendOptions.conversationContext || {}),
    }
    const activeConversationId = conversationId || createConversationId()
    const userMessage = { role: 'user', content: message }
    const assistantMessageId = createConversationId()
    const abortController = new AbortController()
    const streamingAssistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }

    activeAbortControllerRef.current = abortController
    activeAssistantMessageIdRef.current = assistantMessageId
    discardBufferedText()
    setMessages((prev) => {
      const nextMessages = [...prev, userMessage, streamingAssistantMessage]
      persistChatState({
        conversationId: activeConversationId,
        customerContext,
        conversationMeta,
        messages: nextMessages,
        userId,
        shouldPersist,
      })
      return nextMessages
    })
    if (!conversationId) {
      setConversationId(activeConversationId)
    }
    setIsLoading(true)
    setIsStreaming(true)
    setError(null)

    try {
      const {
        conversationId: returnedConversationId,
        response,
        metadata,
      } = await streamChatMessage({
        message,
        conversationId: activeConversationId,
        customerContext,
        conversationContext: {
          ...nextConversationContext,
        },
        role,
        token: getAccessToken ? await getAccessToken() : token,
        signal: abortController.signal,
        onStart: ({ conversationId: startedConversationId }) => {
          if (!startedConversationId) return

          persistChatState({
            conversationId: startedConversationId,
            customerContext,
            conversationMeta,
            messages,
            userId,
            shouldPersist,
          })
          setConversationId(startedConversationId)
        },
        onChunk: (content) => {
          enqueueStreamChunk(content)
        },
        onReplace: (content) => {
          discardBufferedText()
          setMessages((prev) => prev.map((item) => (
            item.id === assistantMessageId
              ? { ...item, content }
              : item
          )))
        },
      })
      flushBufferedText()
      setConversationId(returnedConversationId)
      setMessages((prev) => {
        const { conversationMeta: nextConversationMeta, messageMetadata } = splitChatMetadata(metadata)
        const mergedConversationMeta = {
          ...conversationMeta,
          ...nextConversationMeta,
        }
        const assistantMessage = createAssistantMessage(response, messageMetadata)
        const nextMessages = prev.map((item) => (
          item.id === assistantMessageId
            ? assistantMessage
            : item
        ))
        setConversationMeta(mergedConversationMeta)
        persistChatState({
          conversationId: returnedConversationId,
          customerContext,
          conversationMeta: mergedConversationMeta,
          messages: nextMessages,
          userId,
          shouldPersist,
        })
        return nextMessages
      })
    } catch (requestError) {
      if (isAbortError(requestError) || abortController.signal.aborted) {
        discardBufferedText()
        setMessages((prev) => prev.map((item) => (
          item.id === assistantMessageId
            ? { ...item, isStreaming: false, isStopped: true }
            : item
        )))
        return
      }

      setError(requestError.message)
      setMessages((prev) => prev.map((item) => (
        item.id === assistantMessageId
          ? {
              role: 'assistant',
              content: requestError.message || REQUEST_FAILURE_MESSAGE,
              isError: true,
            }
          : item
      )))
    } finally {
      const isCurrentRequest = activeAbortControllerRef.current === abortController

      if (isCurrentRequest) {
        activeAbortControllerRef.current = null
        activeAssistantMessageIdRef.current = null
        setIsLoading(false)
        setIsStreaming(false)
      }
    }
  }

  const sendVoiceMessage = useCallback(async (audioBlob, sendOptions = {}) => {
    const recentAssistantMetadata = {
      ...getRecentAssistantMetadata(messages, conversationMeta),
      ...(sendOptions.recentAssistantMetadata || {}),
    }
    const nextConversationContext = {
      recentAssistantMetadata,
      ...(sendOptions.conversationContext || {}),
    }
    const activeConversationId = conversationId || createConversationId()
    const abortController = new AbortController()

    activeAbortControllerRef.current = abortController
    setIsLoading(true)
    setError(null)
    setVoiceStatus('uploading')

    try {
      const result = await sendVoiceChat({
        audioBlob,
        conversationId: activeConversationId,
        customerContext,
        conversationContext: nextConversationContext,
        role,
        responseMode: 'field_assistant',
        token: getAccessToken ? await getAccessToken() : token,
        signal: abortController.signal,
      })
      const returnedConversationId = result.conversationId || activeConversationId
      const { conversationMeta: nextConversationMeta, messageMetadata } = splitChatMetadata(result.metadata)
      const mergedConversationMeta = {
        ...conversationMeta,
        ...nextConversationMeta,
      }
      const userMessage = {
        role: 'user',
        content: result.transcript,
        transcript: result.transcript,
      }
      const assistantMessage = createAssistantMessage(result.answer, {
        ...messageMetadata,
        ...(result.audioUrl ? { audioUrl: result.audioUrl } : {}),
        ...(result.audioResponseUrl ? { audioResponseUrl: result.audioResponseUrl } : {}),
      })
      const assistantVoiceMessage = {
        ...assistantMessage,
        ...(result.audioUrl ? { audioUrl: result.audioUrl } : {}),
        ...(result.audioResponseUrl ? { audioResponseUrl: result.audioResponseUrl } : {}),
      }

      setConversationId(returnedConversationId)
      setConversationMeta(mergedConversationMeta)
      setMessages((prev) => {
        const nextMessages = [...prev, userMessage, assistantVoiceMessage]
        persistChatState({
          conversationId: returnedConversationId,
          customerContext,
          conversationMeta: mergedConversationMeta,
          messages: nextMessages,
          userId,
          shouldPersist,
        })
        return nextMessages
      })
    } catch (requestError) {
      if (isAbortError(requestError) || abortController.signal.aborted) {
        return
      }

      const message = requestError.message || REQUEST_FAILURE_MESSAGE
      setError(message)
      setMessages((prev) => ([
        ...prev,
        {
          role: 'assistant',
          content: message,
          isError: true,
        },
      ]))
    } finally {
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null
      }
      setVoiceStatus('idle')
      setIsLoading(false)
    }
  }, [
    conversationId,
    conversationMeta,
    customerContext,
    getAccessToken,
    messages,
    role,
    shouldPersist,
    token,
    userId,
  ])

  const startVoiceRecording = useCallback(async () => {
    if (isLoading || isRecording) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(MICROPHONE_UNSUPPORTED_MESSAGE)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = selectRecorderMimeType()
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream)

      recordingChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data)
        }
      }
      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      recorder.start()
      setError(null)
      setIsRecording(true)
      setVoiceStatus('recording')
    } catch (recordingError) {
      const message = recordingError?.name === 'NotAllowedError'
        ? MICROPHONE_PERMISSION_MESSAGE
        : MICROPHONE_UNSUPPORTED_MESSAGE
      setError(message)
      setVoiceStatus('idle')
    }
  }, [isLoading, isRecording])

  const stopVoiceRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current

    if (!recorder || !isRecording) {
      return
    }

    setVoiceStatus('processing')

    try {
      const recordingBlob = await new Promise((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(recordingChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          }))
        }
        recorder.stop()
      })

      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
      setIsRecording(false)

      const wavBlob = await convertRecordingToWav(recordingBlob)
      await sendVoiceMessage(wavBlob)
    } catch (recordingError) {
      const message = recordingError.message || EMPTY_RECORDING_MESSAGE
      setError(message)
      setVoiceStatus('idle')
      setIsRecording(false)
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop())
      mediaStreamRef.current = null
      mediaRecorderRef.current = null
    }
  }, [isRecording, sendVoiceMessage])

  const cancelVoiceRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current

    recordingChunksRef.current = []
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
    setIsRecording(false)
    setVoiceStatus('idle')

    if (!recorder) {
      return
    }

    recorder.ondataavailable = null
    recorder.onstop = null

    if (recorder.state === 'recording') {
      try {
        recorder.stop()
      } catch {
        // The recorder may already be stopping in some browsers.
      }
    }
  }, [])

  useEffect(() => {
    const initialMessage = options.initialMessage
    const entryId = options.initialEntryId

    if (!options.isEphemeral || !initialMessage || !entryId || initialEntryIdRef.current === entryId) {
      return
    }

    initialEntryTimerRef.current = window.setTimeout(() => {
      initialEntryTimerRef.current = null
      initialEntryIdRef.current = entryId
      sendMessage(initialMessage, {
        recentAssistantMetadata: options.initialRecentAssistantMetadata,
        conversationContext: options.initialConversationContext,
      })
    }, 0)

    return () => {
      if (initialEntryTimerRef.current) {
        window.clearTimeout(initialEntryTimerRef.current)
        initialEntryTimerRef.current = null
      }
    }
  }, [
    options.initialConversationContext,
    options.initialEntryId,
    options.initialMessage,
    options.initialRecentAssistantMetadata,
    options.isEphemeral,
  ])

  return {
    conversationId,
    messages,
    isLoading,
    isStreaming,
    isRecording,
    voiceStatus,
    isHydrating,
    error,
    role,
    customerContext,
    conversationMeta,
    setCustomerContext,
    sendMessage,
    sendVoiceMessage,
    startVoiceRecording,
    stopVoiceRecording,
    cancelVoiceRecording,
    stopGenerating,
  }
}
