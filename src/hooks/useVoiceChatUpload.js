import { useCallback, useEffect, useRef, useState } from 'react'
import { sendVoiceChat } from '../api/voiceChatApi'

export default function useVoiceChatUpload({
  token,
  getAccessToken,
  role,
} = {}) {
  const [isUploading, setIsUploading] = useState(false)
  const controllerRef = useRef(null)

  const cancelUpload = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setIsUploading(false)
  }, [])

  useEffect(() => () => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  const uploadVoiceMessage = useCallback(async ({
    audioBlob,
    conversationId,
    customerContext,
    conversationContext,
    assistantMetadata,
  }) => {
    const abortController = new AbortController()
    controllerRef.current = abortController
    setIsUploading(true)

    try {
      return await sendVoiceChat({
        audioBlob,
        conversationId,
        customerContext,
        conversationContext,
        assistantMetadata,
        role,
        responseMode: 'field_assistant',
        token: getAccessToken ? await getAccessToken() : token,
        signal: abortController.signal,
      })
    } finally {
      if (controllerRef.current === abortController) {
        controllerRef.current = null
        setIsUploading(false)
      }
    }
  }, [getAccessToken, role, token])

  return {
    isUploading,
    uploadVoiceMessage,
    cancelUpload,
  }
}
