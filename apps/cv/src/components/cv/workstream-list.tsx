import { ChevronDown } from 'lucide-react'
import type { ExperienceItem } from '@/cv-content/model'

type Workstream = NonNullable<ExperienceItem['workstreams']>[number]

type WorkstreamListProps = {
  items: readonly Workstream[]
}

type WorkstreamSummaryProps = Pick<Workstream, 'summary'>

type WorkstreamItemProps = {
  workstream: Workstream
}

const WorkstreamSummary = ({ summary }: WorkstreamSummaryProps) => (
  <p className="text-xs/5 text-slate-700 dark:text-slate-300">{summary}</p>
)

const WorkstreamRow = ({ workstream }: WorkstreamItemProps) => (
  <div className="grid gap-2 border-b border-border py-3 last:border-b-0 lg:grid-cols-[10rem_1fr]">
    <h3 className="font-mono text-xs/5 text-blue-600 dark:text-blue-400">
      {workstream.title}
    </h3>
    <WorkstreamSummary summary={workstream.summary} />
  </div>
)

const WorkstreamDisclosure = ({ workstream }: WorkstreamItemProps) => (
  <details className="group/workstream border-b border-border last:border-b-0">
    <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 py-3 text-left font-mono text-xs/5 text-blue-600 outline-none hover:text-foreground focus-visible:text-foreground dark:text-blue-400 [&::-webkit-details-marker]:hidden">
      <span>{workstream.title}</span>
      <ChevronDown
        aria-hidden="true"
        className="size-3.5 shrink-0 transition-transform group-open/workstream:rotate-180"
        strokeWidth={1.7}
      />
    </summary>
    <div className="pb-3 text-xs/5 text-slate-700 dark:text-slate-300">
      <WorkstreamSummary summary={workstream.summary} />
    </div>
  </details>
)

export const WorkstreamList = ({ items }: WorkstreamListProps) => (
  <div className="mt-6 border-t border-border">
    <div className="md:hidden">
      {items.map((workstream) => (
        <WorkstreamDisclosure key={workstream.title} workstream={workstream} />
      ))}
    </div>
    <div className="hidden md:block">
      {items.map((workstream) => (
        <WorkstreamRow key={workstream.title} workstream={workstream} />
      ))}
    </div>
  </div>
)
