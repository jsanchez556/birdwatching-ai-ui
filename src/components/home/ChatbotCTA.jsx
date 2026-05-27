function ChatbotCTA({ onStartChat }) {
  return (
    <section className="home-split-section" aria-labelledby="chatbot-entry-title">
      <div>
        <p className="home-kicker">Trip planning assistant</p>
        <h2 id="chatbot-entry-title">Ask about birds, routes, timing, tours, and reservations.</h2>
        <p>
          Open the existing Birdwatching AI chat to continue planning with the same
          guided controls, conversation memory, and reservation flow already in the app.
        </p>
      </div>
      <button type="button" className="home-primary-action" onClick={onStartChat}>
        Start Birdwatching Chat
      </button>
    </section>
  )
}

export default ChatbotCTA
