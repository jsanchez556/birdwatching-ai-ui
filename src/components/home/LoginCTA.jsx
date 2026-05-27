function LoginCTA({ onLogin }) {
  return (
    <section className="home-split-section login-entry-section" aria-labelledby="login-entry-title">
      <div>
        <p className="home-kicker">Guest continuity</p>
        <h2 id="login-entry-title">Log in to save your itinerary and booking details.</h2>
        <p>
          Use the existing secure login flow to return to your Costa Rica birding
          conversation and keep reservation details connected to your account.
        </p>
      </div>
      <button type="button" className="home-secondary-action" onClick={onLogin}>
        Login
      </button>
    </section>
  )
}

export default LoginCTA
