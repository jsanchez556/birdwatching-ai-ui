import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatInput from '../ChatInput'

describe('ChatInput', () => {
  test('renders textarea and disabled send button initially', () => {
    render(<ChatInput onSendMessage={jest.fn()} isLoading={false} />)

    expect(screen.getByPlaceholderText(/Ask about birds in Costa Rica/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
  })

  test('enables send button when user types a message', () => {
    render(<ChatInput onSendMessage={jest.fn()} isLoading={false} />)

    const textarea = screen.getByPlaceholderText(/Ask about birds in Costa Rica/i)
    fireEvent.change(textarea, { target: { value: 'Where can I spot quetzals?' } })

    expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled()
  })

  test('calls onSendMessage and clears input after submit', () => {
    const onSendMessage = jest.fn()
    render(<ChatInput onSendMessage={onSendMessage} isLoading={false} />)

    const textarea = screen.getByPlaceholderText(/Ask about birds in Costa Rica/i)
    fireEvent.change(textarea, { target: { value: 'Tell me about hummingbirds.' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    expect(onSendMessage).toHaveBeenCalledWith('Tell me about hummingbirds.')
    expect(textarea).toHaveValue('')
  })

  test('does not submit when loading', () => {
    const onSendMessage = jest.fn()
    render(<ChatInput onSendMessage={onSendMessage} isLoading={true} />)

    const textarea = screen.getByPlaceholderText(/Ask about birds in Costa Rica/i)
    fireEvent.change(textarea, { target: { value: 'Is the rainforest open today?' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    expect(onSendMessage).not.toHaveBeenCalled()
  })

  test('submits on Enter key press without shift', () => {
    const onSendMessage = jest.fn()
    render(<ChatInput onSendMessage={onSendMessage} isLoading={false} />)

    const textarea = screen.getByPlaceholderText(/Ask about birds in Costa Rica/i)
    fireEvent.change(textarea, { target: { value: 'What birds are common in March?' } })
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: false })

    expect(onSendMessage).toHaveBeenCalledWith('What birds are common in March?')
  })
})