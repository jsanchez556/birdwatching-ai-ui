import { useCallback, useEffect, useRef, useState } from 'react'
import { loadConversationMessages, loadLatestConversation, streamChatMessage } from '../api/chatApi'
import {
  createAssistantMessage,
  createConversationId,
  getInitialConversationState,
  getAssistantContinuationMetadata,
  normalizeChatAuth,
  persistChatState,
} from '../utils/chatConversationState'
import useAudioRecorder from './useAudioRecorder'
import useStreamingText from './useStreamingText'
import useVoiceChatUpload from './useVoiceChatUpload'

const REQUEST_FAILURE_MESSAGE = 'Sorry, something went wrong. Please try again.'

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'
}

export default function useChat(authInput, options = {}) {
  const auth = normalizeChatAuth(authInput)
  const shouldPersist = options.isEphemeral !== true
  const { token, getAccessToken, userId, role } = auth
  const [initialConversationState] = useState(() => getInitialConversationState(auth, options))
  const [conversationId, setConversationId] = useState(initialConversationState.conversationId)
  const [messages, setMessages] = useState(initialConversationState.messages)
  const [customerContext, setCustomerContextState] = useState(initialConversationState.customerContext)
  const [conversationContext, setConversationContext] = useState(initialConversationState.conversationContext || {})
  const [isHydrating, setIsHydrating] = useState(initialConversationState.isHydrating)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const activeAbortControllerRef = useRef(null)
  const activeAssistantMessageIdRef = useRef(null)
  const initialEntryIdRef = useRef(null)
  const initialEntryTimerRef = useRef(null)
  const {
    isUploading: isVoiceUploading,
    uploadVoiceMessage,
    cancelUpload,
  } = useVoiceChatUpload({ token, getAccessToken, role })

  const appendToAssistantMessage = useCallback((messageId, content) => {
    if (!content) return

    setMessages((prev) => prev.map((item) => (
      item.id === messageId
        ? { ...item, content: `${item.content}${content}` }
        : item
    )))
  }, [])

  const {
    enqueue: enqueueStreamChunk,
    flush: flushBufferedText,
    discard: discardBufferedText,
  } = useStreamingText({
    activeMessageIdRef: activeAssistantMessageIdRef,
    appendText: appendToAssistantMessage,
  })

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
        const loadedConversationContext = result.conversationContext || {}
        const loadedCustomerContext = result.customerContext || initialConversationState.customerContext

        persistChatState({
          conversationId: loadedConversationId,
          customerContext: loadedCustomerContext,
          conversationContext: loadedConversationContext,
          messages: loadedMessages,
          userId,
          shouldPersist,
        })
        setConversationId(loadedConversationId)
        setCustomerContextState(loadedCustomerContext)
        setConversationContext(loadedConversationContext)
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
    discardBufferedText()
  }, [discardBufferedText])

  const stopGenerating = useCallback(() => {
    const messageId = activeAssistantMessageIdRef.current

    activeAbortControllerRef.current?.abort()
    activeAbortControllerRef.current = null
    cancelUpload()
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
  }, [cancelUpload, discardBufferedText])

  const setCustomerContext = useCallback((nextCustomerContext) => {
    setCustomerContextState(nextCustomerContext)
    persistChatState({
      conversationId,
      customerContext: nextCustomerContext,
      conversationContext,
      messages,
      userId,
      shouldPersist,
    })
  }, [conversationId, conversationContext, messages, userId, shouldPersist])

  const sendMessage = async (message, sendOptions = {}) => {
    const assistantMetadata = {
      ...getAssistantContinuationMetadata(messages, conversationContext),
      ...(sendOptions.assistantMetadata || {}),
    }
    const requestConversationContext = sendOptions.conversationContext || {}
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
        conversationContext,
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
        conversationContext: responseConversationContext,
        messageMetadata,
        customerContext: responseCustomerContext,
      } = await streamChatMessage({
        message,
        conversationId: activeConversationId,
        customerContext,
        conversationContext: requestConversationContext,
        assistantMetadata,
        role,
        token: getAccessToken ? await getAccessToken() : token,
        signal: abortController.signal,
        onStart: ({ conversationId: startedConversationId }) => {
          if (!startedConversationId) return

          persistChatState({
            conversationId: startedConversationId,
            customerContext,
            conversationContext,
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
        const mergedConversationContext = {
          ...conversationContext,
          ...(responseConversationContext || {}),
        }
        const assistantMessage = createAssistantMessage(response, messageMetadata)
        const nextMessages = prev.map((item) => (
          item.id === assistantMessageId
            ? assistantMessage
            : item
        ))
        if (responseCustomerContext) setCustomerContextState(responseCustomerContext)
        setConversationContext(mergedConversationContext)
        persistChatState({
          conversationId: returnedConversationId,
          customerContext: responseCustomerContext || customerContext,
          conversationContext: mergedConversationContext,
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
    const assistantMetadata = {
      ...getAssistantContinuationMetadata(messages, conversationContext),
      ...(sendOptions.assistantMetadata || {}),
    }
    const requestConversationContext = sendOptions.conversationContext || {}
    const activeConversationId = conversationId || createConversationId()
    setIsLoading(true)
    setError(null)

    try {
      const result = await uploadVoiceMessage({
        audioBlob,
        conversationId: activeConversationId,
        customerContext,
        conversationContext: requestConversationContext,
        assistantMetadata,
      })
      const returnedConversationId = result.conversationId || activeConversationId
      const mergedConversationContext = {
        ...conversationContext,
        ...(result.conversationContext || {}),
      }
      const userMessage = {
        role: 'user',
        content: result.transcript,
        transcript: result.transcript,
      }
      const assistantMessage = createAssistantMessage(result.answer, {
        ...(result.messageMetadata || {}),
      })
      const assistantVoiceMessage = {
        ...assistantMessage,
        ...(result.audioUrl ? { audioUrl: result.audioUrl } : {}),
        ...(result.audioResponseUrl ? { audioResponseUrl: result.audioResponseUrl } : {}),
      }

      setConversationId(returnedConversationId)
      if (result.customerContext) setCustomerContextState(result.customerContext)
      setConversationContext(mergedConversationContext)
      setMessages((prev) => {
        const nextMessages = [...prev, userMessage, assistantVoiceMessage]
        persistChatState({
          conversationId: returnedConversationId,
          customerContext: result.customerContext || customerContext,
          conversationContext: mergedConversationContext,
          messages: nextMessages,
          userId,
          shouldPersist,
        })
        return nextMessages
      })
    } catch (requestError) {
      if (isAbortError(requestError)) {
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
      setIsLoading(false)
    }
  }, [
    conversationId,
    conversationContext,
    customerContext,
    messages,
    shouldPersist,
    uploadVoiceMessage,
    userId,
  ])

  const handleRecordingError = useCallback((message) => setError(message), [])
  const {
    isRecording,
    status: recordingStatus,
    start: startVoiceRecording,
    stop: stopVoiceRecording,
    cancel: cancelVoiceRecording,
  } = useAudioRecorder({
    disabled: isLoading,
    onAudioReady: sendVoiceMessage,
    onError: handleRecordingError,
  })
  const voiceStatus = isVoiceUploading ? 'uploading' : recordingStatus

  useEffect(() => {
    const initialMessage = options.initialMessage
    const entryId = options.initialEntryId

    if (!initialMessage || !entryId || initialEntryIdRef.current === entryId) {
      return
    }

    initialEntryTimerRef.current = window.setTimeout(() => {
      initialEntryTimerRef.current = null
      initialEntryIdRef.current = entryId
      sendMessage(initialMessage, {
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
    conversationContext,
    setCustomerContext,
    sendMessage,
    sendVoiceMessage,
    startVoiceRecording,
    stopVoiceRecording,
    cancelVoiceRecording,
    stopGenerating,
  }
}
