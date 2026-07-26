import type { CvAuthoringSource } from '@cv/application-preparation-workflow'
import type { CvDocumentV1 } from '@cv/contracts/document'
import {
  Combobox,
  ReorderableList,
  Select,
  type SelectOption,
} from '@cv/internal-ui'
import type { ReactNode } from 'react'

import {
  addDocumentArrayItem,
  moveDocumentArrayItem,
  removeDocumentArrayItem,
} from './document-utils'
import {
  BulletListEditor,
  DocumentPaper,
  InlineTextField,
  ReviewedFactSelect,
  ReviewedInlineValue,
  RowActions,
  SectionHeading,
} from './semantic-fields'
import type {
  DocumentMutationHandlers,
  DocumentPath,
  DocumentValidationIssue,
} from './types'

const issuesAt = (
  issues: ReadonlyArray<DocumentValidationIssue>,
  path: DocumentPath
): ReadonlyArray<DocumentValidationIssue> =>
  issues.filter(
    (issue) =>
      issue.path.length >= path.length &&
      path.every((segment, index) => issue.path[index] === segment)
  )

type CvEditorSectionProps = {
  readonly disabled: boolean
  readonly document: CvDocumentV1
  readonly issues: ReadonlyArray<DocumentValidationIssue>
  readonly mutations: DocumentMutationHandlers
  readonly reviewed?: CvAuthoringSource
}

const freshSectionId = (): string => `section:${globalThis.crypto.randomUUID()}`

const missingById = <A extends { readonly id: string }>(
  reviewed: ReadonlyArray<A>,
  selected: ReadonlyArray<{ readonly id: string }>
): ReadonlyArray<A> => {
  const selectedIds = new Set(selected.map(({ id }) => id))
  return reviewed.filter(({ id }) => !selectedIds.has(id))
}

const editArrayValue = <A,>(
  handlers: DocumentMutationHandlers,
  path: DocumentPath,
  values: ReadonlyArray<A>,
  index: number,
  value: A
): void => {
  const next = [...values]
  next[index] = value
  handlers.onEdit(path, next)
}

type EntityListProps<T> = {
  readonly ariaLabel: string
  readonly children: (item: T, index: number) => ReactNode
  readonly className?: string
  readonly disabled: boolean
  readonly getKey: (item: T, index: number) => string
  readonly getLabel: (item: T, index: number) => string
  readonly items: ReadonlyArray<T>
  readonly minimum?: number
  readonly mutations: DocumentMutationHandlers
  readonly path: DocumentPath
  readonly rowClassName?: string
}

/**
 * Every ordered document entity uses one interaction model: a compact row,
 * drag-to-reorder, and a contextual remove action. Section-specific renderers
 * only describe fields; they do not invent different card or ordering UI.
 */
const EntityList = <T,>({
  ariaLabel,
  children,
  className,
  disabled,
  getKey,
  getLabel,
  items,
  minimum = 0,
  mutations,
  path,
  rowClassName = 'border-b border-border/70 py-4 last:border-b-0',
}: EntityListProps<T>) => (
  <ReorderableList
    ariaLabel={ariaLabel}
    className={className}
    disabled={disabled || items.length < 2}
    getKey={getKey}
    getTextValue={getLabel}
    items={items}
    onMove={(fromIndex, toIndex) =>
      moveDocumentArrayItem(mutations, path, items, fromIndex, toIndex)
    }
    renderItem={(item, index) => (
      <div className={`group flex min-w-0 items-start gap-2 ${rowClassName}`}>
        <div className="min-w-0 flex-1">{children(item, index)}</div>
        <RowActions
          disabled={disabled || items.length <= minimum}
          label={getLabel(item, index)}
          onRemove={() =>
            removeDocumentArrayItem(mutations, path, items, index)
          }
        />
      </div>
    )}
  />
)

const ChoiceIssue = ({
  issues,
}: {
  readonly issues: ReadonlyArray<DocumentValidationIssue>
}) =>
  issues.length === 0 ? null : (
    <p className="mt-0.5 px-1 text-xs/5 text-destructive" role="alert">
      {issues[0]?.message}
    </p>
  )

