import {
  buttonVariants,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
} from '@cv/internal-ui'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import type React from 'react'
import { Link, useSearchParams } from 'react-router'

const internalBackPath = (value: string | null): string | null => {
  const containsControlCharacter =
    value?.split('').some((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint < 32 || codePoint === 127
    }) ?? false

  if (
    value === null ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    containsControlCharacter
  ) {
    return null
  }

  return value
}

export const PreparationSupportingContext = ({
  children,
  description = 'Inspect the source context and generation settings without leaving the review decision.',
}: {
  readonly children: React.ReactNode
  readonly description?: string
}) => (
  <Collapsible className="overflow-hidden rounded-md border border-border bg-card">
    <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/50">
      <span>
        <span className="block text-sm font-medium">Supporting context</span>
        <span className="mt-1 block text-sm/6 text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronDown className="size-4 shrink-0" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="grid gap-4 border-t border-border p-4 lg:p-5">
        {children}
      </div>
    </CollapsibleContent>
  </Collapsible>
)

export const PreparationPageFrame = ({
  applicationId,
  backLabel,
  eyebrow,
  title,
  description,
  children,
}: {
  readonly applicationId: string
  readonly backLabel?: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}) => {
  const [searchParams] = useSearchParams()
  const workflowBackPath = internalBackPath(searchParams.get('back'))

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-background p-4 lg:p-6">
      <div className="mx-auto grid max-w-7xl gap-5">
        <div>
          <Link
            to={workflowBackPath ?? `/applications/${applicationId}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            <ArrowLeft />
            {backLabel ??
              (workflowBackPath === null
                ? 'Back to application'
                : 'Back to workflow')}
          </Link>
          <p className="mt-5 text-xs tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm/6 text-muted-foreground">
            {description}
          </p>
        </div>
        {children}
      </div>
    </section>
  )
}
