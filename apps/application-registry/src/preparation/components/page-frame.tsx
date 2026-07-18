import { buttonVariants, cn } from '@cv/internal-ui'
import { ArrowLeft } from 'lucide-react'
import type React from 'react'
import { Link } from 'react-router'

export const PreparationPageFrame = ({
  applicationId,
  eyebrow,
  title,
  description,
  children,
}: {
  readonly applicationId: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}) => (
  <section className="min-h-0 flex-1 overflow-y-auto bg-background p-4 lg:p-6">
    <div className="mx-auto grid max-w-7xl gap-5">
      <div>
        <Link
          to={`/applications/${applicationId}`}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          <ArrowLeft />
          Back to application
        </Link>
        <p className="mt-5 text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm/6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </div>
  </section>
)
