import { resolveContentFile } from '@cv/private-content-session'
import { cn } from '@cv/ui/utils'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useCvSession } from '@/lib/cv-document/hooks'

type PrintPageProps = ComponentPropsWithoutRef<'section'> & {
  breakAfter?: 'auto' | 'page'
}

type PrintSectionTitleProps = {
  index: string
  title: string
}

type PrintKeyValueItemProps = {
  children: ReactNode
  label: string
}

export const PrintRoot = ({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) => (
  <div
    className={cn(
      "print-only font-sans text-[8.2pt]/[1.32] text-slate-950 [font-feature-settings:'kern'_1,'liga'_1,'calt'_1] [print-color-adjust:exact] [text-rendering:geometricPrecision] [-webkit-print-color-adjust:exact]",
      className
    )}
    {...props}
  />
)

export const PrintPage = ({
  breakAfter = 'auto',
  className,
  ...props
}: PrintPageProps) => (
  <section
    className={cn(
      breakAfter === 'auto' ? '[break-after:auto]' : 'break-after-page',
      className
    )}
    {...props}
  />
)

export const PrintLink = ({
  className,
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<'a'>) => {
  const session = useCvSession()
  const resolution = resolveContentFile(session, href ?? '')
  const resolvedHref = href
    ? resolution.kind === 'private'
      ? null
      : resolution.href
    : undefined

  if (resolvedHref === null) {
    return (
      <span className={cn('text-inherit no-underline', className)}>
        {children}
      </span>
    )
  }

  return (
    <a
      className={cn('text-inherit no-underline', className)}
      href={resolvedHref}
      {...props}
    >
      {children}
    </a>
  )
}

export const PrintSectionTitle = ({ index, title }: PrintSectionTitleProps) => (
  <div className="mb-[2.8mm] grid grid-cols-[8mm_minmax(0,1fr)] gap-[2mm] border-b-[0.25mm] border-slate-200 pb-[1.7mm] font-mono text-[7.2pt]/[1.25] font-bold text-blue-600 uppercase [break-after:avoid]">
    <span className="text-slate-500">{index}</span>
    <span>{title}</span>
  </div>
)

export const PrintKeyValueItem = ({
  children,
  label,
}: PrintKeyValueItemProps) => (
  <div className="mt-[2.8mm] grid gap-[1mm] first:mt-0">
    <dt className="m-0 font-mono text-[5.9pt]/[1.2] text-slate-500 uppercase">
      {label}
    </dt>
    <dd className="m-0 font-sans text-[7pt]/[1.25] font-normal text-slate-900">
      {children}
    </dd>
  </div>
)
