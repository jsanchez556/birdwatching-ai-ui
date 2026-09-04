import { fireEvent, render, screen } from '@testing-library/react'
import TransportVehicleImage from '../TransportVehicleImage'
import { useResolvedMedia } from '../../../hooks/useResolvedMediaUrl'

jest.mock('../../../hooks/useResolvedMediaUrl')

describe('TransportVehicleImage', () => {
  test('reserves the vehicle image area while CloudFront media resolves', () => {
    useResolvedMedia.mockReturnValue({ url: null, isResolving: true, error: null })
    render(<TransportVehicleImage imagePath="vehicles/hiace.jpg" name="Toyota Hiace" />)
    expect(screen.getByRole('status', { name: 'Loading Toyota Hiace image' })).toHaveClass('transport-vehicle-image')
  })

  test('renders a resolved vehicle image with meaningful alternative text', () => {
    useResolvedMedia.mockReturnValue({ url: 'https://media.example/vehicles/hiace.jpg', isResolving: false, error: null })
    render(<TransportVehicleImage imagePath="vehicles/hiace.jpg" name="Toyota Hiace" />)
    expect(screen.getByRole('img', { name: 'Toyota Hiace vehicle' })).toHaveAttribute('src', 'https://media.example/vehicles/hiace.jpg')
  })

  test('shows an accessible placeholder when loading the resolved image fails', () => {
    useResolvedMedia.mockReturnValue({ url: 'https://media.example/vehicles/hiace.jpg', isResolving: false, error: null })
    render(<TransportVehicleImage imagePath="vehicles/hiace.jpg" name="Toyota Hiace" />)
    fireEvent.error(screen.getByRole('img', { name: 'Toyota Hiace vehicle' }))
    expect(screen.getByText('Toyota Hiace image unavailable')).toBeInTheDocument()
  })
})
