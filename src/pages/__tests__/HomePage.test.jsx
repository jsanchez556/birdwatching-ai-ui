import { applyTourImageUpdates } from '../HomePage'

test('applies a successful image update only to its matching tour', () => {
  const immutableImagePath = 'tours/550e8400-e29b-41d4-a716-446655440000.png'
  const firstTour = { id: 1, portraitUrl: '/files/tours/1.png' }
  const updatedTour = { id: 2, portraitUrl: '/files/tours/2.png' }
  const tours = [firstTour, updatedTour]

  const result = applyTourImageUpdates(tours, {
    2: {
      imagePath: immutableImagePath,
      url: `/files/${immutableImagePath}?v=1725379200000`,
      version: '1725379200000',
    },
  })

  expect(result[0]).toBe(firstTour)
  expect(result[1]).toEqual({
    ...updatedTour,
    imagePath: immutableImagePath,
    portraitUrl: `/files/${immutableImagePath}?v=1725379200000`,
    portraitVersion: '1725379200000',
  })
})
