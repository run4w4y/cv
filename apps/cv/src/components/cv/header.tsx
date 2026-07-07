import { cn } from '@cv/ui/utils'
import { useLingui } from '@lingui/react'
import { useEffect, useState } from 'react'
import { navSectionHref, navSectionLabel } from '@/cv-content/model'
import { cvMessages } from '@/i18n/messages'
import { useCvContent, useCvPage } from '@/lib/cv-document/hooks'
import { ColorSchemeToggle } from './color-scheme-toggle'
import { ExportControls } from './export-controls'

export const Header = () => {
  const content = useCvContent()
  const { locale: lang, localeHrefs } = useCvPage()
  const { i18n } = useLingui()
  const navSections = content.document.nav
  const firstNavSection = navSections.at(0)
  const [activeHref, setActiveHref] = useState(
    firstNavSection ? navSectionHref(firstNavSection) : '#about'
  )
  const [showActions, setShowActions] = useState(false)

  useEffect(() => {
    const sections = navSections
      .map((section) =>
        document.querySelector<HTMLElement>(navSectionHref(section))
      )
      .filter((section): section is HTMLElement => Boolean(section))
    let animationFrame = 0

    const updateActiveSection = () => {
      animationFrame = 0

      if (sections.length === 0) {
        return
      }

      const scrollPosition = window.scrollY + 104
      const isAtPageEnd =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2

      if (isAtPageEnd) {
        const lastSection = sections.at(-1)

        if (lastSection) {
          setActiveHref(`#${lastSection.id}`)
        }

        return
      }

      const currentSection = sections.reduce(
        (current, section) =>
          section.offsetTop <= scrollPosition ? section : current,
        sections[0]
      )

      setActiveHref(`#${currentSection.id}`)
    }

    const scheduleUpdate = () => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(updateActiveSection)
      }
    }

    updateActiveSection()
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
  }, [navSections])

  useEffect(() => {
    const heroActions = document.querySelector('[data-hero-actions]')

    if (!heroActions) {
      const frame = window.requestAnimationFrame(() => setShowActions(true))
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowActions(!entry?.isIntersecting)
      },
      {
        rootMargin: '-76px 0px 0px 0px',
        threshold: 0.01,
      }
    )

    observer.observe(heroActions)

    return () => observer.disconnect()
  }, [])

  return (
    <header className="screen-only sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <nav
          aria-label={i18n._(cvMessages.labels.primaryNavigation)}
          className="hidden items-center gap-7 font-mono text-xs/4 uppercase text-slate-700 lg:flex dark:text-slate-300"
        >
          {navSections.map((section) => {
            const href = navSectionHref(section)

            return (
              <a
                className={cn(
                  'hover:text-blue-600 dark:hover:text-blue-400',
                  activeHref === href && 'text-blue-600 dark:text-blue-400'
                )}
                href={href}
                key={section}
              >
                {navSectionLabel(content, section)}
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          {showActions ? (
            <ExportControls
              className="min-w-0"
              compact
              currentLocale={lang}
              exportLabel={i18n._(cvMessages.actions.exportPdf)}
              githubHref={content.document.links.githubProfile.href}
              githubLabel={content.document.links.githubProfile.label}
              languageLabel={i18n._(cvMessages.labels.language)}
              localeHrefs={localeHrefs}
              noWrap
            />
          ) : null}
          <ColorSchemeToggle
            labels={{
              theme: i18n._(cvMessages.theme.theme),
              themeDark: i18n._(cvMessages.theme.dark),
              themeLight: i18n._(cvMessages.theme.light),
              themeSystem: i18n._(cvMessages.theme.system),
            }}
          />
        </div>
      </div>
    </header>
  )
}
