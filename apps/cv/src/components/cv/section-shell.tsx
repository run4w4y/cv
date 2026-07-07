import type { ReactNode } from 'react'

type SectionShellProps = {
  children: ReactNode
  description: string
  id: string
  index: string
  title: string
}

type SectionLabelProps = {
  description: string
  index: string
  title: string
}

export const SectionLabel = ({
  description,
  index,
  title,
}: SectionLabelProps) => (
  <div className="font-mono text-sm/6 uppercase text-blue-600 dark:text-blue-400">
    <div>{index}</div>
    <div className="mt-3">{title}</div>
    <p className="mt-3 text-xs/5 normal-case text-slate-500 dark:text-slate-400">
      <span className="text-blue-600/70 dark:text-blue-400/70">{'/* '}</span>
      {description}
      <span className="text-blue-600/70 dark:text-blue-400/70">{' */'}</span>
    </p>
  </div>
)

export const SectionShell = ({
  children,
  description,
  id,
  index,
  title,
}: SectionShellProps) => (
  <section className="border-t border-border" id={id}>
    <div className="mx-auto grid max-w-7xl border-x border-border md:grid-cols-[10rem_1fr] lg:grid-cols-[13rem_1fr]">
      <div className="border-b border-border p-6 md:border-b-0 md:border-r md:p-8">
        <SectionLabel description={description} index={index} title={title} />
      </div>
      <div>{children}</div>
    </div>
  </section>
)
