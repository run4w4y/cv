import { createInterface } from 'node:readline/promises'
import type {
  ListApplicationsQuery,
  ListApplicationsResponse,
} from '@cv/application-registry-api-contract'
import { normalizeApplicationCanonicalUrl } from '@cv/application-registry-entity'
import { Console, Effect } from 'effect'
import { Flag } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../client'
import { ApplicationRegistryCliInputError } from './input'
import { printJson } from './output'

type ApplicationItem = ListApplicationsResponse['items'][number]

export const registryDeduplicationStrategies = [
  'prompt',
  'keep-newest',
  'keep-oldest',
  'keep-both',
] as const

export type RegistryDeduplicationStrategy =
  (typeof registryDeduplicationStrategies)[number]

export type RegistryDuplicateGroup = {
  readonly canonicalUrl: string
  readonly applications: readonly ApplicationItem[]
}

export type RegistryDeduplicationDecision = {
  readonly canonicalUrl: string
  readonly delete: readonly ApplicationItem[]
  readonly keep: readonly ApplicationItem[]
  readonly strategy:
    | Exclude<RegistryDeduplicationStrategy, 'prompt'>
    | 'selected'
}

export type RegistryDeduplicationResult = {
  readonly decisions: readonly RegistryDeduplicationDecision[]
  readonly deleted: readonly string[]
  readonly dryRun: boolean
  readonly duplicateGroups: number
}

