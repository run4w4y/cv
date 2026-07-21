import type { FilterNode } from '@cv/drizzle-query'
import type { EditableFilterCondition, QueryFiltersState } from './model'

/**
 * Converts the subset currently rendered by the flat filter editor back to
 * editor state. The editor supports top-level AND and one top-level AND/OR
 * group; nested and NOT groups remain valid API shapes but are not editable.
 */
export const queryFiltersStateFromFilterNodes = (
  nodes: readonly FilterNode[]
): QueryFiltersState | undefined => {
  if (nodes.every((node) => node.type === 'condition')) {
    return {
      combinator: 'and',
      conditions: nodes as readonly EditableFilterCondition[],
    }
  }
  if (nodes.length !== 1) return undefined
  const [group] = nodes
  if (
    group?.type !== 'group' ||
    group.combinator === 'not' ||
    !group.children.every((node) => node.type === 'condition')
  ) {
    return undefined
  }
  return {
    combinator: group.combinator,
    conditions: group.children as readonly EditableFilterCondition[],
  }
}
