import type {
  FactLinkV1,
  FactsCatalogueV1,
  FactsSectionV1,
  FactTailoringGuidanceV1,
  ReviewedFactV1,
} from '@cv/contracts/facts'
import {
  Badge,
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Separator,
} from '@cv/internal-ui'
import {
  BookOpenCheck,
  ChevronDown,
  FileQuestion,
  LinkIcon,
} from 'lucide-react'
import type * as React from 'react'

import { factsSectionLabels } from '../model/catalogue'

const OptionalText = ({
  label,
  value,
}: {
  readonly label: string
  readonly value?: string | undefined
}) =>
  value === undefined ? null : (
    <span>
      <span className="text-muted-foreground">{label}:</span> {value}
    </span>
  )

const TechnologyList = ({
  values,
}: {
  readonly values: ReadonlyArray<string>
}) =>
  values.length === 0 ? null : (
    <div className="flex flex-wrap gap-1.5">
      {values.map((technology) => (
        <Badge key={technology} variant="secondary">
          {technology}
        </Badge>
      ))}
    </div>
  )

const TailoringGuidance = ({
  guidance,
}: {
  readonly guidance?: FactTailoringGuidanceV1 | undefined
}) =>
  guidance === undefined ? null : (
    <div className="grid gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
      <div className="flex flex-wrap gap-1.5">
        {guidance.inclusion === undefined ? null : (
          <Badge variant="outline">{guidance.inclusion}</Badge>
        )}
        {guidance.wording === undefined ? null : (
          <Badge variant="outline">{guidance.wording}</Badge>
        )}
      </div>
      {guidance.instructions === undefined ? null : (
        <ul className="grid gap-1 text-xs/5 text-muted-foreground">
          {guidance.instructions.map((instruction) => (
            <li key={instruction}>• {instruction}</li>
          ))}
        </ul>
      )}
    </div>
  )

const ReviewedFact = ({
  fact,
  label,
}: {
  readonly fact: ReviewedFactV1
  readonly label?: string | undefined
}) => (
  <article className="grid gap-3 rounded-md border border-border/70 bg-background p-4 [content-visibility:auto]">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        {label === undefined ? null : (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
        )}
        <p className="mt-1 text-sm/6">{fact.text}</p>
      </div>
      <Badge className="max-w-full font-mono" variant="outline">
        {fact.id}
      </Badge>
    </div>
    <div className="flex flex-wrap gap-1.5">
      {(fact.evidenceIds ?? []).map((id) => (
        <Badge key={id} variant="secondary">
          evidence · {id}
        </Badge>
      ))}
      {(fact.assetIds ?? []).map((id) => (
        <Badge key={id} variant="secondary">
          asset · {id}
        </Badge>
      ))}
    </div>
    <TailoringGuidance guidance={fact.guidance} />
  </article>
)

const LinkList = ({ links }: { readonly links: ReadonlyArray<FactLinkV1> }) =>
  links.length === 0 ? null : (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
          href={link.url}
          key={link.id}
          rel="noreferrer"
          target="_blank"
        >
          <LinkIcon className="size-3.5" />
          {link.label}
          {link.visibility === undefined ? null : (
            <Badge variant="outline">{link.visibility}</Badge>
          )}
        </a>
      ))}
    </div>
  )

