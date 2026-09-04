import { fireEvent, render, screen } from '@testing-library/react'
import HeroSection from '../HeroSection'
import { useResolvedMedia } from '../../../hooks/useResolvedMediaUrl'
import usePrefersReducedMotion from '../../../hooks/usePrefersReducedMotion'

jest.mock('../../../hooks/useResolvedMediaUrl', () => ({
  useResolvedMedia: jest.fn(),
}))

jest.mock('../../../hooks/usePrefersReducedMotion', () => ({
  __esModule: true,
  default: jest.fn(),
}))

const VIDEO_URL = 'https://cdn.example.test/resources/home-hero.mp4'
const POSTER_URL = 'https://cdn.example.test/resources/poster.jpg'

beforeEach(() => {
  jest.clearAllMocks()
  usePrefersReducedMotion.mockReturnValue(false)
  useResolvedMedia.mockImplementation((path) => ({
    url: path === 'resources/home-hero.mp4' ? VIDEO_URL : path === 'resources/poster.jpg' ? POSTER_URL : '',
    isResolving: false,
    error: null,
  }))
})

test('resolves and renders the CloudFront MP4 and poster with background-video attributes', () => {
  render(<HeroSection />)

  const video = document.querySelector('video.home-hero-video')
  const source = video.querySelector('source')
  const poster = document.querySelector('img.home-hero-poster')

  expect(useResolvedMedia).toHaveBeenCalledWith('resources/home-hero.mp4')
  expect(useResolvedMedia).toHaveBeenCalledWith('resources/poster.jpg')
  expect(source).toHaveAttribute('src', VIDEO_URL)
  expect(source).toHaveAttribute('type', 'video/mp4')
  expect(video).toHaveAttribute('poster', POSTER_URL)
  expect(video).toHaveAttribute('preload', 'metadata')
  expect(video.autoplay).toBe(true)
  expect(video.muted).toBe(true)
  expect(video.loop).toBe(true)
  expect(video.playsInline).toBe(true)
  expect(video).toHaveAttribute('aria-hidden', 'true')
  expect(poster).toHaveAttribute('src', POSTER_URL)
  expect(poster).toHaveAttribute('alt', '')
})

test('renders only the poster and does not resolve the video for reduced motion', () => {
  usePrefersReducedMotion.mockReturnValue(true)

  render(<HeroSection />)

  expect(document.querySelector('video.home-hero-video')).not.toBeInTheDocument()
  expect(document.querySelector('img.home-hero-poster')).toHaveAttribute('src', POSTER_URL)
  expect(useResolvedMedia).toHaveBeenCalledWith('')
  expect(useResolvedMedia).not.toHaveBeenCalledWith('resources/home-hero.mp4')
  expect(screen.getByRole('heading', { name: /find your way into the wild/i }).closest('.home-hero-content'))
    .toHaveClass('is-visible')
})

test('keeps hero content and poster available when video resolution fails', () => {
  useResolvedMedia.mockImplementation((path) => ({
    url: path === 'resources/poster.jpg' ? POSTER_URL : '',
    isResolving: false,
    error: path === 'resources/home-hero.mp4' ? new Error('Unavailable') : null,
  }))

  render(<HeroSection />)

  expect(document.querySelector('video.home-hero-video')).not.toBeInTheDocument()
  expect(document.querySelector('img.home-hero-poster')).toHaveAttribute('src', POSTER_URL)
  expect(screen.getByRole('heading', { name: /find your way into the wild/i }).closest('.home-hero-content'))
    .toHaveClass('is-visible')
})

test('falls back to the poster when native video playback reports an error', () => {
  render(<HeroSection />)

  fireEvent.error(document.querySelector('video.home-hero-video'))

  expect(document.querySelector('video.home-hero-video')).not.toBeInTheDocument()
  expect(document.querySelector('img.home-hero-poster')).toHaveAttribute('src', POSTER_URL)
  expect(screen.getByRole('heading', { name: /find your way into the wild/i }).closest('.home-hero-content'))
    .toHaveClass('is-visible')
})

test('preserves the hero actions when media is unavailable', () => {
  const onAuthAction = jest.fn()
  useResolvedMedia.mockReturnValue({ url: '', isResolving: false, error: new Error('Unavailable') })

  render(<HeroSection onAuthAction={onAuthAction} />)

  fireEvent.click(screen.getByRole('button', { name: 'Login' }))
  expect(onAuthAction).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('link', { name: 'Explore Tours' })).toHaveAttribute('href', '#featured-tours')
  expect(screen.getByRole('heading', { name: /find your way into the wild/i })).toBeInTheDocument()
})

test('removes a broken poster without affecting the video or content', () => {
  render(<HeroSection />)

  fireEvent.error(document.querySelector('img.home-hero-poster'))

  expect(document.querySelector('img.home-hero-poster')).not.toBeInTheDocument()
  expect(document.querySelector('video.home-hero-video')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /find your way into the wild/i })).toBeInTheDocument()
})
