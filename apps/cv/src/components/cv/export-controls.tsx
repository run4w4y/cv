import { Button, buttonVariants } from '@cv/ui/button'
import { cn } from '@cv/ui/utils'
import { Download } from 'lucide-react'
import type { ReactNode } from 'react'
import { useCvSession } from '@/lib/cv-document/hooks'
import type { Locale } from '@/lib/i18n'
import { localeNames, localePath, locales } from '@/lib/i18n'
import { TechIcon } from './tech-icon'

type ExportControlsProps = {
  children?: ReactNode
  className?: string
  compact?: boolean
  currentLocale: Locale
  exportLabel: string
  githubHref: string
  githubLabel: string
  heroSentinel?: boolean
  localeHrefs?: Partial<Record<Locale, string>>
  noWrap?: boolean
  languageLabel: string
}

const hrefWithToken = (href: string, token: string | null | undefined) => {
  if (!token) {
    return href
  }

  const url = new URL(href, window.location.href)
  url.searchParams.set('p', token)
  return `${url.pathname}${url.search}${url.hash}`
}

export const ExportControls = ({
  children,
  className,
  compact,
  currentLocale,
  exportLabel,
  githubHref,
  githubLabel,
  heroSentinel,
  languageLabel,
  localeHrefs,
  noWrap,
}: ExportControlsProps) => {
  const { route } = useCvSession()
  const token = route?.token

  return (
    <div
      className={cn(
        'screen-only flex items-center gap-3',
        noWrap ? 'flex-nowrap' : 'flex-wrap',
        className
      )}
      data-hero-actions={heroSentinel ? true : undefined}
    >
      <nav
        aria-label={languageLabel}
        className="flex items-center gap-0 font-mono text-xs/4"
      >
        {locales.map((locale) => (
          <a
            aria-current={currentLocale === locale ? 'page' : undefined}
            className={cn(
              buttonVariants({
                size: 'toolbar-tab',
                variant:
                  currentLocale === locale ? 'toolbar-active' : 'toolbar',
              }),
              '-ml-px first:ml-0 font-mono uppercase'
            )}
            data-cv-locale-link={locale}
            href={hrefWithToken(
              localeHrefs?.[locale] ?? localePath(locale),
              token
            )}
            key={locale}
          >
            {localeNames[locale]}
          </a>
        ))}
      </nav>

      <Button
        aria-label={exportLabel}
        className={cn('font-mono uppercase', compact && 'max-[459px]:px-3')}
        data-print-button
        size="toolbar"
        type="button"
        variant="toolbar-primary"
      >
        <span className={cn(compact && 'hidden min-[460px]:inline')}>
          {exportLabel}
        </span>
        <Download aria-hidden="true" data-icon="inline-end" strokeWidth={1.8} />
      </Button>

      <a
        aria-label={githubLabel}
        className={cn(
          buttonVariants({ size: 'toolbar', variant: 'toolbar' }),
          'font-mono uppercase',
          compact && 'max-[459px]:px-3'
        )}
        href={githubHref}
        rel="noreferrer"
        target="_blank"
      >
        <span className={cn(compact && 'hidden min-[460px]:inline')}>
          {githubLabel}
        </span>
        <TechIcon iconSlot="inline-end" name="GitHub" />
      </a>

      {children}
    </div>
  )
}
