import type { FilterNode } from '../filtering/types'

export const maxCanonicalQueryFiltersLength = 64 * 1024
export const maxQueryFilterNodes = 100
export const maxQueryFilterDepth = 12

type PendingFilterNode = {
  readonly value: unknown
  readonly depth: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFilterNodeArray = (value: unknown): value is readonly FilterNode[] => {
  if (!Array.isArray(value) || value.length > maxQueryFilterNodes) return false

  const pending: PendingFilterNode[] = value.map((node) => ({
    value: node,
    depth: 1,
  }))
  let nodeCount = 0

  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) return false

    nodeCount += 1
    if (
      nodeCount > maxQueryFilterNodes ||
      current.depth > maxQueryFilterDepth ||
      !isRecord(current.value)
    ) {
      return false
    }

    if (current.value.type === 'condition') {
      if (
        typeof current.value.field !== 'string' ||
        typeof current.value.operator !== 'string'
      ) {
        return false
      }
      continue
    }

    if (
      current.value.type !== 'group' ||
      !Array.isArray(current.value.children) ||
      current.value.children.length === 0 ||
      (current.value.combinator === 'not'
        ? current.value.children.length !== 1
        : current.value.combinator !== 'and' &&
          current.value.combinator !== 'or') ||
      nodeCount + pending.length + current.value.children.length >
        maxQueryFilterNodes
    ) {
      return false
    }

    for (const child of current.value.children) {
      pending.push({ value: child, depth: current.depth + 1 })
    }
  }

  return true
}

/** Validates an already-decoded canonical filter payload structurally. */
export const normalizeQueryFilterNodes = (
  value: unknown
): readonly FilterNode[] | undefined =>
  isFilterNodeArray(value) ? value : undefined

/** Parses the canonical `filters=<JSON FilterNode[]>` wire value. */
export const parseQueryFilterNodes = (
  value: string | null | undefined
): readonly FilterNode[] | undefined => {
  if (value === null || value === undefined) return undefined
  if (value.length > maxCanonicalQueryFiltersLength) return undefined
  try {
    return normalizeQueryFilterNodes(JSON.parse(value))
  } catch {
    return undefined
  }
}

/** Serializes filter nodes exactly as the query protocol expects them. */
export const serializeQueryFilterNodes = (
  nodes: readonly FilterNode[]
): string | undefined =>
  nodes.length === 0
    ? undefined
    : JSON.stringify(nodes, (_, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value
      )
