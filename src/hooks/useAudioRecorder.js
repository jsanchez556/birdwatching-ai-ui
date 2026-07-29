import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AUDIO_DECODING_UNSUPPORTED_MESSAGE,
  EMPTY_RECORDING_MESSAGE,
  convertRecordingToWav,
} from '../utils/audioEncoding'

export const MICROPHONE_PERMISSION_MESSAGE = 'Microphone access was blocked. Please allow microphone access and try again.'
export const MICROPHONE_UNSUPPORTED_MESSAGE = AUDIO_DECODING_UNSUPPORTED_MESSAGE

function selectRecorderMimeType(MediaRecorderClass) {
  if (!MediaRecorderClass?.isTypeSupported) {
    return ''
  }

  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ].find((type) => MediaRecorderClass.isTypeSupported(type)) || ''
}

export default function useAudioRecorder({
  disabled = false,
  onAudioReady,
  onError,
} = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState('idle')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current

    chunksRef.current = []
    releaseStream()
    recorderRef.current = null
    setIsRecording(false)
    setStatus('idle')

    if (!recorder) return

    recorder.ondataavailable = null
    recorder.onstop = null

    if (recorder.state === 'recording') {
      try {
        recorder.stop()
      } catch {
        // Some browsers report recording briefly while already stopping.
      }
    }
  }, [releaseStream])

  useEffect(() => () => {
    const recorder = recorderRef.current
    recorderRef.current = null
    chunksRef.current = []
    releaseStream()

    if (recorder?.state === 'recording') {
      recorder.ondataavailable = null
      recorder.onstop = null
      try {
        recorder.stop()
      } catch {
        // The recorder may already be stopping during unmount.
      }
    }
  }, [releaseStream])

  const start = useCallback(async () => {
    if (disabled || isRecording) return

    const MediaRecorderClass = globalThis.MediaRecorder
    if (!navigator.mediaDevices?.getUserMedia || !MediaRecorderClass) {
      onError?.(MICROPHONE_UNSUPPORTED_MESSAGE)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = selectRecorderMimeType(MediaRecorderClass)
      const recorder = mimeType
        ? new MediaRecorderClass(stream, { mimeType })
        : new MediaRecorderClass(stream)

      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data)
      }
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.start()
      onError?.(null)
      setIsRecording(true)
      setStatus('recording')
    } catch (error) {
      onError?.(error?.name === 'NotAllowedError'
        ? MICROPHONE_PERMISSION_MESSAGE
        : MICROPHONE_UNSUPPORTED_MESSAGE)
      setStatus('idle')
    }
  }, [disabled, isRecording, onError])

  const stop = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder || !isRecording) return

    setStatus('processing')

    try {
      const recordingBlob = await new Promise((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          }))
        }
        recorder.stop()
      })

      releaseStream()
      recorderRef.current = null
      setIsRecording(false)
      const wavBlob = await convertRecordingToWav(recordingBlob)
      await onAudioReady?.(wavBlob)
      setStatus('idle')
    } catch (error) {
      onError?.(error.message || EMPTY_RECORDING_MESSAGE)
      releaseStream()
      recorderRef.current = null
      setIsRecording(false)
      setStatus('idle')
    }
  }, [isRecording, onAudioReady, onError, releaseStream])

  return {
    isRecording,
    status,
    start,
    stop,
    cancel,
  }
}
