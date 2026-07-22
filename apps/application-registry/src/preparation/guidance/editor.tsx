import {
  type CvFieldGenerationGuidanceV1,
  type CvGenerationGuidanceSource,
  type CvGenerationGuidanceV1,
  cvGenerationGuidanceSourceValues,
  cvGenerationGuidanceTargets,
} from '@cv/contracts/document'
import { Badge, Button, Checkbox, Input, Textarea } from '@cv/internal-ui'
import { RotateCcw } from 'lucide-react'
import type React from 'react'

const guidanceGroups = [
  {
    description: 'Language and text-direction decisions for the document.',
    id: 'document',
    title: 'Document',
  },
  {
    description: 'How the candidate profile and contact details are written.',
    id: 'person',
    title: 'Profile',
  },
  {
    description: 'How employment history and its achievements are presented.',
    id: 'experience',
    title: 'Experience',
  },
  {
    description: 'How selected projects, outcomes, and links are presented.',
    id: 'projects',
    title: 'Projects',
  },
  {
    description: 'How skill groups and individual skills are selected.',
    id: 'skills',
    title: 'Skills',
  },
  {
    description: 'How qualifications and education details are written.',
    id: 'education',
    title: 'Education',
  },
  {
    description: 'How any additional CV sections are populated.',
    id: 'additionalSections',
    title: 'Additional sections',
  },
] as const

const targetById = new Map(
  cvGenerationGuidanceTargets.map((target) => [target.id, target])
)

const sourceLabels = {
  'job-context': 'Job posting',
  literal: 'Literal value',
  'trusted-facts': 'Trusted facts',
} as const satisfies Record<CvGenerationGuidanceSource, string>

const changed = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) !== JSON.stringify(right)

const updateSources = (
  sources: ReadonlyArray<CvGenerationGuidanceSource>,
  source: CvGenerationGuidanceSource,
  checked: boolean
): ReadonlyArray<CvGenerationGuidanceSource> => {
  if (checked) return sources.includes(source) ? sources : [...sources, source]
  return sources.length === 1
    ? sources
    : sources.filter((candidate) => candidate !== source)
}

const SourceBadges = ({
  sources,
}: {
  readonly sources: ReadonlyArray<CvGenerationGuidanceSource>
}) => (
  <div className="flex flex-wrap gap-2">
    {sources.map((source) => (
      <Badge key={source} variant="outline">
        {sourceLabels[source]}
      </Badge>
    ))}
  </div>
)

const SourceEditor = ({
  idPrefix,
  onChange,
  value,
}: {
  readonly idPrefix: string
  readonly onChange: (value: ReadonlyArray<CvGenerationGuidanceSource>) => void
  readonly value: ReadonlyArray<CvGenerationGuidanceSource>
}) => (
  <div className="flex flex-wrap gap-4">
    {cvGenerationGuidanceSourceValues.map((source) => (
      <label
        className="flex items-center gap-2 text-sm"
        htmlFor={`${idPrefix}-${source}`}
        key={source}
      >
        <Checkbox
          checked={value.includes(source)}
          id={`${idPrefix}-${source}`}
          onCheckedChange={(checkedValue) =>
            onChange(updateSources(value, source, checkedValue === true))
          }
        />
        {sourceLabels[source]}
      </label>
    ))}
  </div>
)

const GuidanceValue = ({
  children,
  label,
}: {
  readonly children: React.ReactNode
  readonly label: string
}) => (
  <div className="grid gap-1.5">
    <h3 className="text-sm font-medium">{label}</h3>
    <div className="text-sm/6 text-muted-foreground">{children}</div>
  </div>
)