const ReviewedSingleChoice = ({
  disabled,
  issues,
  label,
  onChange,
  options,
  value,
}: {
  readonly disabled: boolean
  readonly issues?: ReadonlyArray<DocumentValidationIssue>
  readonly label: string
  readonly onChange: (value: string) => void
  readonly options: ReadonlyArray<string>
  readonly value: string
}) => {
  const selectOptions: ReadonlyArray<SelectOption> = options.map((option) => ({
    label: option,
    value: option,
  }))

  if (selectOptions.length < 2) {
    return <ReviewedInlineValue label={label} tone="subtitle" value={value} />
  }

  return (
    <div>
      <Select
        ariaLabel={label}
        className="h-8 w-full justify-start px-1.5 text-base/6 font-medium"
        disabled={disabled}
        invalid={(issues?.length ?? 0) > 0}
        onValueChange={(next) => {
          if (next !== null) onChange(next)
        }}
        options={selectOptions}
        value={value}
        variant="ghost"
      />
      <ChoiceIssue issues={issues ?? []} />
    </div>
  )
}

const ReviewedMultiChoice = ({
  disabled,
  issues,
  label,
  onChange,
  options,
  value,
}: {
  readonly disabled: boolean
  readonly issues?: ReadonlyArray<DocumentValidationIssue>
  readonly label: string
  readonly onChange: (value: ReadonlyArray<string>) => void
  readonly options: ReadonlyArray<string>
  readonly value: ReadonlyArray<string>
}) => (
  <div className="min-w-0">
    <Combobox
      ariaLabel={label}
      className="[&_[data-slot=button]]:h-8"
      disabled={disabled}
      invalid={(issues?.length ?? 0) > 0}
      mode="multiple"
      onValueChange={onChange}
      options={options.map((option) => ({
        label: option,
        value: option,
      }))}
      placeholder={`Select ${label.toLocaleLowerCase()}…`}
      searchPlaceholder={`Search ${label.toLocaleLowerCase()}…`}
      value={value}
    />
    <ChoiceIssue issues={issues ?? []} />
  </div>
)

type DocumentContact = CvDocumentV1['person']['contacts'][number]
type ReviewedContact = CvAuthoringSource['person']['contacts'][number]

const contactKey = (contact: DocumentContact): string =>
  contact.href ?? `${contact.kind}:${contact.value}`

const reviewedContactKey = (contact: ReviewedContact): string =>
  contact.url ?? `${contact.kind}:${contact.value}`

const reviewedContactDocument = (
  contact: ReviewedContact
): DocumentContact => ({
  kind: contact.kind,
  label: contact.label ?? contact.value,
  value: contact.value,
  ...(contact.url === undefined ? {} : { href: contact.url }),
})

const ReviewedContactList = ({
  contacts,
  disabled,
  mutations,
  reviewed = [],
}: {
  readonly contacts: CvDocumentV1['person']['contacts']
  readonly disabled: boolean
  readonly mutations: DocumentMutationHandlers
  readonly reviewed?: ReadonlyArray<ReviewedContact>
}) => {
  const path = ['person', 'contacts'] as const
  const selected = new Set(contacts.map(contactKey))
  const available = reviewed.filter(
    (contact) => !selected.has(reviewedContactKey(contact))
  )

  return (
    <div className="mt-3 grid gap-2">
      <EntityList
        ariaLabel="Reorder contact methods"
        disabled={disabled}
        getKey={(contact, index) => `${contactKey(contact)}:${index}`}
        getLabel={(contact) => contact.label || contact.value}
        items={contacts}
        minimum={1}
        mutations={mutations}
        path={path}
        rowClassName="py-0.5"
      >
        {(contact, index) => (
          <div className="grid min-w-0 items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)]">
            <span className="px-1.5 text-xs text-muted-foreground capitalize">
              {contact.kind}
            </span>
            <ReviewedInlineValue
              label={`Contact ${index + 1}`}
              tone="meta"
              value={contact.label || contact.value}
            />
          </div>
        )}
      </EntityList>
      <ReviewedFactSelect
        disabled={disabled}
        label="Add reviewed contact"
        onSelect={(id) => {
          const source = available.find(
            (contact) => reviewedContactKey(contact) === id
          )
          if (source !== undefined) {
            addDocumentArrayItem(
              mutations,
              path,
              contacts,
              reviewedContactDocument(source)
            )
          }
        }}
        options={available.map((contact) => ({
          id: reviewedContactKey(contact),
          label: contact.label ?? contact.value,
        }))}
      />
    </div>
  )
}