const EntryCard = ({
  children,
  description,
  id,
  title,
}: {
  readonly children: React.ReactNode
  readonly description?: React.ReactNode
  readonly id: string
  readonly title: string
}) => (
  <Card className="[content-visibility:auto]">
    <CardContent className="grid gap-4 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{title}</h3>
          {description === undefined ? null : (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs/5 text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        <Badge className="max-w-full font-mono" variant="outline">
          {id}
        </Badge>
      </div>
      {children}
    </CardContent>
  </Card>
)

const IdentitySection = ({
  section,
}: {
  readonly section: Extract<FactsSectionV1, { readonly kind: 'identity' }>
}) => (
  <div className="grid gap-4">
    <div>
      <h3 className="text-xl font-semibold tracking-tight">{section.name}</h3>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <OptionalText label="Handle" value={section.handle} />
        <OptionalText label="Headline" value={section.headline} />
        <OptionalText label="Location" value={section.location} />
        <OptionalText label="Timezone" value={section.timezone} />
      </div>
    </div>
    {section.overview === undefined ? null : (
      <ReviewedFact fact={section.overview} label="Overview" />
    )}
    {section.facts.map((fact) => (
      <ReviewedFact fact={fact} key={fact.id} />
    ))}
    {section.languages.length === 0 ? null : (
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Languages
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {section.languages.map((language) => (
            <Badge key={language.id} variant="secondary">
              {language.name}
              {language.proficiency === undefined
                ? null
                : ` · ${language.proficiency}`}
            </Badge>
          ))}
        </div>
      </div>
    )}
    <TailoringGuidance guidance={section.guidance} />
  </div>
)

const ContactSection = ({
  section,
}: {
  readonly section: Extract<FactsSectionV1, { readonly kind: 'contact' }>
}) => (
  <div className="grid gap-3">
    {section.items.map((item) => (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-background p-4"
        key={item.id}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.label ?? item.kind}</p>
          {item.url === undefined ? (
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {item.value}
            </p>
          ) : (
            <a
              className="mt-1 block break-all text-sm text-primary underline-offset-4 hover:underline"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              {item.value}
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{item.kind}</Badge>
          <Badge
            variant={item.visibility === 'private' ? 'warning' : 'success'}
          >
            {item.visibility}
          </Badge>
          <Badge className="font-mono" variant="outline">
            {item.id}
          </Badge>
        </div>
      </div>
    ))}
    <TailoringGuidance guidance={section.guidance} />
  </div>
)

const EducationSection = ({
  section,
}: {
  readonly section: Extract<FactsSectionV1, { readonly kind: 'education' }>
}) => (
  <div className="grid gap-4">
    {section.entries.map((entry) => (
      <EntryCard
        description={
          <>
            <span>{entry.degree}</span>
            <span>{entry.period}</span>
            <OptionalText label="Location" value={entry.location} />
          </>
        }
        id={entry.id}
        key={entry.id}
        title={entry.institution}
      >
        {entry.details.map((fact) => (
          <ReviewedFact fact={fact} key={fact.id} />
        ))}
        {entry.thesis === undefined ? null : (
          <div className="grid gap-3 rounded-md border border-border/70 p-4">
            <h4 className="font-medium">Thesis · {entry.thesis.title}</h4>
            <ReviewedFact fact={entry.thesis.summary} />
            <LinkList links={entry.thesis.links} />
            <div className="flex flex-wrap gap-1.5">
              {entry.thesis.assetIds.map((id) => (
                <Badge key={id} variant="secondary">
                  asset · {id}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <TailoringGuidance guidance={entry.guidance} />
      </EntryCard>
    ))}
    <TailoringGuidance guidance={section.guidance} />
  </div>
)

const ExperienceSection = ({
  section,
}: {
  readonly section: Extract<FactsSectionV1, { readonly kind: 'experience' }>
}) => (
  <div className="grid gap-4">
    {section.entries.map((entry) => (
      <EntryCard
        description={
          <>
            <span>{entry.roles.join(' · ')}</span>
            <span>{entry.period}</span>
            <OptionalText label="Location" value={entry.location} />
            <Badge
              variant={
                entry.companyVisibility === 'private' ? 'warning' : 'success'
              }
            >
              {entry.companyVisibility}
            </Badge>
          </>
        }
        id={entry.id}
        key={entry.id}
        title={entry.company}
      >
        {entry.overview === undefined ? null : (
          <ReviewedFact fact={entry.overview} label="Overview" />
        )}
        {entry.highlights.map((fact) => (
          <ReviewedFact fact={fact} key={fact.id} label="Highlight" />
        ))}
        <TechnologyList values={entry.technologies} />
        {entry.workstreams.map((workstream) => (
          <div
            className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-4"
            key={workstream.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">{workstream.title}</h4>
              <Badge className="font-mono" variant="outline">
                {workstream.id}
              </Badge>
            </div>
            {workstream.overview === undefined ? null : (
              <ReviewedFact fact={workstream.overview} label="Overview" />
            )}
            {workstream.contributions.map((fact) => (
              <ReviewedFact fact={fact} key={fact.id} label="Contribution" />
            ))}
            <TechnologyList values={workstream.technologies} />
            <TailoringGuidance guidance={workstream.guidance} />
          </div>
        ))}
        <TailoringGuidance guidance={entry.guidance} />
      </EntryCard>
    ))}
    <TailoringGuidance guidance={section.guidance} />
  </div>
)

const ProjectsSection = ({
  section,
}: {
  readonly section: Extract<FactsSectionV1, { readonly kind: 'projects' }>
}) => (
  <div className="grid gap-4">
    {section.entries.map((entry) => (
      <EntryCard
        description={
          <Badge
            variant={entry.visibility === 'private' ? 'warning' : 'success'}
          >
            {entry.visibility}
          </Badge>
        }
        id={entry.id}
        key={entry.id}
        title={entry.name}
      >
        <ReviewedFact fact={entry.summary} label="Summary" />
        <LinkList links={entry.links} />
        <TechnologyList values={entry.technologies} />
        {entry.contributions.map((contribution) => (
          <div
            className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-4"
            key={contribution.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">{contribution.title}</h4>
                {contribution.area === undefined ? null : (
                  <Badge variant="secondary">{contribution.area}</Badge>
                )}
              </div>
              <Badge className="font-mono" variant="outline">
                {contribution.id}
              </Badge>
            </div>
            {contribution.facts.map((fact) => (
              <ReviewedFact fact={fact} key={fact.id} />
            ))}
            <TechnologyList values={contribution.technologies} />
            <TailoringGuidance guidance={contribution.guidance} />
          </div>
        ))}
        <TailoringGuidance guidance={entry.guidance} />
      </EntryCard>
    ))}
    <TailoringGuidance guidance={section.guidance} />
  </div>
)

const SkillsSection = ({
  section,
}: {
  readonly section: Extract<FactsSectionV1, { readonly kind: 'skills' }>
}) => (
  <div className="grid gap-4 md:grid-cols-2">
    {section.groups.map((group) => (
      <EntryCard id={group.id} key={group.id} title={group.title}>
        <div className="grid gap-3">
          {group.skills.map((skill) => (
            <div
              className="grid gap-2 rounded-md border border-border/70 bg-background p-3"
              key={skill.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-medium">{skill.name}</h4>
                <Badge className="font-mono" variant="outline">
                  {skill.id}
                </Badge>
              </div>
              {skill.details === undefined ? null : (
                <ReviewedFact fact={skill.details} />
              )}
            </div>
          ))}
        </div>
        <TailoringGuidance guidance={group.guidance} />
      </EntryCard>
    ))}
    <TailoringGuidance guidance={section.guidance} />
  </div>
)

const SectionContent = ({ section }: { readonly section: FactsSectionV1 }) => {
  switch (section.kind) {
    case 'identity':
      return <IdentitySection section={section} />
    case 'contact':
      return <ContactSection section={section} />
    case 'education':
      return <EducationSection section={section} />
    case 'experience':
      return <ExperienceSection section={section} />
    case 'projects':
      return <ProjectsSection section={section} />
    case 'skills':
      return <SkillsSection section={section} />
  }
}

const FactsSection = ({ section }: { readonly section: FactsSectionV1 }) => (
  <Collapsible
    className="overflow-hidden rounded-lg border border-border bg-card"
    defaultOpen
  >
    <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BookOpenCheck className="size-4" />
        </span>
        <span>
          <span className="block font-semibold">
            {factsSectionLabels[section.kind]}
          </span>
          <span className="block text-xs text-muted-foreground">
            {section.kind}
          </span>
        </span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <Separator />
      <div className="p-5">
        <SectionContent section={section} />
      </div>
    </CollapsibleContent>
  </Collapsible>
)

export const FactsCatalogueBrowser = ({
  sections,
}: {
  readonly sections: FactsCatalogueV1['sections']
}) =>
  sections.length === 0 ? (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle>No matching facts</EmptyTitle>
        <EmptyDescription>
          Try a different word, identifier, company, project, or technology.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ) : (
    <div className="grid gap-4">
      {sections.map((section) => (
        <FactsSection key={section.kind} section={section} />
      ))}
    </div>
  )
