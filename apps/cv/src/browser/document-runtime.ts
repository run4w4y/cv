type SectionPosition = {
  readonly id: string
  readonly top: number
}

type ActiveSectionOptions = {
  readonly atPageEnd: boolean
  readonly positions: readonly SectionPosition[]
  readonly scrollPosition: number
}

const noop = () => undefined
let cleanupDocumentControls = noop

export const activeSectionFromPositions = ({
  atPageEnd,
  positions,
  scrollPosition,
}: ActiveSectionOptions) => {
  const first = positions.at(0)

  if (!first) {
    return undefined
  }

  if (atPageEnd) {
    return positions.at(-1)?.id
  }

  return positions.reduce(
    (current, section) => (section.top <= scrollPosition ? section : current),
    first
  ).id
}

const bindScrollSpy = () => {
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>('[data-cv-nav-section]'),
  ]
  const targets = links.flatMap((link) => {
    const id = link.dataset.cvNavSection
    const section = id ? document.getElementById(id) : null

    return id && section ? [{ id, link, section }] : []
  })
  let animationFrame = 0

  const update = () => {
    animationFrame = 0
    const activeId = activeSectionFromPositions({
      atPageEnd:
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2,
      positions: targets.map(({ id, section }) => ({
        id,
        top: section.getBoundingClientRect().top + window.scrollY,
      })),
      scrollPosition: window.scrollY + 104,
    })

    for (const { id, link } of targets) {
      const active = id === activeId
      link.dataset.active = active ? 'true' : 'false'

      if (active) {
        link.setAttribute('aria-current', 'location')
      } else {
        link.removeAttribute('aria-current')
      }
    }
  }

  const scheduleUpdate = () => {
    if (animationFrame === 0) {
      animationFrame = window.requestAnimationFrame(update)
    }
  }

  update()
  window.addEventListener('scroll', scheduleUpdate, { passive: true })
  window.addEventListener('resize', scheduleUpdate)
  window.addEventListener('hashchange', scheduleUpdate)

  return () => {
    if (animationFrame !== 0) {
      window.cancelAnimationFrame(animationFrame)
    }

    window.removeEventListener('scroll', scheduleUpdate)
    window.removeEventListener('resize', scheduleUpdate)
    window.removeEventListener('hashchange', scheduleUpdate)
  }
}

const setHeaderActionsVisible = (visible: boolean) => {
  document.documentElement.dataset.cvHeaderActionsVisible = String(visible)
}

const bindStickyHeaderActions = () => {
  const heroActions = document.querySelector<HTMLElement>('[data-hero-actions]')

  if (!heroActions) {
    setHeaderActionsVisible(true)
    return noop
  }

  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderActionsVisible(!entry?.isIntersecting),
      {
        rootMargin: '-76px 0px 0px 0px',
        threshold: 0.01,
      }
    )

    observer.observe(heroActions)
    return () => observer.disconnect()
  }

  const update = () => {
    setHeaderActionsVisible(heroActions.getBoundingClientRect().bottom <= 76)
  }

  update()
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)

  return () => {
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
  }
}

export const bindCvDocumentControls = () => {
  cleanupDocumentControls()
  const cleanupScrollSpy = bindScrollSpy()
  const cleanupStickyActions = bindStickyHeaderActions()

  cleanupDocumentControls = () => {
    cleanupScrollSpy()
    cleanupStickyActions()
    delete document.documentElement.dataset.cvHeaderActionsVisible
    cleanupDocumentControls = noop
  }

  return cleanupDocumentControls
}
