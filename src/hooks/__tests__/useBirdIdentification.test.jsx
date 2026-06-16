import { act, renderHook } from '@testing-library/react'
import useBirdIdentification, {
  EMPTY_FILE_MESSAGE,
  MAX_IMAGE_UPLOAD_BYTES,
  OVERSIZED_FILE_MESSAGE,
  UNSUPPORTED_IPHONE_IMAGE_MESSAGE,
} from '../useBirdIdentification'
import { getBirdIdentificationJobStatus, identifyBirdByFile, identifyBirdByUrl } from '../../api/birdIdentificationApi'

jest.mock('../../api/birdIdentificationApi', () => ({
  getBirdIdentificationJobStatus: jest.fn(),
  identifyBirdByFile: jest.fn(),
  identifyBirdByUrl: jest.fn(),
}))

describe('useBirdIdentification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('rejects unsupported iPhone HEIC photos before upload', async () => {
    const file = new File(['image-bytes'], 'bird.heic', { type: 'image/heic' })
    const { result } = renderHook(() => useBirdIdentification({ token: 'token-1' }))

    let response
    await act(async () => {
      response = await result.current.identify({ file })
    })

    expect(response).toBeNull()
    expect(result.current.error).toBe(UNSUPPORTED_IPHONE_IMAGE_MESSAGE)
    expect(identifyBirdByFile).not.toHaveBeenCalled()
    expect(identifyBirdByUrl).not.toHaveBeenCalled()
  })

  test('rejects empty files before upload', async () => {
    const file = new File([], 'empty.jpg', { type: 'image/jpeg' })
    const { result } = renderHook(() => useBirdIdentification({ token: 'token-1' }))

    let response
    await act(async () => {
      response = await result.current.identify({ file })
    })

    expect(response).toBeNull()
    expect(result.current.error).toBe(EMPTY_FILE_MESSAGE)
    expect(identifyBirdByFile).not.toHaveBeenCalled()
  })

  test('rejects photos larger than the backend upload limit before upload', async () => {
    const file = new File(['image-bytes'], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', {
      value: MAX_IMAGE_UPLOAD_BYTES + 1,
    })
    const { result } = renderHook(() => useBirdIdentification({ token: 'token-1' }))

    let response
    await act(async () => {
      response = await result.current.identify({ file })
    })

    expect(response).toBeNull()
    expect(result.current.error).toBe(OVERSIZED_FILE_MESSAGE)
    expect(identifyBirdByFile).not.toHaveBeenCalled()
  })

  test('submits supported image files as raw upload requests', async () => {
    const file = new File(['image-bytes'], 'bird.jpg', { type: 'image/jpeg' })
    identifyBirdByFile.mockResolvedValue({ status: 'identified', candidates: [] })
    const { result } = renderHook(() => useBirdIdentification({ token: 'token-1' }))

    await act(async () => {
      await result.current.identify({ file })
    })

    expect(identifyBirdByFile).toHaveBeenCalledWith(expect.objectContaining({
      file,
      token: 'token-1',
    }))
  })

  test('polls queued identification jobs until completion', async () => {
    identifyBirdByUrl.mockResolvedValue({
      jobId: 'job-1',
      jobStatus: 'queued',
    })
    getBirdIdentificationJobStatus.mockResolvedValue({
      jobId: 'job-1',
      jobStatus: 'completed',
      result: {
        status: 'identified',
        candidates: [],
      },
    })
    const { result } = renderHook(() => useBirdIdentification({ token: 'token-1' }))

    let response
    await act(async () => {
      response = await result.current.identify({
        imageUrl: 'https://example.test/bird.jpg',
      })
    })

    expect(response).toEqual({
      status: 'identified',
      candidates: [],
    })
    expect(result.current.result).toEqual({
      status: 'identified',
      candidates: [],
    })
    expect(result.current.job).toEqual({
      jobId: 'job-1',
      status: 'completed',
    })
    expect(getBirdIdentificationJobStatus).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-1',
      token: 'token-1',
    }))
  })

  test('shows safe failures for failed queued jobs', async () => {
    identifyBirdByUrl.mockResolvedValue({
      jobId: 'job-1',
      jobStatus: 'queued',
    })
    getBirdIdentificationJobStatus.mockResolvedValue({
      jobId: 'job-1',
      jobStatus: 'failed',
      error: 'Bird identification failed. Please try again.',
    })
    const { result } = renderHook(() => useBirdIdentification({ token: 'token-1' }))

    let response
    await act(async () => {
      response = await result.current.identify({
        imageUrl: 'https://example.test/bird.jpg',
      })
    })

    expect(response).toBeNull()
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBe('Bird identification failed. Please try again.')
    expect(result.current.job).toEqual({
      jobId: 'job-1',
      status: 'failed',
    })
  })

  test('accepts supported image extensions when browser MIME metadata is missing', async () => {
    const file = new File(['image-bytes'], 'bird.JPG', { type: '' })
    identifyBirdByFile.mockResolvedValue({ status: 'identified', candidates: [] })
    const { result } = renderHook(() => useBirdIdentification({ token: 'token-1' }))

    await act(async () => {
      await result.current.identify({ file })
    })

    expect(identifyBirdByFile).toHaveBeenCalledWith(expect.objectContaining({
      file,
      token: 'token-1',
    }))
  })
})