const ExperienceEditor = ({
  disabled,
  document,
  issues,
  mutations,
  reviewed,
}: CvEditorSectionProps) => {
  const path = ['experience'] as const
  const available = missingById(reviewed?.experience ?? [], document.experience)

  return (
    <section className="mt-8">
      <SectionHeading
        action={
          <div className="flex items-center gap-2">
            <InlineTextField
              className="h-7 w-40 text-right text-xs"
              disabled={disabled}
              issues={issuesAt(issues, ['experienceDuration'])}
              label="Experience duration"
              onChange={(value) =>
                mutations.onEdit(
                  ['experienceDuration'],
                  value.trim().length === 0 ? undefined : value
                )
              }
              placeholder="e.g. 8+ years"
              tone="meta"
              value={document.experienceDuration ?? ''}
            />
            <ReviewedFactSelect
              disabled={disabled || document.experience.length >= 10}
              label="Add reviewed experience"
              onSelect={(id) => {
                const source = available.find((item) => item.id === id)
                const role = source?.roles[0]
                if (source === undefined || role === undefined) return
                addDocumentArrayItem(mutations, path, document.experience, {
                  id: source.id,
                  company: source.company,
                  role,
                  period: source.period,
                  ...(source.location === undefined
                    ? {}
                    : { location: source.location }),
                  highlights: [],
                  technologies: [...source.technologies],
                })
              }}
              options={available.map((source) => ({
                id: source.id,
                label: `${source.roles[0] ?? 'Experience'} · ${source.company}`,
              }))}
            />
          </div>
        }
      >
        Experience
      </SectionHeading>
      <EntityList
        ariaLabel="Reorder experience"
        disabled={disabled}
        getKey={(entry) => entry.id}
        getLabel={(entry) => `${entry.role} at ${entry.company}`}
        items={document.experience}
        mutations={mutations}
        path={path}
      >
        {(entry, index) => {
          const entryPath = [...path, index] as const
          const highlightsPath = [...entryPath, 'highlights'] as const
          const source = reviewed?.experience.find(
            (candidate) => candidate.id === entry.id
          )

          return (
            <div className="grid min-w-0 gap-1">
              <ReviewedSingleChoice
                disabled={disabled}
                issues={issuesAt(issues, [...entryPath, 'role'])}
                label={`Role ${index + 1}`}
                onChange={(value) =>
                  mutations.onEdit([...entryPath, 'role'], value)
                }
                options={source?.roles ?? [entry.role]}
                value={entry.role}
              />
              <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <ReviewedInlineValue
                  label={`Company ${index + 1}`}
                  tone="meta"
                  value={entry.company}
                />
                <ReviewedInlineValue
                  className="text-right"
                  label={`Period ${index + 1}`}
                  tone="meta"
                  value={entry.period}
                />
              </div>
              {entry.location === undefined ? null : (
                <ReviewedInlineValue
                  label={`Location ${index + 1}`}
                  tone="meta"
                  value={entry.location}
                />
              )}
              <InlineTextField
                className="mt-1"
                disabled={disabled}
                issues={issuesAt(issues, [...entryPath, 'summary'])}
                label={`Experience summary ${index + 1}`}
                multiline
                onChange={(value) =>
                  mutations.onEdit(
                    [...entryPath, 'summary'],
                    value.trim().length === 0 ? undefined : value
                  )
                }
                placeholder="Optional role summary"
                value={entry.summary ?? ''}
              />
              <BulletListEditor
                disabled={disabled}
                issuesForIndex={(highlightIndex) =>
                  issuesAt(issues, [...highlightsPath, highlightIndex])
                }
                label="Highlight"
                onAdd={() =>
                  addDocumentArrayItem(
                    mutations,
                    highlightsPath,
                    entry.highlights,
                    ''
                  )
                }
                onChange={(highlightIndex, value) =>
                  editArrayValue(
                    mutations,
                    highlightsPath,
                    entry.highlights,
                    highlightIndex,
                    value
                  )
                }
                onMove={(fromIndex, toIndex) =>
                  moveDocumentArrayItem(
                    mutations,
                    highlightsPath,
                    entry.highlights,
                    fromIndex,
                    toIndex
                  )
                }
                onRemove={(highlightIndex) =>
                  removeDocumentArrayItem(
                    mutations,
                    highlightsPath,
                    entry.highlights,
                    highlightIndex
                  )
                }
                values={entry.highlights}
              />
              <div className="mt-2 grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
                <span className="px-1 text-xs text-muted-foreground">
                  Technologies
                </span>
                <ReviewedMultiChoice
                  disabled={disabled}
                  issues={issuesAt(issues, [...entryPath, 'technologies'])}
                  label={`Experience technologies ${index + 1}`}
                  onChange={(value) =>
                    mutations.onEdit([...entryPath, 'technologies'], value)
                  }
                  options={source?.technologies ?? entry.technologies}
                  value={entry.technologies}
                />
              </div>
            </div>
          )
        }}
      </EntityList>
    </section>
  )
}

