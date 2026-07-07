import { cn } from '@cv/ui/utils'
import { useLingui } from '@lingui/react'
import { LockKeyhole } from 'lucide-react'
import { cvMessages } from '@/i18n/messages'

type SkeletonBlockProps = {
  className?: string
}

type SkeletonSectionProps = {
  index: string
  rows?: number
}

const SkeletonBlock = ({ className }: SkeletonBlockProps) => (
  <span
    aria-hidden="true"
    className={cn('block animate-pulse bg-muted', className)}
  />
)

const SkeletonSection = ({ index, rows = 3 }: SkeletonSectionProps) => (
  <section className="border-t border-border">
    <div className="mx-auto grid max-w-7xl border-x border-border md:grid-cols-[10rem_1fr] lg:grid-cols-[13rem_1fr]">
      <div className="border-b border-border p-6 md:border-b-0 md:border-r md:p-8">
        <div className="font-mono text-sm/6 uppercase text-blue-600 dark:text-blue-400">
          <div>{index}</div>
          <SkeletonBlock className="mt-3 h-4 w-20" />
          <SkeletonBlock className="mt-4 h-3 w-24" />
        </div>
      </div>
      <div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            className="grid gap-5 border-b border-border p-6 last:border-b-0 md:p-8 lg:grid-cols-[8rem_1fr_13rem]"
            key={rowIndex}
          >
            <div className="grid gap-2">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-3 w-14" />
            </div>
            <div className="grid gap-3">
              <SkeletonBlock className="h-4 w-56 max-w-full" />
              <SkeletonBlock className="h-3 w-full max-w-xl" />
              <SkeletonBlock className="h-3 w-4/5 max-w-lg" />
            </div>
            <div className="grid content-start gap-2">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
)

export const CvUnlockSkeleton = () => {
  const { i18n } = useLingui()

  return (
    <>
      <div className="screen-only border-b border-border bg-card/65">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 font-mono text-xs/5 text-muted-foreground">
            <LockKeyhole
              aria-hidden="true"
              className="size-3.5 shrink-0"
              strokeWidth={1.8}
            />
            <span>{i18n._(cvMessages.status.loading)}</span>
          </div>
        </div>
      </div>
      <div
        aria-busy="true"
        aria-live="polite"
        className="print-root print-hidden min-h-dvh bg-background"
      >
        <main>
          <section className="mx-auto max-w-7xl border-x border-border">
            <div className="grid md:min-h-[34rem] md:grid-cols-[minmax(0,1fr)_21rem] lg:min-h-[36rem] lg:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="px-5 py-8 sm:px-8 md:py-9 lg:px-10 lg:py-10">
                <SkeletonBlock className="h-3 w-28" />
                <SkeletonBlock className="mt-4 h-3 w-44" />
                <div className="mt-8">
                  <SkeletonBlock className="h-3 w-24" />
                  <SkeletonBlock className="mt-4 h-16 w-72 max-w-full sm:h-20 sm:w-96" />
                </div>
                <div className="mt-7 border-y border-border">
                  <div className="grid gap-2 border-b border-border py-5 sm:grid-cols-[8rem_1fr]">
                    <SkeletonBlock className="h-3 w-14" />
                    <SkeletonBlock className="h-4 w-52 max-w-full" />
                  </div>
                  <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]">
                    <SkeletonBlock className="h-3 w-16" />
                    <SkeletonBlock className="h-4 w-64 max-w-full" />
                  </div>
                </div>
                <div className="mt-5 grid max-w-3xl gap-2">
                  <SkeletonBlock className="h-3 w-full" />
                  <SkeletonBlock className="h-3 w-5/6" />
                  <SkeletonBlock className="h-3 w-2/3" />
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <SkeletonBlock className="h-9 w-28" />
                  <SkeletonBlock className="h-9 w-32" />
                </div>
              </div>
              <aside className="border-t border-border bg-card/35 md:border-t-0 md:border-l">
                <div className="border-b border-border px-5 py-4">
                  <SkeletonBlock className="h-3 w-16" />
                </div>
                {Array.from({ length: 5 }, (_, index) => (
                  <div className="border-b border-border px-5 py-3" key={index}>
                    <SkeletonBlock className="h-3 w-28" />
                  </div>
                ))}
              </aside>
            </div>
          </section>
          <SkeletonSection index="01" rows={3} />
          <SkeletonSection index="02" rows={4} />
          <SkeletonSection index="03" rows={3} />
        </main>
      </div>
    </>
  )
}
