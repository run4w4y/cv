import { Badge } from '@cv/internal-ui'
import { Check, FileDiff } from 'lucide-react'

import { formatDocumentPath } from './document-utils'
import type { DocumentChange, DocumentValidationIssue } from './types'

const displayValue = (value: unknown): string => {
  if (value === undefined) return 'Not present'
  if (value === null) return 'None'
  if (typeof value === 'string') return value.length === 0 ? 'Empty' : value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `${value.length} ${value.length === 1 ? 'item' : 'items'}`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['title', 'name', 'role', 'label']) {
      if (typeof record[key] === 'string') return record[key]
    }
    return 'Structured content'
  }
  return String(value)
}

const changeVariant = (
  kind: DocumentChange['kind']
): 'danger' | 'success' | 'warning' => {
  switch (kind) {
    case 'added':
      return 'success'
    case 'removed':
      return 'danger'
    case 'changed':
      return 'warning'
  }
}

export const DocumentChangesView = ({
  changes,
  validationIssues,
}: {
  readonly changes: ReadonlyArray<DocumentChange>
  readonly validationIssues: ReadonlyArray<DocumentValidationIssue>
}) => (
  <div className="mx-auto w-full max-w-4xl bg-card px-6 py-8 shadow-sm ring-1 ring-border sm:px-8">
    <div>
      <h2 className="text-lg/7 font-semibold">Draft changes</h2>
      <p className="mt-1 text-sm/6 text-muted-foreground">
        A field-level summary against the saved document.
      </p>
    </div>

    {validationIssues.length === 0 ? null : (
      <section aria-labelledby="validation-heading" className="mt-7">
        <h3
          className="text-xs/5 font-semibold tracking-[0.14em] uppercase"
          id="validation-heading"
        >
          Needs attention
        </h3>
        <ul className="mt-2 divide-y divide-border border-y border-border">
          {validationIssues.map((issue) => (
            <li
              className="grid gap-0.5 py-3"
              key={`${issue.pointer ?? formatDocumentPath(issue.path)}:${issue.message}`}
            >
              <span className="text-xs/5 font-medium text-destructive">
                {formatDocumentPath(issue.path)}
              </span>
              <span className="text-sm/6">{issue.message}</span>
            </li>
          ))}
        </ul>
      </section>
    )}

    <section aria-labelledby="changes-heading" className="mt-7">
      <h3
        className="text-xs/5 font-semibold tracking-[0.14em] uppercase"
        id="changes-heading"
      >
        {changes.length} {changes.length === 1 ? 'change' : 'changes'}
      </h3>
      {changes.length === 0 ? (
        <div className="mt-3 flex items-center gap-3 border-y border-border py-5 text-sm/6 text-muted-foreground">
          <Check className="size-4" />
          The document matches the saved revision.
        </div>
      ) : (
        <ol className="mt-2 divide-y divide-border border-y border-border">
          {changes.map((change) => (
            <li
              className="grid gap-2 py-3 sm:grid-cols-[minmax(9rem,0.45fr)_minmax(0,1fr)]"
              key={JSON.stringify(change.path)}
            >
              <div className="flex min-w-0 items-start gap-2">
                <FileDiff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm/5 font-medium">
                    {formatDocumentPath(change.path)}
                  </p>
                  <Badge className="mt-1" variant={changeVariant(change.kind)}>
                    {change.kind}
                  </Badge>
                </div>
              </div>
              <dl className="grid min-w-0 gap-2 text-xs/5 sm:grid-cols-2">
                {change.kind === 'added' ? null : (
                  <div className="min-w-0">
                    <dt className="font-medium text-muted-foreground">
                      Before
                    </dt>
                    <dd className="mt-0.5 line-clamp-3 whitespace-pre-wrap">
                      {displayValue(change.before)}
                    </dd>
                  </div>
                )}
                {change.kind === 'removed' ? null : (
                  <div className="min-w-0">
                    <dt className="font-medium text-muted-foreground">After</dt>
                    <dd className="mt-0.5 line-clamp-3 whitespace-pre-wrap">
                      {displayValue(change.after)}
                    </dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  </div>
)