const ProjectsEditor = ({
  disabled,
  document,
  issues,
  mutations,
  reviewed,
}: CvEditorSectionProps) => {
  const path = ['projects'] as const
  const available = missingById(reviewed?.projects ?? [], document.projects)

  return (
    <section className="mt-8">
      <SectionHeading
        action={
          <ReviewedFactSelect
            disabled={disabled || document.projects.length >= 8}
            label="Add reviewed project"
            onSelect={(id) => {
              const source = available.find((item) => item.id === id)
              if (source === undefined) return
              addDocumentArrayItem(mutations, path, document.projects, {
                id: source.id,
                name: source.name,
                summary: '',
                highlights: [],
                technologies: [...source.technologies],
                links: source.links.map((link) => ({
                  kind: 'website' as const,
                  label: link.label,
                  value: link.label,
                  href: link.url,
                })),
              })
            }}
            options={available.map((source) => ({
              id: source.id,
              label: source.name,
            }))}
          />
        }
      >
        Projects
      </SectionHeading>
      <EntityList
        ariaLabel="Reorder projects"
        disabled={disabled}
        getKey={(project) => project.id}
        getLabel={(project) => project.name}
        items={document.projects}
        mutations={mutations}
        path={path}
      >
        {(project, index) => {
          const projectPath = [...path, index] as const
          const highlightsPath = [...projectPath, 'highlights'] as const
          const source = reviewed?.projects.find(
            (candidate) => candidate.id === project.id
          )
          const selectedLinks = project.links.flatMap((link) =>
            link.href === undefined ? [] : [link.href]
          )

          return (
            <div className="grid min-w-0 gap-1">
              <ReviewedInlineValue
                label={`Project name ${index + 1}`}
                tone="subtitle"
                value={project.name}
              />
              <InlineTextField
                className="mt-1"
                disabled={disabled}
                issues={issuesAt(issues, [...projectPath, 'summary'])}
                label={`Project summary ${index + 1}`}
                multiline
                onChange={(value) =>
                  mutations.onEdit([...projectPath, 'summary'], value)
                }
                placeholder="What the project does and why it matters"
                value={project.summary}
              />
              <BulletListEditor
                disabled={disabled}
                issuesForIndex={(highlightIndex) =>
                  issuesAt(issues, [...highlightsPath, highlightIndex])
                }
                label="Highlight"
                onAdd={() =>
                  addDocumentArrayItem(
                    mutations,
                    highlightsPath,
                    project.highlights,
                    ''
                  )
                }
                onChange={(highlightIndex, value) =>
                  editArrayValue(
                    mutations,
                    highlightsPath,
                    project.highlights,
                    highlightIndex,
                    value
                  )
                }
                onMove={(fromIndex, toIndex) =>
                  moveDocumentArrayItem(
                    mutations,
                    highlightsPath,
                    project.highlights,
                    fromIndex,
                    toIndex
                  )
                }
                onRemove={(highlightIndex) =>
                  removeDocumentArrayItem(
                    mutations,
                    highlightsPath,
                    project.highlights,
                    highlightIndex
                  )
                }
                values={project.highlights}
              />
              <div className="mt-2 grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
                <span className="px-1 text-xs text-muted-foreground">
                  Technologies
                </span>
                <ReviewedMultiChoice
                  disabled={disabled}
                  issues={issuesAt(issues, [...projectPath, 'technologies'])}
                  label={`Project technologies ${index + 1}`}
                  onChange={(value) =>
                    mutations.onEdit([...projectPath, 'technologies'], value)
                  }
                  options={source?.technologies ?? project.technologies}
                  value={project.technologies}
                />
                {(source?.links.length ?? 0) === 0 ? null : (
                  <>
                    <span className="px-1 text-xs text-muted-foreground">
                      Links
                    </span>
                    <Combobox
                      ariaLabel={`Project links ${index + 1}`}
                      disabled={disabled}
                      mode="multiple"
                      onValueChange={(value) =>
                        mutations.onEdit(
                          [...projectPath, 'links'],
                          (source?.links ?? [])
                            .filter((link) => value.includes(link.url))
                            .map((link) => ({
                              kind: 'website' as const,
                              label: link.label,
                              value: link.label,
                              href: link.url,
                            }))
                        )
                      }
                      options={(source?.links ?? []).map((link) => ({
                        description: link.url,
                        label: link.label,
                        value: link.url,
                      }))}
                      placeholder="Select reviewed links…"
                      value={selectedLinks}
                    />
                  </>
                )}
              </div>
            </div>
          )
        }}
      </EntityList>
    </section>
  )
}

