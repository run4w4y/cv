'use client'

import { useEffect, useState } from 'react'

type NavigationSection = {
  readonly id: string
  readonly label: string
}

export const WebSectionNavigation = ({
  label,
  sections,
}: {
  readonly label: string
  readonly sections: ReadonlyArray<NavigationSection>
}) => {
  const [activeId, setActiveId] = useState(sections.at(0)?.id)
  const sectionIds = sections.map(({ id }) => id).join('|')

  useEffect(() => {
    const ids = sectionIds.split('|').filter(Boolean)
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              left.boundingClientRect.top - right.boundingClientRect.top
          )
          .at(0)
        if (visible?.target.id) setActiveId(visible.target.id)
      },
      { rootMargin: '-18% 0px -72% 0px' }
    )
    for (const element of elements) observer.observe(element)

    return () => observer.disconnect()
  }, [sectionIds])

  return (
    <nav aria-label={label} className="cv-web-primary-nav">
      {sections.map((section) => (
        <a
          aria-current={section.id === activeId ? 'location' : undefined}
          data-active={section.id === activeId ? 'true' : undefined}
          href={`#${section.id}`}
          key={section.id}
        >
          {section.label}
        </a>
      ))}
    </nav>
  )
}
