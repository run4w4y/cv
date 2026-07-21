import type { FilterNode } from '../filtering/types'
import {
  maxQueryFilterDepth,
  maxQueryFilterNodes,
  normalizeQueryFilterNodes,
} from '../query-params/filter-nodes'
import {
  formatQueryLanguageIdentifier,
  formatQueryLanguageValue,
  makeQueryLanguageScanner,
  parseQueryLanguageIdentifier,
  parseQueryLanguageValue,
  type QueryLanguageScanner,
} from './literals'
import {
  type QueryLanguageResult,
  queryLanguageFailure,
  queryLanguageSuccess,
} from './types'

type ParsedNode = {
  readonly node: FilterNode
  readonly parenthesized: boolean
}

export const maxCompactFilterLength = 64 * 1024

class FilterExpressionParser {
  readonly scanner: QueryLanguageScanner
  nodeCount = 0

  constructor(input: string) {
    this.scanner = makeQueryLanguageScanner(input)
  }

  fail<Value>(message: string): QueryLanguageResult<Value> {
    return queryLanguageFailure(
      this.scanner.issue({ code: 'unexpected-token', message })
    )
  }

  countNode(): QueryLanguageResult<void> {
    this.nodeCount += 1
    return this.nodeCount > maxQueryFilterNodes
      ? queryLanguageFailure(
          this.scanner.issue({
            code: 'too-many-nodes',
            message: `A filter expression may contain at most ${maxQueryFilterNodes} nodes.`,
          })
        )
      : queryLanguageSuccess(undefined)
  }

  parse(): QueryLanguageResult<readonly FilterNode[]> {
    this.scanner.skipWhitespace()
    if (this.scanner.index === this.scanner.input.length) {
      return queryLanguageFailure({
        code: 'empty-expression',
        message: 'A filter expression cannot be empty.',
        offset: 0,
      })
    }

    const expression = this.parseOr(1)
    if (!expression.ok) return expression
    this.scanner.skipWhitespace()
    if (this.scanner.index !== this.scanner.input.length) {
      return this.fail('Unexpected token after the filter expression.')
    }

    const nodes =
      expression.value.node.type === 'group' &&
      expression.value.node.combinator === 'and' &&
      !expression.value.parenthesized
        ? expression.value.node.children
        : [expression.value.node]
    return normalizeQueryFilterNodes(nodes) === undefined
      ? queryLanguageFailure({
          code: 'expression-too-deep',
          message: `A filter expression may be nested at most ${maxQueryFilterDepth} levels.`,
          offset: 0,
        })
      : queryLanguageSuccess(nodes)
  }

  parseOr(depth: number): QueryLanguageResult<ParsedNode> {
    const first = this.parseAnd(depth)
    if (!first.ok) return first
    const children: FilterNode[] = [first.value.node]
    while (true) {
      this.scanner.skipWhitespace()
      if (this.scanner.input[this.scanner.index] !== '|') break
      this.scanner.index += 1
      const child = this.parseAnd(depth + 1)
      if (!child.ok) return child
      children.push(child.value.node)
    }
    if (children.length === 1) return first
    const counted = this.countNode()
    if (!counted.ok) return counted
    return queryLanguageSuccess({
      node: {
        type: 'group',
        combinator: 'or',
        children: children as [FilterNode, ...FilterNode[]],
      },
      parenthesized: false,
    })
  }

  parseAnd(depth: number): QueryLanguageResult<ParsedNode> {
    const first = this.parseUnary(depth)
    if (!first.ok) return first
    const children: FilterNode[] = [first.value.node]
    while (true) {
      this.scanner.skipWhitespace()
      if (this.scanner.input[this.scanner.index] !== ';') break
      this.scanner.index += 1
      const child = this.parseUnary(depth + 1)
      if (!child.ok) return child
      children.push(child.value.node)
    }
    if (children.length === 1) return first
    const counted = this.countNode()
    if (!counted.ok) return counted
    return queryLanguageSuccess({
      node: {
        type: 'group',
        combinator: 'and',
        children: children as [FilterNode, ...FilterNode[]],
      },
      parenthesized: false,
    })
  }

  parseUnary(depth: number): QueryLanguageResult<ParsedNode> {
    if (depth > maxQueryFilterDepth) {
      return queryLanguageFailure(
        this.scanner.issue({
          code: 'expression-too-deep',
          message: `A filter expression may be nested at most ${maxQueryFilterDepth} levels.`,
        })
      )
    }
    this.scanner.skipWhitespace()
    if (this.scanner.input[this.scanner.index] !== '!') {
      return this.parsePrimary(depth)
    }
    this.scanner.index += 1
    const child = this.parseUnary(depth + 1)
    if (!child.ok) return child
    const counted = this.countNode()
    if (!counted.ok) return counted
    return queryLanguageSuccess({
      node: {
        type: 'group',
        combinator: 'not',
        children: [child.value.node],
      },
      parenthesized: false,
    })
  }