const SkillsEditor = ({
  disabled,
  document,
  issues,
  mutations,
  reviewed,
}: CvEditorSectionProps) => {
  const path = ['skills'] as const
  const available = missingById(reviewed?.skillGroups ?? [], document.skills)

  return (
    <section className="mt-8">
      <SectionHeading
        action={
          <ReviewedFactSelect
            disabled={disabled || document.skills.length >= 10}
            label="Add reviewed skill group"
            onSelect={(id) => {
              const source = available.find((item) => item.id === id)
              if (source === undefined) return
              addDocumentArrayItem(mutations, path, document.skills, {
                id: source.id,
                label: source.label,
                items: [...source.items],
              })
            }}
            options={available.map((source) => ({
              id: source.id,
              label: source.label,
            }))}
          />
        }
      >
        Skills
      </SectionHeading>
      <EntityList
        ariaLabel="Reorder skill groups"
        disabled={disabled}
        getKey={(group) => group.id}
        getLabel={(group) => group.label}
        items={document.skills}
        mutations={mutations}
        path={path}
        rowClassName="border-b border-border/70 py-3 last:border-b-0"
      >
        {(group, index) => {
          const groupPath = [...path, index] as const
          const source = reviewed?.skillGroups.find(
            (candidate) => candidate.id === group.id
          )

          return (
            <div className="grid min-w-0 gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
              <ReviewedInlineValue
                label={`Skill group ${index + 1}`}
                tone="subtitle"
                value={group.label}
              />
              <ReviewedMultiChoice
                disabled={disabled}
                issues={issuesAt(issues, [...groupPath, 'items'])}
                label={`${group.label} skills`}
                onChange={(value) =>
                  mutations.onEdit([...groupPath, 'items'], value)
                }
                options={source?.items ?? group.items}
                value={group.items}
              />
            </div>
          )
        }}
      </EntityList>
    </section>
  )
}

