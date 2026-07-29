export const EMPTY_RECORDING_MESSAGE = 'I could not hear anything. Please try recording again.'
export const AUDIO_DECODING_UNSUPPORTED_MESSAGE = 'Voice recording is not supported by this browser.'

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

export function encodeAudioBufferAsWav(audioBuffer) {
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

export async function convertRecordingToWav(recordingBlob, {
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  if (!recordingBlob || recordingBlob.size <= 0) {
    throw new Error(EMPTY_RECORDING_MESSAGE)
  }

  if (/audio\/(?:wav|wave|x-wav)/i.test(recordingBlob.type)) {
    return new Blob([await recordingBlob.arrayBuffer()], { type: 'audio/wav' })
  }

  if (!AudioContextClass) {
    throw new Error(AUDIO_DECODING_UNSUPPORTED_MESSAGE)
  }

  const audioContext = new AudioContextClass()

  try {
    const audioBuffer = await audioContext.decodeAudioData(await recordingBlob.arrayBuffer())
    return encodeAudioBufferAsWav(audioBuffer)
  } finally {
    await audioContext.close?.()
  }
}
