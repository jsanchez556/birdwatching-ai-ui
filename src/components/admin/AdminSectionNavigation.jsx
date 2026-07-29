function AdminSectionNavigation({
  activeSection,
  onSelect,
  sections,
}) {
  return (
    <nav className="admin-section-navigation" aria-label="Admin dashboard sections">
      <ul>
        {sections.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              className={section.id === activeSection ? 'is-active' : ''}
              aria-current={section.id === activeSection ? 'page' : undefined}
              onClick={() => onSelect(section.id)}
            >
              {section.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default AdminSectionNavigation