const EducationEditor = ({
  disabled,
  document,
  issues,
  mutations,
  reviewed,
}: CvEditorSectionProps) => {
  const path = ['education'] as const
  const available = missingById(reviewed?.education ?? [], document.education)

  return (
    <section className="mt-8">
      <SectionHeading
        action={
          <ReviewedFactSelect
            disabled={disabled || document.education.length >= 6}
            label="Add reviewed education"
            onSelect={(id) => {
              const source = available.find((item) => item.id === id)
              if (source === undefined) return
              addDocumentArrayItem(mutations, path, document.education, {
                id: source.id,
                institution: source.institution,
                qualification: source.degree,
                period: source.period,
                ...(source.location === undefined
                  ? {}
                  : { location: source.location }),
                details: [],
              })
            }}
            options={available.map((source) => ({
              id: source.id,
              label: `${source.degree} · ${source.institution}`,
            }))}
          />
        }
      >
        Education
      </SectionHeading>
      <EntityList
        ariaLabel="Reorder education"
        disabled={disabled}
        getKey={(entry) => entry.id}
        getLabel={(entry) => entry.qualification}
        items={document.education}
        mutations={mutations}
        path={path}
      >
        {(entry, index) => {
          const entryPath = [...path, index] as const
          const detailsPath = [...entryPath, 'details'] as const

          return (
            <div className="grid min-w-0 gap-1">
              <ReviewedInlineValue
                label={`Qualification ${index + 1}`}
                tone="subtitle"
                value={entry.qualification}
              />
              <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <ReviewedInlineValue
                  label={`Institution ${index + 1}`}
                  tone="meta"
                  value={entry.institution}
                />
                {entry.period === undefined ? null : (
                  <ReviewedInlineValue
                    className="text-right"
                    label={`Education period ${index + 1}`}
                    tone="meta"
                    value={entry.period}
                  />
                )}
              </div>
              {entry.location === undefined ? null : (
                <ReviewedInlineValue
                  label={`Education location ${index + 1}`}
                  tone="meta"
                  value={entry.location}
                />
              )}
              <BulletListEditor
                disabled={disabled}
                issuesForIndex={(detailIndex) =>
                  issuesAt(issues, [...detailsPath, detailIndex])
                }
                label="Detail"
                onAdd={() =>
                  addDocumentArrayItem(
                    mutations,
                    detailsPath,
                    entry.details,
                    ''
                  )
                }
                onChange={(detailIndex, value) =>
                  editArrayValue(
                    mutations,
                    detailsPath,
                    entry.details,
                    detailIndex,
                    value
                  )
                }
                onMove={(fromIndex, toIndex) =>
                  moveDocumentArrayItem(
                    mutations,
                    detailsPath,
                    entry.details,
                    fromIndex,
                    toIndex
                  )
                }
                onRemove={(detailIndex) =>
                  removeDocumentArrayItem(
                    mutations,
                    detailsPath,
                    entry.details,
                    detailIndex
                  )
                }
                values={entry.details}
              />
            </div>
          )
        }}
      </EntityList>
    </section>
  )
}

const AdditionalSectionsEditor = ({
  disabled,
  document,
  issues,
  mutations,
  reviewed,
}: CvEditorSectionProps) => {
  const path = ['additionalSections'] as const
  const available = missingById(
    reviewed?.additionalSectionItems ?? [],
    document.additionalSections.flatMap(({ items }) => items)
  )

  return (
    <section className="mt-8">
      <SectionHeading
        action={
          <ReviewedFactSelect
            disabled={disabled || document.additionalSections.length >= 6}
            label="Add reviewed detail"
            onSelect={(id) => {
              const source = available.find((item) => item.id === id)
              if (source === undefined) return
              addDocumentArrayItem(
                mutations,
                path,
                document.additionalSections,
                {
                  id: freshSectionId(),
                  title: source.sectionTitle,
                  items: [{ id: source.id, text: source.label }],
                }
              )
            }}
            options={available.map((source) => ({
              id: source.id,
              label: source.label,
            }))}
          />
        }
      >
        Additional sections
      </SectionHeading>
      <EntityList
        ariaLabel="Reorder additional sections"
        className="mt-1"
        disabled={disabled}
        getKey={(section) => section.id}
        getLabel={(section) => section.title}
        items={document.additionalSections}
        mutations={mutations}
        path={path}
      >
        {(section, sectionIndex) => {
          const sectionPath = [...path, sectionIndex] as const
          const itemsPath = [...sectionPath, 'items'] as const

          return (
            <div className="grid min-w-0 gap-2">
              <InlineTextField
                className="h-8 text-xs font-semibold tracking-[0.16em] uppercase"
                disabled={disabled}
                issues={issuesAt(issues, [...sectionPath, 'title'])}
                label={`Section title ${sectionIndex + 1}`}
                onChange={(value) =>
                  mutations.onEdit([...sectionPath, 'title'], value)
                }
                value={section.title}
              />
              <EntityList
                ariaLabel={`Reorder ${section.title} items`}
                disabled={disabled}
                getKey={(item) => item.id}
                getLabel={(item, itemIndex) =>
                  item.title ?? `${section.title} item ${itemIndex + 1}`
                }
                items={section.items}
                minimum={1}
                mutations={mutations}
                path={itemsPath}
                rowClassName="py-1"
              >
                {(item, itemIndex) => {
                  const itemPath = [...itemsPath, itemIndex] as const
                  return (
                    <div className="grid min-w-0 gap-0.5">
                      <InlineTextField
                        className="h-7"
                        disabled={disabled}
                        issues={issuesAt(issues, [...itemPath, 'title'])}
                        label={`Item title ${itemIndex + 1}`}
                        onChange={(value) =>
                          mutations.onEdit(
                            [...itemPath, 'title'],
                            value.trim().length === 0 ? undefined : value
                          )
                        }
                        placeholder="Optional title"
                        tone="subtitle"
                        value={item.title ?? ''}
                      />
                      <InlineTextField
                        disabled={disabled}
                        issues={issuesAt(issues, [...itemPath, 'text'])}
                        label={`Item text ${itemIndex + 1}`}
                        multiline
                        onChange={(value) =>
                          mutations.onEdit([...itemPath, 'text'], value)
                        }
                        value={item.text}
                      />
                    </div>
                  )
                }}
              </EntityList>
              <ReviewedFactSelect
                disabled={disabled || section.items.length >= 8}
                label={`Add reviewed item to ${section.title}`}
                onSelect={(id) => {
                  const source = available.find((item) => item.id === id)
                  if (source !== undefined) {
                    addDocumentArrayItem(mutations, itemsPath, section.items, {
                      id: source.id,
                      text: source.label,
                    })
                  }
                }}
                options={available.map((source) => ({
                  id: source.id,
                  label: source.label,
                }))}
              />
            </div>
          )
        }}
      </EntityList>
    </section>
  )
}

