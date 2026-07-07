import { SectionShell } from '@/components/cv/section-shell'
import { TechList } from '@/components/cv/tech-list'
import { WorkstreamList } from '@/components/cv/workstream-list'
import {
  RedactedInlineText,
  redactedTextFallback,
} from '@/components/private-cv/redactions'
import type { CvContent, ExperienceItem } from '@/cv-content/model'

type ExperienceSectionProps = {
  section: Extract<CvContent['sections'][number], { type: 'experience' }>
}

type ExperienceSummaryProps = {
  item: ExperienceItem
}

const ExperienceSummary = ({ item }: ExperienceSummaryProps) => (
  <p className="mt-2 text-sm/6 text-slate-700 dark:text-slate-300">
    {item.summary}
  </p>
)

export const ExperienceSection = ({ section }: ExperienceSectionProps) => (
  <SectionShell
    description={section.description ?? ''}
    id={section.id}
    index={section.index}
    title={section.label}
  >
    {section.items.map((item) => {
      return (
        <article
          className="print-break-inside-avoid grid gap-5 border-b border-border p-6 last:border-b-0 md:p-8 lg:grid-cols-[8rem_1fr_14rem]"
          key={`${redactedTextFallback(item.company)}-${item.period}`}
        >
          <div className="font-mono text-xs/5 text-muted-foreground">
            <div>{item.period}</div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {item.location}
            </div>
          </div>
          <div>
            <h2 className="font-mono text-sm/6 font-semibold text-foreground">
              {item.title} · <RedactedInlineText value={item.company} />
            </h2>
            <ExperienceSummary item={item} />
            <ul className="mt-3 grid gap-1 font-mono text-xs/5 text-muted-foreground">
              {item.highlights.map((highlight) => (
                <li key={highlight}>- {highlight}</li>
              ))}
            </ul>
            {item.workstreams ? (
              <WorkstreamList items={item.workstreams} />
            ) : null}
          </div>
          <TechList
            className="self-start text-xs/5 text-blue-600 dark:text-blue-400"
            items={item.stack}
          />
        </article>
      )
    })}
  </SectionShell>
)
