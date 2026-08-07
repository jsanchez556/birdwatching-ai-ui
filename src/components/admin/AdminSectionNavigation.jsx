import { useEffect, useMemo, useState } from 'react'

function AdminSectionNavigation({
  activeSection,
  onSelect,
  sections,
}) {
  const groups = useMemo(() => sections.reduce((result, section) => {
    const group = section.group || 'Administration'
    if (!result.has(group)) result.set(group, [])
    result.get(group).push(section)
    return result
  }, new Map()), [sections])
  const activeGroup = [...groups].find(([, entries]) => entries.some(({ id }) => id === activeSection))?.[0]
  const [expanded, setExpanded] = useState(() => new Set(activeGroup ? [activeGroup] : []))

  useEffect(() => {
    if (!activeGroup) return
    setExpanded((current) => current.has(activeGroup) ? current : new Set([...current, activeGroup]))
  }, [activeGroup, activeSection])

  const toggle = (group) => setExpanded((current) => {
    const next = new Set(current)
    if (next.has(group)) next.delete(group)
    else next.add(group)
    return next
  })
  return (
    <nav className="admin-section-navigation" aria-label="Admin dashboard sections">
      <ul>
        {[...groups].map(([group, entries]) => {
          const groupId = `admin-navigation-${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          const isExpanded = expanded.has(group)
          return <li className="admin-navigation-group" key={group}>
          <button type="button" className="admin-navigation-group-toggle" aria-expanded={isExpanded}
            aria-controls={groupId} onClick={() => toggle(group)}><span>{group}</span><span aria-hidden="true">{isExpanded ? '−' : '+'}</span></button>
          {isExpanded && <ul id={groupId}>{entries.map((section) => (
            <li key={section.id}><button type="button"
              className={`admin-navigation-section ${section.id === activeSection ? 'is-active' : ''}`}
              aria-current={section.id === activeSection ? 'page' : undefined}
              onClick={() => onSelect(section.id)}>{section.label}</button></li>
          ))}</ul>}
        </li>})}
      </ul>
    </nav>
  )
}

export default AdminSectionNavigation