export type CvDocumentEditorProps = {
  readonly disabled?: boolean
  readonly document: CvDocumentV1
  readonly issues?: ReadonlyArray<DocumentValidationIssue>
  readonly mutations: DocumentMutationHandlers
  readonly reviewed?: CvAuthoringSource
}

export const CvDocumentEditor = ({
  disabled = false,
  document,
  issues = [],
  mutations,
  reviewed,
}: CvDocumentEditorProps) => (
  <DocumentPaper label="Editable CV">
    <header>
      <ReviewedInlineValue
        label="Name"
        tone="title"
        value={document.person.name}
      />
      <InlineTextField
        className="mt-1"
        disabled={disabled}
        issues={issuesAt(issues, ['person', 'headline'])}
        label="Headline"
        onChange={(value) => mutations.onEdit(['person', 'headline'], value)}
        placeholder="Role-focused professional headline"
        tone="subtitle"
        value={document.person.headline}
      />
      {document.person.location === undefined ? null : (
        <ReviewedInlineValue
          className="mt-0.5"
          label="Location"
          tone="meta"
          value={document.person.location}
        />
      )}
      <ReviewedContactList
        contacts={document.person.contacts}
        disabled={disabled}
        mutations={mutations}
        reviewed={reviewed?.person.contacts}
      />
      <InlineTextField
        className="mt-4"
        disabled={disabled}
        issues={issuesAt(issues, ['person', 'summary'])}
        label="Professional summary"
        multiline
        onChange={(value) => mutations.onEdit(['person', 'summary'], value)}
        placeholder="Write a concise, role-specific professional summary"
        value={document.person.summary}
      />
    </header>
    <ExperienceEditor
      disabled={disabled}
      document={document}
      issues={issues}
      mutations={mutations}
      reviewed={reviewed}
    />
    <ProjectsEditor
      disabled={disabled}
      document={document}
      issues={issues}
      mutations={mutations}
      reviewed={reviewed}
    />
    <SkillsEditor
      disabled={disabled}
      document={document}
      issues={issues}
      mutations={mutations}
      reviewed={reviewed}
    />
    <EducationEditor
      disabled={disabled}
      document={document}
      issues={issues}
      mutations={mutations}
      reviewed={reviewed}
    />
    <AdditionalSectionsEditor
      disabled={disabled}
      document={document}
      issues={issues}
      mutations={mutations}
      reviewed={reviewed}
    />
  </DocumentPaper>
)