export const findRegistryDuplicateGroups = (
  applications: readonly ApplicationItem[]
): readonly RegistryDuplicateGroup[] => {
  const grouped = new Map<string, ApplicationItem[]>()
  for (const application of applications) {
    const canonicalUrl = normalizeApplicationCanonicalUrl(
      application.canonicalUrl
    )
    const group = grouped.get(canonicalUrl) ?? []
    group.push(application)
    grouped.set(canonicalUrl, group)
  }
  return [...grouped.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([canonicalUrl, group]) => ({
      applications: group.toSorted((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
      ),
      canonicalUrl,
    }))
    .toSorted((left, right) =>
      left.canonicalUrl.localeCompare(right.canonicalUrl)
    )
}

export const decideRegistryDuplicateGroup = (
  group: RegistryDuplicateGroup,
  strategy: Exclude<RegistryDeduplicationStrategy, 'prompt'>
): RegistryDeduplicationDecision => {
  if (strategy === 'keep-both') {
    return {
      canonicalUrl: group.canonicalUrl,
      delete: [],
      keep: group.applications,
      strategy,
    }
  }
  const sorted = group.applications.toSorted((left, right) => {
    const created = left.createdAt.localeCompare(right.createdAt)
    return created === 0 ? left.id.localeCompare(right.id) : created
  })
  const survivor = strategy === 'keep-newest' ? sorted.at(-1) : sorted[0]
  if (!survivor) {
    return {
      canonicalUrl: group.canonicalUrl,
      delete: [],
      keep: [],
      strategy,
    }
  }
  return {
    canonicalUrl: group.canonicalUrl,
    delete: sorted.filter((application) => application.id !== survivor.id),
    keep: [survivor],
    strategy,
  }
}

const listAllApplications = Effect.gen(function* () {
  const client = yield* ApplicationRegistryClient
  const query = (after?: string): ListApplicationsQuery => ({
    pagination: { after, size: 100 },
  })
  const first = yield* client.list(query())
  const items = [...first.items]
  let cursor = first.pageInfo.nextCursor
  while (cursor !== null) {
    const page = yield* client.list(query(cursor))
    items.push(...page.items)
    cursor = page.pageInfo.nextCursor
  }
  return items
})

const promptForDuplicateDecision = (group: RegistryDuplicateGroup) =>
  Effect.acquireUseRelease(
    Effect.sync(() =>
      createInterface({ input: process.stdin, output: process.stderr })
    ),
    (readline) =>
      Effect.tryPromise({
        try: async () => {
          const menu = group.applications
            .map(
              (application, index) =>
                `  ${index + 1}. keep ${application.company} | ${application.role} (${application.id}, created ${application.createdAt})`
            )
            .join('\n')
          while (true) {
            const answer = await readline.question(
              `\nDuplicate application records:\n${group.canonicalUrl}\n${menu}\n  b. keep both\n  q. abort\nChoose: `
            )
            const choice = answer.trim().toLowerCase()
            if (choice === 'q') throw new Error('Deduplication aborted.')
            if (choice === 'b') {
              return decideRegistryDuplicateGroup(group, 'keep-both')
            }
            const survivor = group.applications[Number.parseInt(choice, 10) - 1]
            if (survivor) {
              return {
                canonicalUrl: group.canonicalUrl,
                delete: group.applications.filter(
                  (application) => application.id !== survivor.id
                ),
                keep: [survivor],
                strategy: 'selected' as const,
              }
            }
          }
        },
        catch: (cause) =>
          new ApplicationRegistryCliInputError({
            message:
              cause instanceof Error
                ? cause.message
                : 'Deduplication was aborted.',
          }),
      }),
    (readline) => Effect.sync(() => readline.close())
  )

export const registryDeduplicationFlags = {
  dryRun: Flag.boolean('dry-run').pipe(
    Flag.withDescription('Show decisions without deleting any records.')
  ),
  json: Flag.boolean('json').pipe(
    Flag.withDescription('Print machine-readable JSON.')
  ),
  strategy: Flag.choice('strategy', registryDeduplicationStrategies).pipe(
    Flag.withDefault('prompt'),
    Flag.withDescription(
      'Resolve each group interactively or keep its newest, oldest, or both records.'
    )
  ),
  yes: Flag.boolean('yes').pipe(
    Flag.withDescription('Confirm deletion after resolving every conflict.')
  ),
}

export const runRegistryDeduplication = (options: {
  readonly dryRun: boolean
  readonly json: boolean
  readonly strategy: RegistryDeduplicationStrategy
  readonly yes: boolean
}) =>
  Effect.gen(function* () {
    const applications = yield* listAllApplications
    const groups = findRegistryDuplicateGroups(applications)
    if (
      options.strategy === 'prompt' &&
      groups.length > 0 &&
      !process.stdin.isTTY
    ) {
      return yield* new ApplicationRegistryCliInputError({
        message:
          'Prompt strategy requires an interactive terminal; choose --strategy or rerun interactively.',
      })
    }
    const decisions: RegistryDeduplicationDecision[] = []
    for (const group of groups) {
      decisions.push(
        yield* options.strategy === 'prompt'
          ? promptForDuplicateDecision(group)
          : Effect.succeed(
              decideRegistryDuplicateGroup(group, options.strategy)
            )
      )
    }
    const pendingDeletes = decisions.flatMap((decision) => decision.delete)
    if (!options.dryRun && pendingDeletes.length > 0 && !options.yes) {
      return yield* new ApplicationRegistryCliInputError({
        message:
          'Refusing to delete duplicate records without --yes. Use --dry-run to inspect the plan.',
      })
    }
    const deleted: string[] = []
    if (!options.dryRun) {
      const client = yield* ApplicationRegistryClient
      for (const application of pendingDeletes) {
        yield* client.remove(application.id, application.version)
        deleted.push(application.id)
      }
    }
    const result: RegistryDeduplicationResult = {
      decisions,
      deleted,
      dryRun: options.dryRun,
      duplicateGroups: groups.length,
    }
    yield* options.json
      ? printJson(result)
      : Console.log(
          groups.length === 0
            ? 'No duplicate canonical URLs found.'
            : `${groups.length} duplicate group(s); ${pendingDeletes.length} record(s) ${options.dryRun ? 'would be deleted' : 'deleted'}.`
        )
    return result
  })
