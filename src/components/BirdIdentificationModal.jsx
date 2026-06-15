import { useEffect, useRef, useState } from 'react'
import useBirdIdentification from '../hooks/useBirdIdentification'
import { useResolvedMedia } from '../hooks/useResolvedMediaUrl'

const IMAGE_URL_PLACEHOLDER = 'https://example.com/bird.jpg'

function formatConfidence(value) {
  const confidence = Number(value)

  if (!Number.isFinite(confidence)) {
    return ''
  }

  return `${Math.round(confidence * 100)}%`
}

function getCandidateName(candidate) {
  return candidate?.commonName || candidate?.species || candidate?.name || candidate?.scientificName || 'Possible bird'
}

function candidateIdentity(candidate) {
  return [
    candidate?.commonName,
    candidate?.species,
    candidate?.name,
    candidate?.scientificName,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim().toLowerCase())
}

function isSameCandidate(candidate, bestMatch) {
  if (!candidate || !bestMatch) {
    return false
  }

  const candidateKeys = candidateIdentity(candidate)
  const bestMatchKeys = new Set(candidateIdentity(bestMatch))

  return candidateKeys.some((key) => bestMatchKeys.has(key))
}

function getCandidateImageUrl(candidate) {
  return [
    candidate?.media?.squarePhotoUrl,
    candidate?.media?.photoUrl,
    candidate?.squarePhotoUrl,
    candidate?.photoUrl,
  ].find((value) => typeof value === 'string' && value.trim())
}

function getCandidateReferenceImageUrl(candidate) {
  return [
    candidate?.media?.photoUrl,
    candidate?.photoUrl,
    candidate?.media?.squarePhotoUrl,
    candidate?.squarePhotoUrl,
  ].find((value) => typeof value === 'string' && value.trim())
}