  parsePrimary(depth: number): QueryLanguageResult<ParsedNode> {
    this.scanner.skipWhitespace()
    if (this.scanner.input[this.scanner.index] !== '(') {
      return this.parseCondition()
    }
    this.scanner.index += 1
    const expression = this.parseOr(depth + 1)
    if (!expression.ok) return expression
    this.scanner.skipWhitespace()
    if (this.scanner.input[this.scanner.index] !== ')') {
      return this.fail('Expected ")" to close the filter group.')
    }
    this.scanner.index += 1
    return queryLanguageSuccess({
      node: expression.value.node,
      parenthesized: true,
    })
  }

  parseCondition(): QueryLanguageResult<ParsedNode> {
    const field = parseQueryLanguageIdentifier(this.scanner)
    if (!field.ok) return field
    this.scanner.skipWhitespace()
    if (this.scanner.input[this.scanner.index] !== ':') {
      return this.fail('Expected ":" after the filter field.')
    }
    this.scanner.index += 1
    const operator = parseQueryLanguageIdentifier(this.scanner)
    if (!operator.ok) return operator
    this.scanner.skipWhitespace()

    let node: FilterNode
    if (this.scanner.input[this.scanner.index] === ':') {
      this.scanner.index += 1
      const value = parseQueryLanguageValue(this.scanner)
      if (!value.ok) return value
      node = {
        type: 'condition',
        field: field.value,
        operator: operator.value,
        value: value.value,
      }
    } else {
      node = {
        type: 'condition',
        field: field.value,
        operator: operator.value,
      }
    }

    const counted = this.countNode()
    return counted.ok
      ? queryLanguageSuccess({ node, parenthesized: false })
      : counted
  }
}

/** Parses compact-v1 filter syntax into the existing untrusted FilterNode IR. */
export const parseFilterExpression = (
  input: string
): QueryLanguageResult<readonly FilterNode[]> =>
  input.length > maxCompactFilterLength
    ? queryLanguageFailure({
        code: 'expression-too-large',
        message: `A filter expression may contain at most ${maxCompactFilterLength} characters.`,
        offset: maxCompactFilterLength,
      })
    : new FilterExpressionParser(input).parse()

const nodePrecedence = (node: FilterNode): number => {
  if (node.type === 'condition') return 4
  if (node.combinator === 'not') return 3
  if (node.combinator === 'and') return 2
  return 1
}

const formatNode = (
  node: FilterNode,
  parentPrecedence: number
): QueryLanguageResult<string> => {
  if (node.type === 'condition') {
    const prefix = `${formatQueryLanguageIdentifier(node.field)}:${formatQueryLanguageIdentifier(node.operator)}`
    if (!Object.hasOwn(node, 'value')) return queryLanguageSuccess(prefix)
    const value = formatQueryLanguageValue(node.value)
    return value.ok ? queryLanguageSuccess(`${prefix}:${value.value}`) : value
  }

  if (node.combinator === 'not') {
    const child = formatNode(node.children[0], 0)
    if (!child.ok) return child
    const formatted =
      nodePrecedence(node.children[0]) < nodePrecedence(node)
        ? `!(${child.value})`
        : `!${child.value}`
    return queryLanguageSuccess(
      nodePrecedence(node) < parentPrecedence ? `(${formatted})` : formatted
    )
  }

  const precedence = nodePrecedence(node)
  const children: string[] = []
  for (const child of node.children) {
    const formatted = formatNode(child, precedence + 1)
    if (!formatted.ok) return formatted
    children.push(formatted.value)
  }
  const expression = children.join(node.combinator === 'and' ? ';' : '|')
  return queryLanguageSuccess(
    precedence < parentPrecedence ? `(${expression})` : expression
  )
}

/** Formats FilterNode IR using one deterministic compact-v1 representation. */
export const formatFilterExpression = (
  nodes: readonly FilterNode[]
): QueryLanguageResult<string | undefined> => {
  if (nodes.length === 0) return queryLanguageSuccess(undefined)
  if (normalizeQueryFilterNodes(nodes) === undefined) {
    return queryLanguageFailure({
      code: 'too-many-nodes',
      message: 'The filter tree exceeds the supported structural limits.',
    })
  }

  const formatted: string[] = []
  for (const node of nodes) {
    // A top-level array is already an implicit AND. Parenthesize an explicit
    // group node so parsing cannot accidentally flatten consumer-owned shape.
    const item = formatNode(node, 3)
    if (!item.ok) return item
    formatted.push(item.value)
  }
  const expression = formatted.join(';')
  return expression.length > maxCompactFilterLength
    ? queryLanguageFailure({
        code: 'expression-too-large',
        message: `A filter expression may contain at most ${maxCompactFilterLength} characters.`,
      })
    : queryLanguageSuccess(expression)
}
