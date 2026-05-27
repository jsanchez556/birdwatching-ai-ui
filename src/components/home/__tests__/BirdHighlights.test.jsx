import { fireEvent, render, screen, within } from '@testing-library/react'
import BirdHighlights from '../BirdHighlights'

const birds = [
  {
    speciesCode: 'quetz1',
    commonName: 'Resplendent Quetzal',
    scientificName: 'Pharomachrus mocinno',
    family: 'Trogons',
    description: 'A cloud forest icon with emerald plumage.',
    locations: 'Monteverde',
    media: {
      photoUrl: 'https://example.test/quetzal.jpg',
      photoAttribution: 'Photo: Example Birder',
    },
  },
]

test('opens headline bird details in a modal and closes it', async () => {
  render(<BirdHighlights birds={birds} isLoading={false} error={null} />)

  expect(screen.getByRole('button', { name: /open resplendent quetzal details/i })).toBeInTheDocument()
  const birdSummary = screen.getByLabelText('Bird summary')
  expect(within(birdSummary).getByText('Resplendent Quetzal')).toBeInTheDocument()
  expect(within(birdSummary).getByText('Pharomachrus mocinno')).toBeInTheDocument()
  expect(within(birdSummary).getByText('Trogons')).toBeInTheDocument()
  expect(within(birdSummary).queryByText('Photo: Example Birder')).not.toBeInTheDocument()
  expect(screen.getByText('Photo: Example Birder')).toBeInTheDocument()
  expect(screen.getByAltText('Resplendent Quetzal photo')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /open resplendent quetzal details/i }))

  const dialog = await screen.findByRole('dialog', { name: /resplendent quetzal details/i })
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByText('Pharomachrus mocinno')).toBeInTheDocument()
  expect(within(dialog).getByText('A cloud forest icon with emerald plumage.')).toBeInTheDocument()
  expect(within(dialog).getAllByText('Trogons').length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: /close bird details/i }))

  expect(screen.queryByRole('dialog', { name: /resplendent quetzal details/i })).not.toBeInTheDocument()
})

test('shows only four random headline birds', () => {
  const manyBirds = Array.from({ length: 6 }, (_, index) => ({
    speciesCode: `bird${index}`,
    commonName: `Headline Bird ${index + 1}`,
    description: `Bird ${index + 1} description.`,
    media: {
      photoUrl: `https://example.test/bird-${index + 1}.jpg`,
    },
  }))

  render(<BirdHighlights birds={manyBirds} isLoading={false} error={null} />)

  expect(screen.getAllByRole('button', { name: /open headline bird/i })).toHaveLength(4)
})