function formatStatus(status) {
  if (status === 'identified') return 'Identified'
  if (status === 'uncertain') return 'Uncertain'
  if (status === 'unknown') return 'Unknown'
  return ''
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function imageClarity(result) {
  return formatConfidence(result?.imageAnalysis?.confidence ?? result?.imageObservations?.confidence)
}

function CandidateCard({ candidate, index, suppressImage = false }) {
  const name = getCandidateName(candidate)
  const confidence = formatConfidence(candidate?.confidence)
  const visualEvidence = normalizeList(candidate?.visualEvidence)
  const ragSupport = normalizeList(candidate?.ragSupport)
  const contradictions = normalizeList(candidate?.contradictions)
  const missingEvidence = normalizeList(candidate?.missingEvidence)
  const imageReference = suppressImage ? '' : getCandidateImageUrl(candidate)
  const resolvedImage = useResolvedMedia(imageReference)
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = resolvedImage.url

  useEffect(() => {
    setImageFailed(false)
  }, [imageReference, imageUrl])

  return (
    <article className="bird-id-candidate">
      {imageUrl && !imageFailed ? (
        <img
          className="bird-id-candidate-rank bird-id-candidate-image"
          src={imageUrl}
          alt={`${name} reference photo`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="bird-id-candidate-rank" aria-hidden="true">{index + 1}</div>
      )}
      <div className="bird-id-candidate-body">
        <header>
          <div>
            <h3>{name}</h3>
            {candidate?.scientificName && <p>{candidate.scientificName}</p>}
          </div>
          {confidence && <span className="bird-id-confidence">{confidence}</span>}
        </header>
        {candidate?.reasoning && <p>{candidate.reasoning}</p>}
        {candidate?.description && <p>{candidate.description}</p>}
        {candidate?.locations && (
          <p className="bird-id-muted">Costa Rica records: {candidate.locations}</p>
        )}
        {visualEvidence.length > 0 && (
          <EvidenceList label={`${name} visual evidence`} title="Visual evidence" items={visualEvidence} />
        )}
        {ragSupport.length > 0 && (
          <EvidenceList label={`${name} supporting details`} title="Supporting details" items={ragSupport} />
        )}
        {contradictions.length > 0 && (
          <EvidenceList label={`${name} contradictions`} title="Contradictions" items={contradictions} tone="warning" />
        )}
        {missingEvidence.length > 0 && (
          <EvidenceList label={`${name} missing evidence`} title="Missing evidence" items={missingEvidence} tone="muted" />
        )}
      </div>
    </article>
  )
}

function BestMatchCard({ candidate, previewImageUrl, clarity }) {
  const name = getCandidateName(candidate)
  const confidence = formatConfidence(candidate?.confidence)
  const visualEvidence = [
    ...normalizeList(candidate?.visualEvidence),
    ...(clarity ? [`image clarity ${clarity}`] : []),
  ]
  const ragSupport = normalizeList(candidate?.ragSupport)
  const contradictions = normalizeList(candidate?.contradictions)
  const missingEvidence = normalizeList(candidate?.missingEvidence)

  return (
    <article className="bird-id-best-match-card">
      <div className={`bird-id-best-match-comparison ${previewImageUrl ? '' : 'bird-id-best-match-comparison-text-only'}`}>
        <SubmittedImagePreview
          imageUrl={previewImageUrl}
          referenceCandidate={candidate}
        />
        <div className="bird-id-best-match-intro">
          <header>
            <div>
              <h3>{name}</h3>
              {candidate?.scientificName && <p>{candidate.scientificName}</p>}
            </div>
            {confidence && <span className="bird-id-confidence">{confidence}</span>}
          </header>
          {candidate?.reasoning && <p>{candidate.reasoning}</p>}
        </div>
      </div>
      <div className="bird-id-best-match-details">
        {candidate?.description && <p>{candidate.description}</p>}
        {candidate?.locations && (
          <p className="bird-id-muted">Costa Rica records: {candidate.locations}</p>
        )}
        {visualEvidence.length > 0 && (
          <EvidenceList label={`${name} visual evidence`} title="Visual evidence" items={visualEvidence} />
        )}
        {ragSupport.length > 0 && (
          <EvidenceList label={`${name} supporting details`} title="Supporting details" items={ragSupport} />
        )}
        {contradictions.length > 0 && (
          <EvidenceList label={`${name} contradictions`} title="Contradictions" items={contradictions} tone="warning" />
        )}
        {missingEvidence.length > 0 && (
          <EvidenceList label={`${name} missing evidence`} title="Missing evidence" items={missingEvidence} tone="muted" />
        )}
      </div>
    </article>
  )
}

function EvidenceList({ items, label, title, tone = '' }) {
  return (
    <div className={`bird-id-evidence-group ${tone ? `bird-id-evidence-group-${tone}` : ''}`}>
      <p>{title}</p>
      <ul className="bird-id-evidence" aria-label={label}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function StatusBanner({ result }) {
  const statusText = formatStatus(result?.status)

  if (!statusText) {
    return null
  }

  const description = result.status === 'identified'
    ? 'This looks like a likely match based on the visible field marks.'
    : result.status === 'uncertain'
      ? 'The image is not definitive, but these birds are plausible matches.'
      : 'The image does not show enough detail for a reliable identification.'

  return (
    <div className={`bird-id-status bird-id-status-${result.status}`} role="status">
      <span>{statusText}</span>
      <p>{description}</p>
    </div>
  )
}

function ReferenceImageOverlay({ candidate }) {
  const name = getCandidateName(candidate)
  const imageReference = getCandidateReferenceImageUrl(candidate)
  const resolvedImage = useResolvedMedia(imageReference)
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = resolvedImage.url

  useEffect(() => {
    setImageFailed(false)
  }, [imageReference, imageUrl])

  if (!imageUrl || imageFailed) {
    return null
  }

  return (
    <div className="bird-id-preview-reference">
      <img
        src={imageUrl}
        alt={`${name} reference image`}
        onError={() => setImageFailed(true)}
      />
    </div>
  )
}

function SubmittedImagePreview({ imageUrl, referenceCandidate }) {
  if (!imageUrl) {
    return null
  }

  return (
    <figure className="bird-id-preview" aria-label="Submitted image preview">
      <img src={imageUrl} alt="Submitted bird for identification" />
      <ReferenceImageOverlay candidate={referenceCandidate} />
    </figure>
  )
}

function BestMatch({ bestMatch, previewImageUrl, clarity }) {
  if (!bestMatch && !previewImageUrl) {
    return null
  }

  return (
    <section className="bird-id-best-match" aria-label="Best match comparison">
      <h3>Best Match</h3>
      {bestMatch && (
        <BestMatchCard
          candidate={bestMatch}
          previewImageUrl={previewImageUrl}
          clarity={clarity}
        />
      )}
      {!bestMatch && (
        <p className="bird-id-muted">No single best match was reliable enough for this image.</p>
      )}
    </section>
  )
}

function BirdIdentificationModal({ auth, onClose }) {
  const [imageUrl, setImageUrl] = useState('')
  const [file, setFile] = useState(null)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const closeButtonRef = useRef(null)
  const previewObjectUrlRef = useRef('')
  const {
    result,
    error,
    isLoading,
    identify,
    clear,
  } = useBirdIdentification({
    token: auth?.token,
    getAccessToken: auth?.getValidToken,
  })
  const candidates = Array.isArray(result?.candidates) ? result.candidates : []
  const likelyCandidates = candidates.filter((candidate) => !isSameCandidate(candidate, result?.bestMatch))
  const notes = normalizeList(result?.notes)
  const clarity = imageClarity(result)
  const imageInputPlaceholder = file ? `Selected: ${file.name}` : IMAGE_URL_PLACEHOLDER

  const revokePreviewObjectUrl = () => {
    if (previewObjectUrlRef.current && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = ''
    }
  }

  useEffect(() => {
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('has-open-modal')

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('has-open-modal')
      revokePreviewObjectUrl()
    }
  }, [onClose])

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null
    setFile(nextFile)

    if (nextFile) {
      setImageUrl('')
    }
  }

  const handleUrlChange = (event) => {
    setImageUrl(event.target.value)

    if (event.target.value.trim()) {
      setFile(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedUrl = imageUrl.trim()
    let nextPreviewImageUrl = ''

    if (file && typeof URL.createObjectURL === 'function') {
      nextPreviewImageUrl = URL.createObjectURL(file)
    } else if (!file && trimmedUrl) {
      nextPreviewImageUrl = trimmedUrl
    }

    const nextResult = await identify({ imageUrl, file })

    if (nextResult) {
      revokePreviewObjectUrl()

      if (file && nextPreviewImageUrl) {
        previewObjectUrlRef.current = nextPreviewImageUrl
      }

      setPreviewImageUrl(nextPreviewImageUrl)
    } else if (file && nextPreviewImageUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(nextPreviewImageUrl)
    }
  }

  const handleClear = () => {
    setImageUrl('')
    setFile(null)
    setPreviewImageUrl('')
    revokePreviewObjectUrl()
    clear()
  }

  return (
    <div className="bird-id-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="bird-id-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bird-id-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="bird-id-header">
          <div>
            <p className="home-kicker">Bird identification</p>
            <h2 id="bird-id-title">Identify Bird</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="auth-modal-close"
            aria-label="Close bird identification"
            onClick={onClose}
          >
            x
          </button>
        </header>

        <form className="bird-id-form" onSubmit={handleSubmit}>
          <div className="bird-id-input-group">
            <label htmlFor="bird-id-url">Image URL or photo upload</label>
            <input
              id="bird-id-url"
              type="url"
              value={imageUrl}
              placeholder={imageInputPlaceholder}
              onChange={handleUrlChange}
              disabled={isLoading}
            />
          </div>

          <div className="bird-id-file-actions">
            <label className="bird-id-file-control">
              <span>Upload Photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </label>
            <button type="button" className="bird-id-secondary-action" onClick={handleClear} disabled={isLoading}>
              Clear
            </button>
            <button type="submit" className="bird-id-primary-action" disabled={isLoading}>
              {isLoading ? 'Identifying...' : 'Identify'}
            </button>
          </div>

          {error && <div className="bird-id-alert" role="alert">{error}</div>}
        </form>

        {result && (
          <div className="bird-id-results">
            <StatusBanner result={result} />
            <BestMatch bestMatch={result.bestMatch} previewImageUrl={previewImageUrl} clarity={clarity} />

            {likelyCandidates.length > 0 && (
              <section className="bird-id-candidates" aria-label="Candidate birds">
                <h3>Likely Matches</h3>
                <div className="bird-id-candidate-list">
                  {likelyCandidates.map((candidate, index) => (
                    <CandidateCard
                      key={`${getCandidateName(candidate)}-${index}`}
                      candidate={candidate}
                      index={index}
                    />
                  ))}
                </div>
              </section>
            )}

            {notes.length > 0 && (
              <section className="bird-id-notes" aria-label="Identification notes">
                <h3>Notes</h3>
                <ul>
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default BirdIdentificationModal
