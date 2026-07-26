import type {
  DocumentChange,
  DocumentMutationHandlers,
  DocumentPath,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const equalPrimitive = (left: unknown, right: unknown): boolean =>
  Object.is(left, right)

const collectChanges = (
  before: unknown,
  after: unknown,
  path: DocumentPath,
  changes: Array<DocumentChange>
): void => {
  if (equalPrimitive(before, after)) return

  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length)
    for (let index = 0; index < length; index += 1) {
      if (index >= before.length) {
        changes.push({
          after: after[index],
          before: undefined,
          kind: 'added',
          path: [...path, index],
        })
      } else if (index >= after.length) {
        changes.push({
          after: undefined,
          before: before[index],
          kind: 'removed',
          path: [...path, index],
        })
      } else {
        collectChanges(before[index], after[index], [...path, index], changes)
      }
    }
    return
  }

  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of keys) {
      if (!(key in before)) {
        changes.push({
          after: after[key],
          before: undefined,
          kind: 'added',
          path: [...path, key],
        })
      } else if (!(key in after)) {
        changes.push({
          after: undefined,
          before: before[key],
          kind: 'removed',
          path: [...path, key],
        })
      } else {
        collectChanges(before[key], after[key], [...path, key], changes)
      }
    }
    return
  }

  changes.push({
    after,
    before,
    kind:
      before === undefined
        ? 'added'
        : after === undefined
          ? 'removed'
          : 'changed',
    path,
  })
}

export const documentChanges = (
  before: unknown,
  after: unknown
): ReadonlyArray<DocumentChange> => {
  const changes: Array<DocumentChange> = []
  collectChanges(before, after, [], changes)
  return changes
}

export const updateDocumentAtPath = (
  document: unknown,
  path: DocumentPath,
  value: unknown
): unknown => {
  if (path.length === 0) return value
  const [segment, ...remaining] = path

  if (typeof segment === 'number') {
    const next = Array.isArray(document) ? [...document] : []
    next[segment] = updateDocumentAtPath(next[segment], remaining, value)
    return next
  }

  const next = isRecord(document) ? { ...document } : {}
  next[segment] = updateDocumentAtPath(next[segment], remaining, value)
  return next
}

export const removeDocumentAtPath = (
  document: unknown,
  path: DocumentPath
): unknown => {
  if (path.length === 0) return undefined
  const [segment, ...remaining] = path

  if (typeof segment === 'number') {
    if (!Array.isArray(document)) return document
    const next = [...document]
    if (remaining.length === 0) {
      next.splice(segment, 1)
    } else {
      next[segment] = removeDocumentAtPath(next[segment], remaining)
    }
    return next
  }

  if (!isRecord(document)) return document
  const next = { ...document }
  if (remaining.length === 0) {
    delete next[segment]
  } else {
    next[segment] = removeDocumentAtPath(next[segment], remaining)
  }
  return next
}

export const addDocumentArrayItem = (
  handlers: DocumentMutationHandlers,
  path: DocumentPath,
  current: ReadonlyArray<unknown>,
  value: unknown,
  index = current.length
): void => {
  if (handlers.onAdd !== undefined) {
    handlers.onAdd(path, value, index)
    return
  }
  const next = [...current]
  next.splice(index, 0, value)
  handlers.onEdit(path, next)
}

export const removeDocumentArrayItem = (
  handlers: DocumentMutationHandlers,
  path: DocumentPath,
  current: ReadonlyArray<unknown>,
  index: number
): void => {
  if (handlers.onRemove !== undefined) {
    handlers.onRemove(path, index)
    return
  }
  handlers.onEdit(
    path,
    current.filter((_, itemIndex) => itemIndex !== index)
  )
}

export const moveDocumentArrayItem = (
  handlers: DocumentMutationHandlers,
  path: DocumentPath,
  current: ReadonlyArray<unknown>,
  fromIndex: number,
  toIndex: number
): void => {
  if (fromIndex === toIndex || toIndex < 0 || toIndex >= current.length) return
  if (handlers.onMove !== undefined) {
    handlers.onMove(path, fromIndex, toIndex)
    return
  }
  const next = [...current]
  const [item] = next.splice(fromIndex, 1)
  if (item === undefined) return
  next.splice(toIndex, 0, item)
  handlers.onEdit(path, next)
}

const fieldLabels: Readonly<Record<string, string>> = {
  additionalSections: 'Additional sections',
  body: 'Letter',
  company: 'Company',
  contacts: 'Contact details',
  details: 'Details',
  education: 'Education',
  experience: 'Experience',
  experienceDuration: 'Experience duration',
  headline: 'Headline',
  highlights: 'Highlights',
  institution: 'Institution',
  items: 'Items',
  label: 'Label',
  links: 'Links',
  location: 'Location',
  name: 'Name',
  period: 'Period',
  person: 'Profile',
  projects: 'Projects',
  qualification: 'Qualification',
  role: 'Role',
  skills: 'Skills',
  summary: 'Summary',
  technologies: 'Technologies',
  text: 'Text',
  title: 'Title',
  value: 'Value',
}

export const formatDocumentPath = (path: DocumentPath): string => {
  if (path.length === 0) return 'Document'
  return path
    .filter((segment) => segment !== '$schema' && segment !== 'id')
    .map((segment) =>
      typeof segment === 'number'
        ? String(segment + 1)
        : (fieldLabels[segment] ?? segment)
    )
    .join(' · ')
}
