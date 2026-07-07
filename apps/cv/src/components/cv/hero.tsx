import { useLingui } from '@lingui/react'
import { ArrowDown, CalendarDays } from 'lucide-react'
import { PublicVersionNotice } from '@/components/private-cv/public-version-notice'
import { RedactedInlineText } from '@/components/private-cv/redactions'
import {
  navSectionHref,
  navSectionLabel,
  type RedactableText,
} from '@/cv-content/model'
import { cvMessages } from '@/i18n/messages'
import { useCvContent, useCvPage } from '@/lib/cv-document/hooks'
import { ExportControls } from './export-controls'

type HeroRailTitleProps = {
  children: string
}

type HeroIdentityRowProps = {
  accent?: boolean
  label: string
  value: RedactableText
}

const HeroRailTitle = ({ children }: HeroRailTitleProps) => (
  <div className="border-b border-border bg-card/50 px-5 py-4 font-mono text-xs/5 uppercase text-blue-600 dark:text-blue-400">
    <span className="text-blue-600/70 dark:text-blue-400/70">{'/* '}</span>
    {children}
    <span className="text-blue-600/70 dark:text-blue-400/70">{' */'}</span>
  </div>
)

const HeroIdentityRow = ({ accent, label, value }: HeroIdentityRowProps) => (
  <div className="grid gap-2 border-b border-border py-5 last:border-b-0 sm:grid-cols-[8rem_1fr]">
    <p className="font-mono text-xs/5 uppercase text-muted-foreground">
      {label}
    </p>
    <p
      className={
        accent
          ? 'font-mono text-sm/6 text-blue-600 dark:text-blue-400'
          : 'font-mono text-sm/6 text-foreground'
      }
    >
      <RedactedInlineText value={value} />
    </p>
  </div>
)

export const Hero = () => {
  const content = useCvContent()
  const { locale: lang, localeHrefs } = useCvPage()
  const { i18n } = useLingui()
  const navSections = content.document.nav

  return (
    <section className="mx-auto max-w-7xl border-x border-border" id="top">
      <div className="grid md:min-h-[34rem] md:grid-cols-[minmax(0,1fr)_21rem] lg:min-h-[36rem] lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="px-5 py-8 sm:px-8 md:py-9 lg:px-10 lg:py-10">
          <div className="font-mono text-xs/5 text-blue-600 dark:text-blue-400">
            {`// ${i18n._(cvMessages.labels.cvVersion)}`}
          </div>
          <div className="mt-2 flex items-center gap-2 font-mono text-xs/5 text-muted-foreground">
            <CalendarDays
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.6}
            />
            {i18n._(cvMessages.labels.lastUpdated)}:{' '}
            {content.identity.lastUpdated}
          </div>

          <div className="mt-8">
            <p className="font-mono text-xs/5 uppercase text-muted-foreground">
              {i18n._(cvMessages.labels.githubHandle)}
            </p>
            <h1 className="mt-3 max-w-3xl font-mono text-6xl/[0.92] tracking-normal text-blue-600 sm:text-8xl/[0.9] lg:text-[6rem]/[0.86] xl:text-[6.5rem]/[0.86] dark:text-blue-400">
              {content.identity.headline}
            </h1>
          </div>

          <div className="mt-7 border-y border-border">
            <HeroIdentityRow
              label={i18n._(cvMessages.labels.name)}
              value={content.identity.name}
            />
            <HeroIdentityRow
              accent
              label={i18n._(cvMessages.labels.focus)}
              value={`> ${content.identity.role}`}
            />
          </div>

          <p className="mt-5 max-w-3xl text-sm/6 text-slate-700 dark:text-slate-300">
            {content.identity.summary}
          </p>

          <div className="mt-6">
            <ExportControls
              currentLocale={lang}
              exportLabel={i18n._(cvMessages.actions.exportPdf)}
              githubHref={content.document.links.githubProfile.href}
              githubLabel={content.document.links.githubProfile.label}
              heroSentinel
              languageLabel={i18n._(cvMessages.labels.language)}
              localeHrefs={localeHrefs}
            />
          </div>

          <div className="mt-8">
            <PublicVersionNotice />
          </div>

          <a
            className="screen-only mt-7 inline-flex items-center gap-2 font-mono text-xs/5 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400"
            href="#about"
          >
            {i18n._(cvMessages.actions.scroll)}
            <ArrowDown
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.6}
            />
          </a>
        </div>

        <aside className="border-t border-border bg-card/35 md:border-t-0 md:border-l">
          <HeroRailTitle>{i18n._(cvMessages.labels.index)}</HeroRailTitle>
          <nav aria-label={i18n._(cvMessages.labels.cvSections)}>
            <ul>
              {navSections.map((section, index) => (
                <li className="border-b border-border" key={section}>
                  <a
                    className="grid grid-cols-[2.5rem_1fr] px-5 py-3 font-mono text-xs/5 uppercase text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                    href={navSectionHref(section)}
                  >
                    <span className="text-muted-foreground">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>{navSectionLabel(content, section)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </section>
  )
}
