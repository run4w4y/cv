import { useLingui } from '@lingui/react'
import { ChevronDown } from 'lucide-react'
import { CvActionLink, cvActionLinkKey } from '@/components/cv/action-link'
import { SectionShell } from '@/components/cv/section-shell'
import { TechList } from '@/components/cv/tech-list'
import type { CvContent, ProjectItem } from '@/cv-content/model'
import { cvMessages } from '@/i18n/messages'

const PROJECTS_VISIBLE_LIMIT = 6

type ProjectsSectionProps = {
  section: Extract<CvContent['sections'][number], { type: 'projects' }>
}

type ProjectSummaryProps = {
  project: ProjectItem
}

type ProjectArticleProps = {
  project: ProjectItem
}

const ProjectSummary = ({ project }: ProjectSummaryProps) => (
  <p className="text-sm/6 text-slate-700 dark:text-slate-300">
    {project.summary}
  </p>
)

const ProjectArticle = ({ project }: ProjectArticleProps) => (
  <article className="print-break-inside-avoid grid gap-5 border-b border-border p-6 last:border-b-0 md:p-8 lg:grid-cols-[9rem_1fr_13rem]">
    <div>
      {project.visibility ? (
        <p className="mb-2 font-mono text-xs/5 text-blue-600 dark:text-blue-400">
          {project.visibility}
        </p>
      ) : null}
      <h2 className="font-mono text-sm/6 font-semibold text-foreground">
        {project.name}
      </h2>
    </div>
    <div>
      <ProjectSummary project={project} />
      <TechList
        className="mt-3 text-xs/5 text-muted-foreground"
        items={project.stack}
      />
    </div>
    <div className="flex flex-col items-start gap-2 font-mono text-xs/5 text-blue-600 dark:text-blue-400">
      {project.links.map((link) => (
        <CvActionLink
          href={link.href}
          icon={link.icon}
          key={cvActionLinkKey(link)}
          label={link.label}
        />
      ))}
    </div>
  </article>
)

export const ProjectsSection = ({ section }: ProjectsSectionProps) => {
  const { i18n } = useLingui()
  const shouldCollapse = section.items.length > PROJECTS_VISIBLE_LIMIT
  const visibleProjects = shouldCollapse
    ? section.items.slice(0, PROJECTS_VISIBLE_LIMIT)
    : section.items
  const hiddenProjects = shouldCollapse
    ? section.items.slice(PROJECTS_VISIBLE_LIMIT)
    : []

  return (
    <SectionShell
      description={section.description ?? ''}
      id={section.id}
      index={section.index}
      title={section.label}
    >
      {visibleProjects.map((project) => (
        <ProjectArticle key={project.name} project={project} />
      ))}
      {hiddenProjects.length > 0 ? (
        <details className="group/projects flex flex-col">
          <summary className="order-2 flex w-full cursor-pointer list-none items-center justify-center gap-2 border-border bg-card/35 p-6 text-center font-mono text-xs/5 uppercase text-blue-600 outline-none transition-colors hover:bg-card/55 hover:text-foreground focus-visible:bg-card/55 focus-visible:text-foreground group-open/projects:border-t md:p-8 dark:bg-card/25 dark:text-blue-400 dark:hover:bg-card/40 dark:focus-visible:bg-card/40 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="group-open/projects:hidden">
                {i18n._(cvMessages.actions.showMore)}
              </span>
              <span className="hidden group-open/projects:inline">
                {i18n._(cvMessages.actions.showLess)}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-3.5 shrink-0 transition-transform group-open/projects:rotate-180"
              strokeWidth={1.7}
            />
          </summary>
          <div className="order-1">
            {hiddenProjects.map((project) => (
              <ProjectArticle key={project.name} project={project} />
            ))}
          </div>
        </details>
      ) : null}
    </SectionShell>
  )
}
