const labels = ['Enter Ride Details', 'Choose a Vehicle', 'Enter Contact Details', 'Booking Summary']

export default function TransportStepper({ step, onStep }) {
  return <ol className="transport-stepper" aria-label="Booking progress">
    {labels.map((label, index) => {
      const number = index + 1
      const complete = number < step
      return <li key={label} className={number === step ? 'active' : complete ? 'complete' : ''}>
        <button type="button" disabled={number > step} onClick={() => onStep(number)} aria-current={number === step ? 'step' : undefined}>
          <span className="transport-step-number" aria-hidden="true">{complete ? '✓' : number}</span>
          <span className="transport-step-label">{label}</span>
        </button>
      </li>
    })}
  </ol>
}
