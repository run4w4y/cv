import { createInterface } from 'node:readline/promises'
import type { ApplicationIdentityResolution } from '@cv/application-registry-entity'
import { normalizeApplicationCanonicalUrl } from '@cv/application-registry-entity'
import { Effect } from 'effect'
import type { RegistryConflictStrategy } from '../../../config/model'
import { ApplicationCampaignPluginError } from '../../../errors'
import { workflowKey, workflowOutput } from '../../../workflow/graph/key'
import type { WorkflowStep } from '../../../workflow/graph/types'
import { campaignOptionsKey } from '../../../workflow/keys'
import type { ApplicationRegistryCampaignClient } from './client'
import { applicationRegistrySyncStepId } from './sync'

export const applicationRegistryConflictStepId =
  'application-registry.resolve-conflicts'

export type ApplicationRegistryTargetResolution =
  | {
      readonly action: 'capture'
      readonly identityResolution?: ApplicationIdentityResolution
    }
  | { readonly action: 'skip' }

export const applicationRegistryConflictResolutionsKey = workflowKey<
  Readonly<Record<string, ApplicationRegistryTargetResolution>>
>('application-registry.conflict-resolutions')

type ConflictCandidate = {
  readonly company: string
  readonly id: string
  readonly jobKey: string
  readonly role: string
  readonly version: number
}

const pluginError = (message: string, cause?: unknown) =>
  new ApplicationCampaignPluginError({
    cause,
    message,
    pluginId: 'application-registry',
    stage: applicationRegistryConflictStepId,
  })

const existingResolution = (
  strategy: 'merge' | 'replace',
  candidate: ConflictCandidate
): ApplicationRegistryTargetResolution => ({
  action: 'capture',
  identityResolution: {
    applicationId: candidate.id,
    expectedVersion: candidate.version,
    strategy,
  },
})

const promptForResolution = (
  canonicalUrl: string,
  candidates: readonly ConflictCandidate[]
) =>
  Effect.acquireUseRelease(
    Effect.sync(() =>
      createInterface({ input: process.stdin, output: process.stderr })
    ),
    (readline) =>
      Effect.tryPromise({
        try: async () => {
          const choices = candidates.flatMap((candidate) => [
            {
              label: `merge into ${candidate.company} | ${candidate.role} (${candidate.id})`,
              resolution: existingResolution('merge', candidate),
            },
            {
              label: `replace ${candidate.company} | ${candidate.role} (${candidate.id}) with incoming data`,
              resolution: existingResolution('replace', candidate),
            },
          ])
          choices.push(
            {
              label: 'keep both as explicitly distinct opportunities',
              resolution: {
                action: 'capture',
                identityResolution: {
                  reason: 'Explicit interactive campaign decision.',
                  strategy: 'keep-both',
                },
              },
            },
            {
              label: 'skip this registry capture',
              resolution: { action: 'skip' },
            }
          )
          const menu = choices
            .map((choice, index) => `  ${index + 1}. ${choice.label}`)
            .join('\n')
          while (true) {
            const answer = await readline.question(
              `\nApplication registry identity conflict:\n${canonicalUrl}\n${menu}\n  0. abort campaign\nChoose: `
            )
            const index = Number.parseInt(answer.trim(), 10)
            if (index === 0)
              throw new Error('User aborted conflict resolution.')
            const choice = choices[index - 1]
            if (choice) return choice.resolution
          }
        },
        catch: (cause) =>
          pluginError(
            'Application registry conflict resolution was aborted.',
            cause
          ),
      }),
    (readline) => Effect.sync(() => readline.close())
  )

const nonInteractiveResolution = (
  strategy: Exclude<RegistryConflictStrategy, 'prompt'>,
  canonicalUrl: string,
  candidates: readonly ConflictCandidate[]
) => {
  if (strategy === 'abort') {
    return Effect.fail(
      pluginError(
        `Application registry identity conflict for ${canonicalUrl}; rerun with --registry-conflict-strategy or use an interactive terminal.`
      )
    )
  }
  if (strategy === 'skip') {
    return Effect.succeed<ApplicationRegistryTargetResolution>({
      action: 'skip',
    })
  }
  if (strategy === 'keep-both') {
    return Effect.succeed<ApplicationRegistryTargetResolution>({
      action: 'capture',
      identityResolution: {
        reason: 'Explicit campaign CLI strategy.',
        strategy: 'keep-both',
      },
    })
  }
  const candidate = candidates.length === 1 ? candidates[0] : undefined
  return candidate
    ? Effect.succeed(existingResolution(strategy, candidate))
    : Effect.fail(
        pluginError(
          `${strategy} requires exactly one conflict candidate for ${canonicalUrl}; found ${candidates.length}. Use prompt mode.`
        )
      )
}

const resolveConflict = (
  strategy: RegistryConflictStrategy,
  canonicalUrl: string,
  candidates: readonly ConflictCandidate[]
) => {
  if (strategy !== 'prompt') {
    return nonInteractiveResolution(strategy, canonicalUrl, candidates)
  }
  return process.stdin.isTTY && process.stderr.isTTY
    ? promptForResolution(canonicalUrl, candidates)
    : nonInteractiveResolution('abort', canonicalUrl, candidates)
}

export const makeRegistryConflictStep = ({
  client,
}: {
  readonly client: ApplicationRegistryCampaignClient
}): WorkflowStep => ({
  dependsOn: [applicationRegistrySyncStepId],
  execute: ({ outputs }) =>
    Effect.gen(function* () {
      const options = yield* outputs.get(campaignOptionsKey)
      const resolutions: Record<string, ApplicationRegistryTargetResolution> =
        {}
      for (const target of options.targets) {
        const canonicalUrl = normalizeApplicationCanonicalUrl(target.url.href)
        const jobKey = `url:${canonicalUrl}`
        const response = yield* client.list({
          filters: [
            {
              type: 'condition',
              field: 'canonicalUrl',
              operator: 'eq',
              value: canonicalUrl,
            },
          ],
          pagination: { size: 100 },
        })
        if (
          response.items.length === 0 ||
          response.items.some(
            (application) =>
              application.jobKey === jobKey ||
              application.identityAliases.includes(jobKey)
          )
        ) {
          continue
        }
        const candidates = response.items.map((application) => ({
          company: application.company,
          id: application.id,
          jobKey: application.jobKey,
          role: application.role,
          version: application.version,
        }))
        resolutions[canonicalUrl] = yield* resolveConflict(
          options.registryConflictStrategy ?? 'prompt',
          canonicalUrl,
          candidates
        )
      }
      return [
        workflowOutput(applicationRegistryConflictResolutionsKey, resolutions),
      ]
    }),
  failurePolicy: 'fail-run',
  id: applicationRegistryConflictStepId,
  label: 'Resolve application registry identity conflicts',
  scope: 'run',
})
