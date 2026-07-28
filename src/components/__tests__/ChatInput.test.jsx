import { act, render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ChatInput from '../ChatInput'

describe('ChatInput', () => {
  test('renders textarea and disabled send button initially', () => {
    render(<ChatInput onSendMessage={jest.fn()} isLoading={false} />)

    expect(screen.getByPlaceholderText(/Ask about birds in Costa Rica/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /start recording voice message/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start recording voice message/i }).querySelector('svg'))
      .toBeInTheDocument()
  })

  test('disables voice controls when voice AI is disabled', () => {
    render(<ChatInput onSendMessage={jest.fn()} isLoading={false} voiceEnabled={false} />)

    expect(screen.getByRole('button', { name: /start recording voice message/i }))
      .toBeDisabled()
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

  test('shows stop button while streaming and calls stop handler', () => {
    const onStopGenerating = jest.fn()
    render(
      <ChatInput
        onSendMessage={jest.fn()}
        onStopGenerating={onStopGenerating}
        isLoading={true}
        isStreaming={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /stop/i }))

    expect(onStopGenerating).toHaveBeenCalledTimes(1)
  })

  test('starts, shows timer, sends, and cancels voice recording controls', () => {
    jest.useFakeTimers()
    const onStartVoiceRecording = jest.fn()
    const onStopVoiceRecording = jest.fn()
    const onCancelVoiceRecording = jest.fn()
    const { rerender } = render(
      <ChatInput
        onSendMessage={jest.fn()}
        onStartVoiceRecording={onStartVoiceRecording}
        onStopVoiceRecording={onStopVoiceRecording}
        onCancelVoiceRecording={onCancelVoiceRecording}
        isLoading={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /start recording voice message/i }))

    expect(onStartVoiceRecording).toHaveBeenCalledTimes(1)

    rerender(
      <ChatInput
        onSendMessage={jest.fn()}
        onStartVoiceRecording={onStartVoiceRecording}
        onStopVoiceRecording={onStopVoiceRecording}
        onCancelVoiceRecording={onCancelVoiceRecording}
        isLoading={false}
        isRecording={true}
        voiceStatus="recording"
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('0:00')
    expect(screen.getByRole('button', { name: /cancel voice recording/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send voice message/i })).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(screen.getByRole('status')).toHaveTextContent('0:03')

    fireEvent.click(screen.getByRole('button', { name: /send voice message/i }))

    expect(onStopVoiceRecording).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /cancel voice recording/i }))

    expect(onCancelVoiceRecording).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
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
