import {
  EMPTY_RECORDING_MESSAGE,
  convertRecordingToWav,
  encodeAudioBufferAsWav,
} from '../audioEncoding'

function readBlob(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => resolve(reader.result)
    reader.readAsArrayBuffer(blob)
  })
}

function ascii(view, offset, length) {
  return Array.from({ length }, (_, index) => (
    String.fromCharCode(view.getUint8(offset + index))
  )).join('')
}

describe('audio encoding', () => {
  test('encodes interleaved 16-bit PCM with a valid WAV header without React or recording APIs', async () => {
    const wav = encodeAudioBufferAsWav({
      numberOfChannels: 2,
      sampleRate: 8000,
      length: 2,
      getChannelData: (channel) => (
        channel === 0 ? new Float32Array([-1, 0.5]) : new Float32Array([1, -0.5])
      ),
    })
    const view = new DataView(await readBlob(wav))

    expect(wav.type).toBe('audio/wav')
    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(24, true)).toBe(8000)
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getInt16(44, true)).toBe(-32768)
    expect(view.getInt16(46, true)).toBe(32767)
  })

  test('rejects empty recordings before attempting audio decoding', async () => {
    await expect(convertRecordingToWav(
      new Blob([], { type: 'audio/webm' }),
      { AudioContextClass: jest.fn() }
    )).rejects.toThrow(EMPTY_RECORDING_MESSAGE)
  })

  test('uses an injected decoder and closes it after conversion', async () => {
    const close = jest.fn()
    const decodeAudioData = jest.fn().mockResolvedValue({
      numberOfChannels: 1,
      sampleRate: 16000,
      length: 1,
      getChannelData: () => new Float32Array([0.25]),
    })
    const AudioContextClass = jest.fn(() => ({ close, decodeAudioData }))
    const recording = {
      size: 7,
      type: 'audio/webm',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(7)),
    }

    const wav = await convertRecordingToWav(recording, { AudioContextClass })

    expect(wav.type).toBe('audio/wav')
    expect(decodeAudioData).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