const FieldGuidance = ({
  base,
  editing,
  field,
  onChange,
}: {
  readonly base: CvFieldGenerationGuidanceV1
  readonly editing: boolean
  readonly field: CvFieldGenerationGuidanceV1
  readonly onChange: (field: CvFieldGenerationGuidanceV1) => void
}) => {
  const target = targetById.get(field.target)
  if (target === undefined) return null
  const isEdited = changed(base, field)
  const idPrefix = `cv-guidance-${field.target}`

  return (
    <div className="grid gap-4 py-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8">
      <div className="flex items-start gap-2">
        <h3 className="text-sm font-medium">{target.title}</h3>
        {isEdited ? <Badge variant="secondary">Edited</Badge> : null}
      </div>
      {editing ? (
        <div className="grid gap-4">
          <label
            className="grid gap-2 text-sm"
            htmlFor={`${idPrefix}-instruction`}
          >
            <span className="font-medium">Instruction</span>
            <Textarea
              className="min-h-24"
              id={`${idPrefix}-instruction`}
              value={field.instruction}
              onChange={(event) =>
                onChange({ ...field, instruction: event.currentTarget.value })
              }
            />
          </label>
          <label
            className="grid max-w-48 gap-2 text-sm"
            htmlFor={`${idPrefix}-max-words`}
          >
            <span className="font-medium">Word limit</span>
            <Input
              id={`${idPrefix}-max-words`}
              max={1_000}
              min={1}
              type="number"
              value={field.maxWords ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber
                if (Number.isNaN(value)) {
                  const { maxWords: _, ...withoutBudget } = field
                  onChange(withoutBudget)
                  return
                }
                onChange({ ...field, maxWords: value })
              }}
            />
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Allowed sources</span>
            <SourceEditor
              idPrefix={`${idPrefix}-source`}
              value={field.sources}
              onChange={(sources) => onChange({ ...field, sources })}
            />
          </div>
          <Button
            className="w-fit"
            disabled={!isEdited}
            size="sm"
            variant="ghost"
            onClick={() => onChange(base)}
          >
            <RotateCcw /> Reset field
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm/6">{field.instruction}</p>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadges sources={field.sources} />
            {field.maxWords === undefined ? null : (
              <Badge variant="secondary">Up to {field.maxWords} words</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const CvGenerationGuidanceEditor = ({
  base,
  editing,
  onChange,
  value,
}: {
  readonly base: CvGenerationGuidanceV1
  readonly editing: boolean
  readonly onChange: (value: CvGenerationGuidanceV1) => void
  readonly value: CvGenerationGuidanceV1
}) => {
  const baseFields = new Map(base.fields.map((field) => [field.target, field]))

  const updateField = (next: CvFieldGenerationGuidanceV1) =>
    onChange({
      ...value,
      fields: value.fields.map((field) =>
        field.target === next.target ? next : field
      ),
    })

  return (
    <div className="grid gap-10">
      <section aria-labelledby="overall-guidance" className="grid gap-5">
        <div className="grid gap-1">
          <h2 id="overall-guidance" className="text-base font-semibold">
            Overall guidance
          </h2>
          <p className="text-sm/6 text-muted-foreground">
            Instructions and evidence rules that apply to the entire CV.
          </p>
        </div>

        {editing ? (
          <div className="grid gap-5">
            <label
              className="grid max-w-xl gap-2 text-sm"
              htmlFor="cv-guidance-label"
            >
              <span className="font-medium">Guidance name</span>
              <Input
                id="cv-guidance-label"
                value={value.label}
                onChange={(event) =>
                  onChange({ ...value, label: event.currentTarget.value })
                }
              />
            </label>
            <label
              className="grid gap-2 text-sm"
              htmlFor="cv-guidance-instruction"
            >
              <span className="font-medium">Overall instruction</span>
              <Textarea
                className="min-h-28"
                id="cv-guidance-instruction"
                value={value.instruction}
                onChange={(event) =>
                  onChange({
                    ...value,
                    instruction: event.currentTarget.value,
                  })
                }
              />
            </label>
            <label className="grid gap-2 text-sm" htmlFor="cv-guidance-rules">
              <span className="font-medium">Rules, one per line</span>
              <Textarea
                className="min-h-32"
                id="cv-guidance-rules"
                value={value.rules.join('\n')}
                onChange={(event) =>
                  onChange({
                    ...value,
                    rules: event.currentTarget.value
                      .split('\n')
                      .map((rule) => rule.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Allowed sources</span>
              <SourceEditor
                idPrefix="cv-guidance-global-source"
                value={value.sources}
                onChange={(sources) => onChange({ ...value, sources })}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <GuidanceValue label="Guidance name">{value.label}</GuidanceValue>
            <GuidanceValue label="Allowed sources">
              <SourceBadges sources={value.sources} />
            </GuidanceValue>
            <div className="lg:col-span-2">
              <GuidanceValue label="Overall instruction">
                <p>{value.instruction}</p>
              </GuidanceValue>
            </div>
            <div className="lg:col-span-2">
              <GuidanceValue label="Rules">
                <ul className="grid list-disc gap-1 pl-5">
                  {value.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </GuidanceValue>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-10">
        {guidanceGroups.map((group) => {
          const fields = value.fields.filter(
            (field) => field.target.split('.')[0] === group.id
          )
          if (fields.length === 0) return null

          return (
            <section
              aria-labelledby={`guidance-group-${group.id}`}
              className="grid gap-2"
              key={group.id}
            >
              <div className="grid gap-1">
                <h2
                  id={`guidance-group-${group.id}`}
                  className="text-base font-semibold"
                >
                  {group.title}
                </h2>
                <p className="text-sm/6 text-muted-foreground">
                  {group.description}
                </p>
              </div>
              <div className="divide-y divide-border/60">
                {fields.map((field) => {
                  const baseField = baseFields.get(field.target)
                  return baseField === undefined ? null : (
                    <FieldGuidance
                      base={baseField}
                      editing={editing}
                      field={field}
                      key={field.target}
                      onChange={updateField}
                    />
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
