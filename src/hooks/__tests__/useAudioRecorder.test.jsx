import { act, renderHook } from '@testing-library/react'
import useAudioRecorder from '../useAudioRecorder'

describe('useAudioRecorder', () => {
  const originalMediaRecorder = window.MediaRecorder
  const originalMediaDevices = navigator.mediaDevices

  afterEach(() => {
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: originalMediaRecorder,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    })
  })

  test('owns capture lifecycle and releases microphone tracks on cancellation', async () => {
    const stopTrack = jest.fn()
    let recorder

    class MockMediaRecorder {
      constructor() {
        recorder = this
        this.state = 'inactive'
        this.mimeType = 'audio/webm'
      }

      start() {
        this.state = 'recording'
      }

      stop() {
        this.state = 'inactive'
        this.onstop?.()
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: MockMediaRecorder,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })
    const onAudioReady = jest.fn()
    const { result } = renderHook(() => useAudioRecorder({ onAudioReady }))

    await act(async () => result.current.start())
    expect(result.current).toMatchObject({ isRecording: true, status: 'recording' })

    act(() => result.current.cancel())
    expect(result.current).toMatchObject({ isRecording: false, status: 'idle' })
    expect(recorder.state).toBe('inactive')
    expect(stopTrack).toHaveBeenCalledTimes(1)
    expect(onAudioReady).not.toHaveBeenCalled()
  })
})
