import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import BirdIdentificationModal from '../BirdIdentificationModal'

const mockIdentify = jest.fn()
const mockClear = jest.fn()
let mockHookState
const createObjectURL = jest.fn()
const revokeObjectURL = jest.fn()

jest.mock('../../hooks/useBirdIdentification', () => ({
  __esModule: true,
  default: jest.fn(() => mockHookState),
}))

describe('BirdIdentificationModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createObjectURL.mockReturnValue('blob:bird-preview')
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    mockHookState = {
      result: null,
      error: null,
      isLoading: false,
      identify: mockIdentify,
      clear: mockClear,
    }
  })

  test('submits an image URL for identification', async () => {
    render(<BirdIdentificationModal auth={{ token: 'token-1' }} onClose={jest.fn()} />)

    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: 'https://example.test/bird.jpg' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^identify$/i }))

    await waitFor(() => {
      expect(mockIdentify).toHaveBeenCalledWith({
        imageUrl: 'https://example.test/bird.jpg',
        file: null,
      })
    })
  })

  test('submits a selected upload file from the single upload control', async () => {
    const file = new File(['image-bytes'], 'bird.jpg', { type: 'image/jpeg' })

    render(<BirdIdentificationModal auth={{ token: 'token-1' }} onClose={jest.fn()} />)

    expect(screen.queryByText(/take photo/i)).not.toBeInTheDocument()

    const uploadInput = screen.getByText(/upload photo/i).closest('label').querySelector('input')
    fireEvent.change(uploadInput, {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: /^identify$/i }))

    await waitFor(() => {
      expect(mockIdentify).toHaveBeenCalledWith({
        imageUrl: '',
        file,
      })
    })
    expect(screen.getByLabelText(/image url or photo upload/i)).toHaveAttribute('placeholder', 'Selected: bird.jpg')
    expect(screen.queryByText(/selected: bird\.jpg/i)).not.toBeInTheDocument()
  })

  test('keeps identify with the upload actions and clears one input when the other is used', () => {
    const file = new File(['image-bytes'], 'bird.jpg', { type: 'image/jpeg' })

    render(<BirdIdentificationModal auth={{ token: 'token-1' }} onClose={jest.fn()} />)

    const form = screen.getByRole('button', { name: /^identify$/i }).closest('form')
    const actions = form.querySelector('.bird-id-file-actions')
    const uploadLabel = screen.getByText(/upload photo/i).closest('label')
    const clearButton = screen.getByRole('button', { name: /^clear$/i })
    const identifyButton = screen.getByRole('button', { name: /^identify$/i })
    const urlInput = screen.getByLabelText(/image url or photo upload/i)
    const uploadInput = uploadLabel.querySelector('input')

    expect(actions).toContainElement(uploadLabel)
    expect(actions).toContainElement(clearButton)
    expect(actions).toContainElement(identifyButton)
    expect(uploadLabel.compareDocumentPosition(identifyButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(clearButton.compareDocumentPosition(identifyButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.change(urlInput, {
      target: { value: 'https://example.test/bird.jpg' },
    })
    expect(urlInput).toHaveValue('https://example.test/bird.jpg')
    expect(urlInput).toHaveAttribute('placeholder', 'https://example.com/bird.jpg')

    fireEvent.change(uploadInput, {
      target: { files: [file] },
    })
    expect(urlInput).toHaveValue('')
    expect(urlInput).toHaveAttribute('placeholder', 'Selected: bird.jpg')
    expect(screen.queryByText(/selected: bird\.jpg/i)).not.toBeInTheDocument()

    fireEvent.change(urlInput, {
      target: { value: 'https://example.test/other-bird.jpg' },
    })
    expect(urlInput).toHaveAttribute('placeholder', 'https://example.com/bird.jpg')
    expect(screen.queryByText(/selected: bird\.jpg/i)).not.toBeInTheDocument()

    fireEvent.click(clearButton)
    expect(urlInput).toHaveValue('')
    expect(urlInput).toHaveAttribute('placeholder', 'https://example.com/bird.jpg')
  })

  function identificationResult() {
    return {
        status: 'uncertain',
        bestMatch: {
          commonName: 'Resplendent Quetzal',
          scientificName: 'Pharomachrus mocinno',
          confidence: 0.64,
          reasoning: 'Some quetzal traits are visible, but the tail is cropped.',
          visualEvidence: ['green upperparts', 'red underparts'],
          ragSupport: ['Field marks support green upperparts and red underparts.'],
          contradictions: ['Long tail coverts are not visible.'],
          missingEvidence: ['tail coverts'],
          media: {
            squarePhotoUrl: 'https://cdn.example.test/photos/quetzal-best-square.jpg',
            photoUrl: 'https://cdn.example.test/photos/quetzal-best.jpg',
          },
        },
        summary: 'The image evidence points most strongly to Resplendent Quetzal.',
        imageAnalysis: {
          dominantColors: ['green', 'red'],
          fieldMarks: ['red underparts'],
          bill: { color: 'yellow', shape: 'short', length: 'short' },
          imageQuality: 'clear but cropped',
          confidence: 0.82,
        },
        imageObservations: {
          colors: ['green', 'red'],
          beak: 'yellow',
          confidence: 0.82,
        },
        candidates: [
          {
            commonName: 'Resplendent Quetzal',
            scientificName: 'Pharomachrus mocinno',
            confidence: 0.91,
            reasoning: 'Green and red plumage fits.',
            visualEvidence: ['green plumage'],
            ragSupport: ['Field notes describe green plumage.'],
            contradictions: [],
            missingEvidence: ['tail coverts not fully visible'],
            media: {
              squarePhotoUrl: 'https://cdn.example.test/photos/quetzal-square.jpg',
              photoUrl: 'https://cdn.example.test/photos/quetzal.jpg',
            },
          },
          {
            commonName: 'Golden-browed Chlorophonia',
            confidence: 0.42,
            reasoning: 'Bright green and yellow tones are plausible but less diagnostic.',
            visualEvidence: ['green plumage'],
            media: {
              squarePhotoUrl: 'https://cdn.example.test/photos/chlorophonia-square.jpg',
            },
          },
          {
            commonName: 'Green Honeycreeper',
            confidence: 0.36,
            reasoning: 'Green plumage is possible, but the red underparts argue against it.',
            visualEvidence: ['green plumage'],
          },
        ],
        notes: ['Identification remains uncertain because the tail is cropped.'],
      }
  }

  test('renders friendly status, submitted URL preview, candidates, and candidate media', async () => {
    const result = identificationResult()
    mockIdentify.mockResolvedValue(result)
    mockHookState = {
      result,
      error: 'Try a clearer image.',
      isLoading: false,
      identify: mockIdentify,
      clear: mockClear,
    }

    render(<BirdIdentificationModal auth={{ token: 'token-1' }} onClose={jest.fn()} />)

    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: 'https://example.test/submitted-bird.jpg' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^identify$/i }))

    await waitFor(() => {
      expect(screen.getByAltText(/submitted bird for identification/i)).toHaveAttribute(
        'src',
        'https://example.test/submitted-bird.jpg'
      )
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Try a clearer image.')
    expect(screen.getAllByText(/uncertain/i).length).toBeGreaterThan(0)
    expect(screen.getByText('The image is not definitive, but these birds are plausible matches.')).toBeInTheDocument()
    expect(screen.queryByText(/backend/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/RAG/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/profile support/i)).not.toBeInTheDocument()
    const bestMatchComparison = screen.getByRole('region', { name: /best match comparison/i })
    const submittedPreview = within(bestMatchComparison).getByRole('figure', { name: /submitted image preview/i })

    expect(within(bestMatchComparison).getByText(/best match/i)).toBeInTheDocument()
    expect(within(submittedPreview).queryByText(/provided image/i)).not.toBeInTheDocument()
    expect(within(submittedPreview).queryByText(/image clarity 82%/i)).not.toBeInTheDocument()
    expect(within(submittedPreview).getByAltText(/submitted bird for identification/i)).toHaveAttribute(
      'src',
      'https://example.test/submitted-bird.jpg'
    )
    expect(within(submittedPreview).getByAltText(/Resplendent Quetzal reference image/i)).toHaveAttribute(
      'src',
      'https://cdn.example.test/photos/quetzal-best.jpg'
    )
    expect(within(submittedPreview).queryByText(/reference image/i)).not.toBeInTheDocument()
    expect(screen.getAllByAltText(/Resplendent Quetzal reference image/i)).toHaveLength(1)
    expect(within(bestMatchComparison).queryByText('1')).not.toBeInTheDocument()
    expect(within(bestMatchComparison).getByText(/64%/i)).toBeInTheDocument()
    expect(within(bestMatchComparison).getByText(/some quetzal traits are visible/i)).toBeInTheDocument()
    expect(within(bestMatchComparison).getByText(/image clarity 82%/i)).toBeInTheDocument()
    expect(within(bestMatchComparison).getAllByText(/green upperparts/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/visible traits/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /visible image observations/i })).not.toBeInTheDocument()
    expect(screen.getAllByText(/Resplendent Quetzal/i).length).toBeGreaterThan(0)
    const likelyMatches = screen.getByRole('region', { name: /candidate birds/i })

    expect(within(likelyMatches).queryByText(/Resplendent Quetzal/i)).not.toBeInTheDocument()
    expect(within(likelyMatches).getByText(/Golden-browed Chlorophonia/i)).toBeInTheDocument()
    expect(within(likelyMatches).getByAltText(/Golden-browed Chlorophonia reference photo/i)).toHaveAttribute(
      'src',
      'https://cdn.example.test/photos/chlorophonia-square.jpg'
    )
    expect(screen.queryByAltText(/Resplendent Quetzal reference photo/i)).not.toBeInTheDocument()
    expect(within(likelyMatches).queryByText(/91%/i)).not.toBeInTheDocument()
    expect(within(likelyMatches).getByText(/42%/i)).toBeInTheDocument()
    expect(within(likelyMatches).getByText(/36%/i)).toBeInTheDocument()
    expect(screen.getAllByText(/supporting details/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/long tail coverts are not visible/i)).toBeInTheDocument()
    expect(screen.getByText(/identification remains uncertain/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/bird matches/i)).not.toBeInTheDocument()
    expect(within(likelyMatches).getByText('2')).toBeInTheDocument()
  })

  test('omits best-match overlay image when best match media is unavailable', async () => {
    const result = identificationResult()
    delete result.bestMatch.media
    mockIdentify.mockResolvedValue(result)
    mockHookState = {
      result,
      error: null,
      isLoading: false,
      identify: mockIdentify,
      clear: mockClear,
    }

    render(<BirdIdentificationModal auth={{ token: 'token-1' }} onClose={jest.fn()} />)

    fireEvent.change(screen.getByLabelText(/image url/i), {
      target: { value: 'https://example.test/submitted-bird.jpg' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^identify$/i }))

    const bestMatchComparison = await screen.findByRole('region', { name: /best match comparison/i })
    const submittedPreview = within(bestMatchComparison).getByRole('figure', { name: /submitted image preview/i })

    expect(within(submittedPreview).queryByAltText(/Resplendent Quetzal reference image/i)).not.toBeInTheDocument()
    expect(within(bestMatchComparison).queryByText('1')).not.toBeInTheDocument()
  })

  test('renders a temporary object URL preview for uploaded files', async () => {
    const result = identificationResult()
    const file = new File(['image-bytes'], 'bird.jpg', { type: 'image/jpeg' })
    mockIdentify.mockResolvedValue(result)
    mockHookState = {
      result,
      error: null,
      isLoading: false,
      identify: mockIdentify,
      clear: mockClear,
    }

    const { unmount } = render(<BirdIdentificationModal auth={{ token: 'token-1' }} onClose={jest.fn()} />)
    const uploadInput = screen.getByText(/upload photo/i).closest('label').querySelector('input')

    fireEvent.change(uploadInput, {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: /^identify$/i }))

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(file)
      expect(screen.getByAltText(/submitted bird for identification/i)).toHaveAttribute('src', 'blob:bird-preview')
    })

    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:bird-preview')
  })
})
