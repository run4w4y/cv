import { useLingui } from '@lingui/react'
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

  return (
    <header
      className="screen-only sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md"
      data-cv-header
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <nav
          aria-label={i18n._(cvMessages.labels.primaryNavigation)}
          className="hidden items-center gap-7 font-mono text-xs/4 uppercase text-slate-700 lg:flex dark:text-slate-300"
        >
          {navSections.map((section) => {
            const href = navSectionHref(section)

            return (
              <a
                aria-current={
                  section === firstNavSection ? 'location' : undefined
                }
                className="hover:text-blue-600 data-[active=true]:text-blue-600 dark:hover:text-blue-400 dark:data-[active=true]:text-blue-400"
                data-active={section === firstNavSection ? 'true' : undefined}
                data-cv-nav-section={section}
                href={href}
                key={section}
              >
                {navSectionLabel(content, section)}
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          <div data-cv-header-actions>
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
          </div>
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
