function Icon({ children }) {
  return (
    <svg className="maintenance-control-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export function SearchIcon() {
  return <Icon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.25 4.25" /></Icon>
}

export function CurrentLocationIcon() {
  return <Icon><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" />
    <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" /></Icon>
}

export function CreateIcon() {
  return <Icon><path d="M12 5v14M5 12h14" /></Icon>
}

export function EditIcon() {
  return <Icon><path d="m4 20 4.25-1 10.6-10.6a2 2 0 0 0-2.83-2.83L5.42 16.17 4 20Z" /><path d="m14.6 7 2.83 2.83" /></Icon>
}

export function ArchiveIcon() {
  return <Icon><path d="M4 8h16v11H4zM3 4h18v4H3z" /><path d="M9 12h6" /></Icon>
}

export function ChevronLeftIcon() {
  return <Icon><path d="m15 18-6-6 6-6" /></Icon>
}

export function ChevronRightIcon() {
  return <Icon><path d="m9 6 6 6-6 6" /></Icon>
}
