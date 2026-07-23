import { describe, expect, test } from 'bun:test'
import { makeInMemoryArtifactStoreLayer } from '@cv/application-registry-artifact-store/test-support'
import {
  ArtifactsCrud,
  ContentCrud,
  CvLinksCrud,
  JobPostingSnapshotsCrud,
  type PersistedContentEntry,
  type PersistedCvLink,
  type PersistedGeneratedArtifact,
  type PersistedJobPostingSnapshot,
} from '@cv/application-registry-crud'
import {
  type ApplicationStatus,
  type ContentEntry,
  type ContentRevision,
  type CvLink,
  type GeneratedArtifact,
  type JobPostingSnapshot,
  pdfGenerationFailedDisableReason,
} from '@cv/application-registry-entity'
import {
  RegistryEventPublishError,
  RegistryEventPublisher,
  RegistryEventPublisherNoop,
  RegistryEventSchema,
} from '@cv/application-registry-events'
import { Effect, Layer } from 'effect'

import { application } from '../../test/support/fixtures'
import { applicationsCrudLayer } from '../../test/support/layers'
import {
  ContentEntriesService,
  CvPublicationConfiguration,
  CvPublicationsService,
  JobPostingSnapshotsService,
  PdfArtifactsService,
} from '../services'
import { RegistryContentServicesLive } from './layers'

const ensurePdfAttempt = (
  applicationId: string,
  contentEntryId: string,
  input: {
    readonly eventId: string
    readonly expectedPublicationVersion: number
  }
) =>
  Effect.gen(function* () {
    const publications = yield* CvPublicationsService
    const pdfs = yield* PdfArtifactsService
    const link = yield* publications.findByEntry(applicationId, contentEntryId)
    return yield* pdfs.ensureAttempt(
      RegistryEventSchema.cases.PdfGenerationRequested.make({
        applicationId,
        contentEntryId,
        contentRevisionId: link.currentRevisionId,
        correlationId: input.eventId,
        cvLinkId: link.id,
        eventId: input.eventId,
        occurredAt: link.updatedAt,
        publicationVersion: input.expectedPublicationVersion,
        version: 1,
      })
    )
  })

type MemoryState = {
  applicationStatus: ApplicationStatus
  allowLinkAvailabilityRepair: boolean
  beforeLinkStage?: () => void
  beforeFailedArtifactDisable?: () => void
  readonly artifacts: Map<string, GeneratedArtifact>
  readonly entries: Map<string, ContentEntry>
  readonly links: Map<string, CvLink>
  readonly revisions: Map<string, ContentRevision>
  readonly snapshots: Map<string, JobPostingSnapshot>
}

const makeMemoryCrudLayer = () => {
  const state: MemoryState = {
    applicationStatus: application.applicationStatus,
    allowLinkAvailabilityRepair: true,
    artifacts: new Map(),
    entries: new Map(),
    links: new Map(),
    revisions: new Map(),
    snapshots: new Map(),
  }

  const contentCrud: ContentCrud = {
    approve: (entryId, revisionId, expectedVersion, updatedAt) =>
      Effect.sync(() => {
        const entry = state.entries.get(entryId)
        const revision = state.revisions.get(revisionId)
        if (
          !entry ||
          !revision ||
          revision.contentEntryId !== entry.id ||
          entry.version !== expectedVersion
        ) {
          return false
        }
        state.entries.set(entry.id, {
          ...entry,
          approvedRevisionId: revision.id,
          state: 'approved',
          updatedAt,
          version: entry.version + 1,
        })
        return true
      }),
    appendRevision: (revision, expectedVersion, updatedAt) =>
      Effect.sync(() => {
        const entry = state.entries.get(revision.contentEntryId)
        if (
          !entry ||
          entry.version !== expectedVersion ||
          entry.headRevisionId !== revision.parentRevisionId
        ) {
          return false
        }
        state.revisions.set(revision.id, revision)
        state.entries.set(entry.id, {
          ...entry,
          headRevisionId: revision.id,
          state: 'draft',
          updatedAt,
          version: entry.version + 1,
        })
        return true
      }),
    createEntry: (input: PersistedContentEntry) =>
      Effect.sync(() => {
        const existing = [...state.entries.values()].find(
          (entry) =>
            entry.applicationId === input.applicationId &&
            entry.kind === input.kind &&
            entry.locale === input.locale
        )
        if (!existing) {
          state.entries.set(input.id, {
            ...input,
            approvedRevisionId: null,
            headRevisionId: null,
            state: 'draft',
            version: 1,
          })
        }
      }),
    findEntry: (id) => Effect.succeed(state.entries.get(id)),
    findEntryByApplication: (applicationId, kind, locale) =>
      Effect.succeed(
        [...state.entries.values()].find(
          (entry) =>
            entry.applicationId === applicationId &&
            entry.kind === kind &&
            entry.locale === locale
        )
      ),
    findRevision: (id) => Effect.succeed(state.revisions.get(id)),
    listRevisions: (entryId) =>
      Effect.succeed(
        [...state.revisions.values()]
          .filter(({ contentEntryId }) => contentEntryId === entryId)
          .sort((left, right) => left.revisionNumber - right.revisionNumber)
      ),
  }

  const snapshotsCrud: JobPostingSnapshotsCrud = {
    find: (id) => Effect.succeed(state.snapshots.get(id)),
    latest: (applicationId) =>
      Effect.succeed(
        [...state.snapshots.values()]
          .filter((snapshot) => snapshot.applicationId === applicationId)
          .sort((left, right) =>
            right.fetchedAt.localeCompare(left.fetchedAt)
          )[0]
      ),
    persist: (snapshot: PersistedJobPostingSnapshot) =>
      Effect.sync(() => {
        if (!state.snapshots.has(snapshot.id)) {
          state.snapshots.set(snapshot.id, snapshot)
        }
      }),
  }

  const linksCrud: CvLinksCrud = {
    disableForFailedArtifact: (
      id,
      expectedVersion,
      artifact,
      reason,
      disabledAt
    ) =>
      Effect.sync(() => {
        const beforeDisable = state.beforeFailedArtifactDisable
        state.beforeFailedArtifactDisable = undefined
        beforeDisable?.()

        const link = state.links.get(id)
        const failed = state.artifacts.get(artifact.id)
        const current = [...state.artifacts.values()]
          .filter(
            (candidate) =>
              candidate.cvLinkId === artifact.cvLinkId &&
              candidate.contentRevisionId === artifact.contentRevisionId &&
              candidate.publicationVersion === artifact.publicationVersion &&
              candidate.qrTarget === artifact.qrTarget
          )
          .at(-1)
        if (
          !link?.enabled ||
          link.version !== expectedVersion ||
          link.currentRevisionId !== artifact.contentRevisionId ||
          link.publicationVersion !== artifact.publicationVersion ||
          link.publicUrl !== artifact.qrTarget ||
          failed?.status !== 'failed' ||
          current?.id !== artifact.id
        ) {
          return false
        }
        state.links.set(id, {
          ...link,
          disabledAt,
          disabledReason: reason,
          enabled: false,
          updatedAt: disabledAt,
          version: link.version + 1,
        })
        return true
      }),
    disableForApplication: (applicationId, reason, disabledAt) =>
      Effect.sync(() => {
        if (!state.allowLinkAvailabilityRepair) return 0
        let count = 0
        for (const [id, link] of state.links) {
          if (link.applicationId === applicationId && link.enabled) {
            state.links.set(id, {
              ...link,
              disabledAt,
              disabledReason: reason,
              enabled: false,
              updatedAt: disabledAt,
              version: link.version + 1,
            })
            count += 1
          }
        }
        return count
      }),
    enableForApplication: (applicationId, disabledReason, updatedAt) =>
      Effect.sync(() => {
        if (!state.allowLinkAvailabilityRepair) return 0
        let count = 0
        for (const [id, link] of state.links) {
          if (
            link.applicationId === applicationId &&
            !link.enabled &&
            link.disabledReason === disabledReason
          ) {
            state.links.set(id, {
              ...link,
              disabledAt: null,
              disabledReason: null,
              enabled: true,
              updatedAt,
              version: link.version + 1,
            })
            count += 1
          }
        }
        return count
      }),
    findByEntry: (entryId) =>
      Effect.succeed(
        [...state.links.values()].find(
          ({ contentEntryId }) => contentEntryId === entryId
        )
      ),
    findByApplication: (applicationId) =>
      Effect.succeed(
        [...state.links.values()].filter(
          (link) => link.applicationId === applicationId
        )
      ),
    findByToken: (token) =>
      Effect.succeed(
        [...state.links.values()].find((link) => link.token === token)
      ),
    stage: (input: PersistedCvLink, expectedContentVersion: number) =>
      Effect.sync(() => {
        const beforeStage = state.beforeLinkStage
        state.beforeLinkStage = undefined
        beforeStage?.()

        const entry = state.entries.get(input.contentEntryId)
        if (
          !entry ||
          entry.applicationId !== input.applicationId ||
          entry.version !== expectedContentVersion
        ) {
          return false
        }

        const existing = [...state.links.values()].find(
          ({ contentEntryId }) => contentEntryId === input.contentEntryId
        )
        if (
          existing !== undefined &&
          (existing.applicationId !== input.applicationId ||
            existing.id !== input.id ||
            existing.token !== input.token)
        ) {
          return false
        }
        if (
          existing?.applicationId === input.applicationId &&
          existing.currentRevisionId === input.currentRevisionId &&
          existing.publicUrl === input.publicUrl
        ) {
          return true
        }
        if (existing) {
          state.links.set(existing.id, {
            ...existing,
            currentRevisionId: input.currentRevisionId,
            disabledAt: input.updatedAt,
            disabledReason: 'draft_revision',
            enabled: false,
            previewToken: input.previewToken,
            publicUrl: input.publicUrl,
            publicationVersion: existing.publicationVersion + 1,
            updatedAt: input.updatedAt,
            version: existing.version + 1,
          })
        } else {
          state.links.set(input.id, {
            ...input,
            disabledAt: input.updatedAt,
            disabledReason: 'draft_revision',
            enabled: false,
            publicationVersion: 1,
            version: 1,
          })
        }
        return true
      }),
    setEnabled: (
      id,
      expectedVersion,
      expectedPublicationVersion,
      enabled,
      reason,
      updatedAt
    ) =>
      Effect.sync(() => {
        const link = state.links.get(id)
        if (
          !link ||
          link.version !== expectedVersion ||
          link.publicationVersion !== expectedPublicationVersion
        ) {
          return false
        }
        state.links.set(id, {
          ...link,
          disabledAt: enabled ? null : updatedAt,
          disabledReason: enabled ? null : reason,
          enabled,
          updatedAt,
          version: link.version + 1,
        })
        return true
      }),
  }

  const artifactsCrud: ArtifactsCrud = {
    find: (id) => Effect.succeed(state.artifacts.get(id)),
    findByRequestId: (requestId) =>
      Effect.succeed(
        [...state.artifacts.values()].find(
          (artifact) => artifact.requestId === requestId
        )
      ),
    findCurrentForPublication: (
      cvLinkId,
      revisionId,
      rendererVersion,
      publicationVersion,
      qrTarget
    ) =>
      Effect.succeed(
        [...state.artifacts.values()]
          .filter(
            (artifact) =>
              artifact.cvLinkId === cvLinkId &&
              artifact.contentRevisionId === revisionId &&
              (rendererVersion === null ||
                artifact.rendererVersion === rendererVersion) &&
              artifact.publicationVersion === publicationVersion &&
              artifact.qrTarget === qrTarget
          )
          .at(-1)
      ),
    findReadyForPublication: (
      cvLinkId,
      revisionId,
      rendererVersion,
      publicationVersion,
      qrTarget
    ) =>
      Effect.succeed(
        [...state.artifacts.values()].find(
          (artifact) =>
            artifact.cvLinkId === cvLinkId &&
            artifact.contentRevisionId === revisionId &&
            (rendererVersion === null ||
              artifact.rendererVersion === rendererVersion) &&
            artifact.publicationVersion === publicationVersion &&
            artifact.qrTarget === qrTarget &&
            artifact.status === 'ready'
        )
      ),
    markFailed: (id, errorCode, errorMessage, updatedAt) =>
      Effect.sync(() => {
        const artifact = state.artifacts.get(id)
        if (artifact?.status !== 'pending') return false
        state.artifacts.set(id, {
          ...artifact,
          errorCode,
          errorMessage,
          status: 'failed',
          updatedAt,
        })
        return true
      }),
    markReady: (artifact: PersistedGeneratedArtifact) =>
      Effect.sync(() => {
        const existing = state.artifacts.get(artifact.id)
        const link = state.links.get(artifact.cvLinkId)
        if (
          existing?.status !== 'pending' ||
          !link ||
          link.publicationVersion !== artifact.publicationVersion ||
          link.publicUrl !== artifact.qrTarget ||
          link.currentRevisionId !== artifact.contentRevisionId
        ) {
          return false
        }
        state.artifacts.set(artifact.id, artifact)
        return true
      }),
    persistPending: (
      artifact: PersistedGeneratedArtifact,
      expectedLinkVersion
    ) =>
      Effect.sync(() => {
        const link = state.links.get(artifact.cvLinkId)
        const existing = [...state.artifacts.values()].find(
          (candidate) => candidate.requestId === artifact.requestId
        )
        if (
          !existing &&
          link?.version === expectedLinkVersion &&
          link.currentRevisionId === artifact.contentRevisionId &&
          link.publicationVersion === artifact.publicationVersion &&
          link.publicUrl === artifact.qrTarget
        ) {
          state.artifacts.set(artifact.id, artifact)
        }
      }),
  }

  const layer = Layer.mergeAll(
    applicationsCrudLayer({
      findByIdentifier: (identifier) =>
        Effect.succeed(
          identifier === application.id
            ? { ...application, applicationStatus: state.applicationStatus }
            : undefined
        ),
    }),
    Layer.succeed(ContentCrud, contentCrud),
    Layer.succeed(JobPostingSnapshotsCrud, snapshotsCrud),
    Layer.succeed(CvLinksCrud, linksCrud),
    Layer.succeed(ArtifactsCrud, artifactsCrud)
  )

  return { layer, state }
}

const makeHarness = (eventPublisherLayer = RegistryEventPublisherNoop) => {
  const memory = makeMemoryCrudLayer()
  const live = RegistryContentServicesLive.pipe(
    Layer.provide(memory.layer),
    Layer.provide(makeInMemoryArtifactStoreLayer()),
    Layer.provide(eventPublisherLayer),
    Layer.provide(
      Layer.succeed(
        CvPublicationConfiguration,
        CvPublicationConfiguration.of({
          publicBaseUrl: new URL('https://cv.example.test/c/'),
        })
      )
    )
  )
  const run = <A, E>(
    effect: Effect.Effect<
      A,
      E,
      | ContentEntriesService
      | CvPublicationsService
      | JobPostingSnapshotsService
      | PdfArtifactsService
    >
  ) => Effect.runPromise(effect.pipe(Effect.provide(live)))
  return { run, state: memory.state }
}

const appendInput = (
  bytes: Uint8Array,
  expectedVersion: number,
  operationId: string
) => ({
  contractId: 'cv.document',
  contractVersion: '1',
  expectedVersion,
  operationId,
  payload: { bytes, mediaType: 'application/json' },
  source: 'human' as const,
})

describe('content domain services', () => {
  test('keeps independently authored locale entries for one application', async () => {
    const { run } = makeHarness()
    const entries = await run(
      ContentEntriesService.use((service) =>
        Effect.all([
          service.ensure(application.id, { kind: 'cv', locale: 'en' }),
          service.ensure(application.id, { kind: 'cv', locale: 'ru' }),
        ])
      )
    )

    expect(entries.map(({ locale }) => locale)).toEqual(['en', 'ru'])
    expect(entries[0]?.id).not.toBe(entries[1]?.id)
  })

  test('keeps opaque revisions linear and approves only the current head', async () => {
    const { run } = makeHarness()
    const firstBytes = new TextEncoder().encode(
      JSON.stringify({ arbitrary: { document: ['shape', 1] } })
    )
    const secondBytes = new TextEncoder().encode(
      JSON.stringify({ completely: ['different', { shape: true }] })
    )

    const result = await run(
      Effect.gen(function* () {
        const service = yield* ContentEntriesService
        const entry = yield* service.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const first = yield* service.appendRevision(
          application.id,
          entry.id,
          appendInput(firstBytes, entry.version, 'revision-operation-1')
        )
        const stale = yield* Effect.flip(
          service.appendRevision(
            application.id,
            entry.id,
            appendInput(secondBytes, entry.version, 'stale-operation')
          )
        )
        const second = yield* service.appendRevision(
          application.id,
          entry.id,
          appendInput(secondBytes, first.entry.version, 'revision-operation-2')
        )
        const oldApproval = yield* Effect.flip(
          service.approveRevision(application.id, entry.id, {
            expectedVersion: second.entry.version,
            revisionId: first.revision.id,
          })
        )
        const approved = yield* service.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: second.entry.version,
            revisionId: second.revision.id,
          }
        )
        const read = yield* service.readRevision(
          application.id,
          entry.id,
          second.revision.id
        )
        return { approved, first, oldApproval, read, second, stale }
      })
    )

    expect(result.stale._tag).toBe('RegistryConflictError')
    expect(result.oldApproval._tag).toBe('RegistryConflictError')
    expect(result.first.revision.parentRevisionId).toBeNull()
    expect(result.first.revision.revisionNumber).toBe(1)
    expect(result.second.revision.parentRevisionId).toBe(
      result.first.revision.id
    )
    expect(result.second.revision.revisionNumber).toBe(2)
    expect(result.approved.entry.approvedRevisionId).toBe(
      result.second.revision.id
    )
    expect(result.approved.entry.state).toBe('approved')
    expect(result.read.bytes).toEqual(secondBytes)
  })

  test('stages private revisions, preserves page identity, and resolves capability previews', async () => {
    const { run, state } = makeHarness()
    const result = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const first = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"revision":1}'),
            entry.version,
            'public-revision-1'
          )
        )
        const firstApproval = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: first.entry.version,
            revisionId: first.revision.id,
          }
        )
        const firstLink = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: firstApproval.entry.version,
          revisionId: first.revision.id,
        })
        yield* Effect.sync(() => {
          state.applicationStatus = 'rejected'
        })
        yield* publications.setAvailability(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          enabled: false,
          expectedPublicationVersion: firstLink.publicationVersion,
          reason: 'application_rejected',
        })
        const hidden = yield* Effect.flip(publications.resolve(firstLink.token))
        yield* Effect.sync(() => {
          state.applicationStatus = 'preparing'
        })
        const restored = yield* publications.restoreAfterRejection(
          application.id,
          'restore-after-rejection'
        )
        const enabledWithoutPdf = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: true,
            expectedPublicationVersion: firstLink.publicationVersion,
          }
        )

        const second = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"revision":2}'),
            firstApproval.entry.version,
            'public-revision-2'
          )
        )
        const secondApproval = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: second.entry.version,
            revisionId: second.revision.id,
          }
        )
        const secondLink = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: secondApproval.entry.version,
          revisionId: second.revision.id,
        })
        const privatePublicResolution = yield* Effect.flip(
          publications.resolve(secondLink.token)
        )
        const preview = yield* publications.resolvePreview(
          secondLink.token,
          secondLink.previewToken
        )
        const invalidPreview = yield* Effect.flip(
          publications.resolvePreview(secondLink.token, 'wrong-token')
        )
        const publicLink = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: true,
            expectedPublicationVersion: secondLink.publicationVersion,
          }
        )
        const resolved = yield* publications.resolve(publicLink.token)
        return {
          enabledWithoutPdf,
          firstLink,
          hidden,
          invalidPreview,
          preview,
          privatePublicResolution,
          publicLink,
          resolved,
          restored,
          second,
          secondLink,
        }
      })
    )

    expect(result.hidden._tag).toBe('RegistryNotFoundError')
    expect(result.restored).toBe(0)
    expect(result.enabledWithoutPdf.enabled).toBe(true)
    expect(result.secondLink.id).toBe(result.firstLink.id)
    expect(result.secondLink.token).toBe(result.firstLink.token)
    expect(result.secondLink.currentRevisionId).toBe(result.second.revision.id)
    expect(result.secondLink.enabled).toBe(false)
    expect(result.privatePublicResolution._tag).toBe('RegistryNotFoundError')
    expect(result.invalidPreview._tag).toBe('RegistryNotFoundError')
    expect(new TextDecoder().decode(result.preview.bytes)).toBe(
      '{"revision":2}'
    )
    expect(result.publicLink.enabled).toBe(true)
    expect(result.secondLink.publicUrl).toBe(
      `https://cv.example.test/c/${result.firstLink.token}`
    )
    expect(new TextDecoder().decode(result.resolved.bytes)).toBe(
      '{"revision":2}'
    )
  })

  test('keeps staging successful when publication event delivery fails', async () => {
    const attemptedEventIds: Array<string> = []
    const eventPublisherLayer = Layer.succeed(
      RegistryEventPublisher,
      RegistryEventPublisher.of({
        publish: Effect.fn('RegistryEventPublisher.failForTest')(
          function* (event) {
            if (event._tag !== 'CvPublicationChanged') return
            attemptedEventIds.push(event.eventId)
            return yield* new RegistryEventPublishError({
              cause: new Error('event transport unavailable'),
              eventId: event.eventId,
              message: 'Event transport unavailable.',
            })
          }
        ),
      })
    )
    const { run } = makeHarness(eventPublisherLayer)
    const result = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const appended = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"publication":"best-effort-events"}'),
            entry.version,
            'best-effort-event-revision'
          )
        )
        const approved = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: appended.entry.version,
            revisionId: appended.revision.id,
          }
        )
        const staged = yield* publications.stage(application.id, entry.id, {
          operationId: 'best-effort-stage',
          expectedContentVersion: approved.entry.version,
          revisionId: appended.revision.id,
        })
        const stored = yield* publications.findByEntry(application.id, entry.id)
        return { staged, stored }
      })
    )

    expect(result.staged).toEqual(result.stored)
    expect(result.stored.enabled).toBe(false)
    expect(attemptedEventIds).toEqual([
      `cv-publication-changed:${application.id}:best-effort-stage`,
    ])
  })

  test('reports a conflict when content changes after the staging preflight', async () => {
    const { run, state } = makeHarness()
    const conflict = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const appended = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"revision":"stale-stage"}'),
            entry.version,
            'stale-stage-revision'
          )
        )
        const approved = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: appended.entry.version,
            revisionId: appended.revision.id,
          }
        )

        yield* Effect.sync(() => {
          state.beforeLinkStage = () => {
            const current = state.entries.get(entry.id)
            if (current !== undefined) {
              state.entries.set(entry.id, {
                ...current,
                version: current.version + 1,
              })
            }
          }
        })

        return yield* Effect.flip(
          publications.stage(application.id, entry.id, {
            operationId: crypto.randomUUID(),
            expectedContentVersion: approved.entry.version,
            revisionId: appended.revision.id,
          })
        )
      })
    )

    expect(conflict._tag).toBe('RegistryConflictError')
    expect(state.links.size).toBe(0)
  })

  test('does not overwrite the identity of a link created during staging', async () => {
    const { run, state } = makeHarness()
    const conflict = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const appended = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"revision":"competing-stage"}'),
            entry.version,
            'competing-stage-revision'
          )
        )

        yield* Effect.sync(() => {
          state.beforeLinkStage = () => {
            state.links.set('competing-link', {
              applicationId: application.id,
              contentEntryId: entry.id,
              createdAt: '2026-07-17T12:00:00.000Z',
              currentRevisionId: appended.revision.id,
              disabledAt: '2026-07-17T12:00:00.000Z',
              disabledReason: 'draft_revision',
              enabled: false,
              id: 'competing-link',
              previewToken: 'competing-preview-token',
              publicationVersion: 1,
              publicUrl: 'https://cv.example.test/cv/competing-public-token',
              token: 'competing-public-token',
              updatedAt: '2026-07-17T12:00:00.000Z',
              version: 1,
            })
          }
        })

        return yield* Effect.flip(
          publications.stage(application.id, entry.id, {
            operationId: crypto.randomUUID(),
            expectedContentVersion: appended.entry.version,
            revisionId: appended.revision.id,
          })
        )
      })
    )

    expect(conflict._tag).toBe('RegistryConflictError')
    expect([...state.links.values()]).toEqual([
      expect.objectContaining({
        id: 'competing-link',
        publicUrl: 'https://cv.example.test/cv/competing-public-token',
        token: 'competing-public-token',
      }),
    ])
  })

  test('fails closed on rejected applications and restores only after the pending PDF is ready', async () => {
    const { run, state } = makeHarness()
    const result = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const pdfs = yield* PdfArtifactsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const revision = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"status":"reconciled"}'),
            entry.version,
            'reconciliation-revision'
          )
        )
        const approved = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: revision.entry.version,
            revisionId: revision.revision.id,
          }
        )
        const staged = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: approved.entry.version,
          revisionId: revision.revision.id,
        })
        const link = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: true,
            expectedPublicationVersion: staged.publicationVersion,
          }
        )
        const pending = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: staged.publicationVersion,
          eventId: 'rejected-pending-request',
        })
        state.applicationStatus = 'rejected'
        state.allowLinkAvailabilityRepair = false
        const hidden = yield* Effect.flip(publications.resolve(link.token))
        const projectedDisabled = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const remainedVisibleInStorage =
          [...state.links.values()][0]?.enabled === true

        state.allowLinkAvailabilityRepair = true
        const persistedDisabled = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const disabledInStorage =
          [...state.links.values()][0]?.enabled === false

        state.applicationStatus = 'preparing'
        state.allowLinkAvailabilityRepair = false
        const stillHidden = yield* Effect.flip(publications.resolve(link.token))
        const remainedDisabledInStorage =
          [...state.links.values()][0]?.enabled === false

        state.allowLinkAvailabilityRepair = true
        const restoredWhilePending = yield* publications.restoreAfterRejection(
          application.id,
          'restore-while-pending'
        )
        const pendingLink = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        yield* pdfs.complete(
          application.id,
          pending.id,
          'renderer-v1',
          new TextEncoder().encode('%PDF ready after rejection')
        )
        const restored = yield* publications.restoreAfterRejection(
          application.id,
          'restore-ready-publication'
        )
        const persistedRestored = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const restoredInStorage = [...state.links.values()][0]?.enabled === true

        return {
          disabledInStorage,
          hidden,
          persistedDisabled,
          persistedRestored,
          pendingLink,
          projectedDisabled,
          remainedDisabledInStorage,
          remainedVisibleInStorage,
          restored,
          restoredWhilePending,
          restoredInStorage,
          stillHidden,
        }
      })
    )

    expect(result.hidden._tag).toBe('RegistryNotFoundError')
    expect(result.projectedDisabled.enabled).toBe(false)
    expect(result.remainedVisibleInStorage).toBe(true)
    expect(result.persistedDisabled.enabled).toBe(false)
    expect(result.disabledInStorage).toBe(true)
    expect(result.stillHidden._tag).toBe('RegistryNotFoundError')
    expect(result.remainedDisabledInStorage).toBe(true)
    expect(result.restoredWhilePending).toBe(0)
    expect(result.pendingLink.enabled).toBe(false)
    expect(result.restored).toBe(1)
    expect(result.persistedRestored.enabled).toBe(true)
    expect(result.restoredInStorage).toBe(true)
  })

  test('does not restore a rejected publication when its latest PDF attempt failed', async () => {
    const { run, state } = makeHarness()
    const result = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const pdfs = yield* PdfArtifactsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const revision = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"status":"failed-retry"}'),
            entry.version,
            'failed-retry-revision'
          )
        )
        const approved = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: revision.entry.version,
            revisionId: revision.revision.id,
          }
        )
        const staged = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: approved.entry.version,
          revisionId: revision.revision.id,
        })
        yield* publications.setAvailability(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          enabled: true,
          expectedPublicationVersion: staged.publicationVersion,
        })

        const firstAttempt = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: staged.publicationVersion,
          eventId: 'rejected-ready-request',
        })
        const ready = yield* pdfs.complete(
          application.id,
          firstAttempt.id,
          'renderer-v1',
          new TextEncoder().encode('%PDF older ready artifact')
        )
        const retry = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: staged.publicationVersion,
          eventId: 'rejected-failed-request',
        })

        state.applicationStatus = 'rejected'
        const rejectedLink = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const failed = yield* pdfs.fail(
          application.id,
          retry.id,
          'browser_failed',
          'The newer PDF retry failed while the application was rejected.'
        )

        state.applicationStatus = 'preparing'
        const restored = yield* publications.restoreAfterRejection(
          application.id,
          'restore-current-artifact'
        )
        const reopenedLink = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const hidden = yield* Effect.flip(publications.resolve(staged.token))
        return { failed, hidden, ready, rejectedLink, reopenedLink, restored }
      })
    )

    expect(result.ready.status).toBe('ready')
    expect(result.failed.status).toBe('failed')
    expect(result.rejectedLink.enabled).toBe(false)
    expect(result.rejectedLink.disabledReason).toBe('application_rejected')
    expect(result.restored).toBe(0)
    expect(result.reopenedLink.enabled).toBe(false)
    expect(result.reopenedLink.disabledReason).toBe('application_rejected')
    expect(result.hidden._tag).toBe('RegistryNotFoundError')
  })

  test('requires an enabled staged publication before pinning its PDF', async () => {
    const { run, state } = makeHarness()
    const pdf = new TextEncoder().encode('%PDF-1.7 opaque-test')
    const result = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const pdfs = yield* PdfArtifactsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const draft = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"pdf":true}'),
            entry.version,
            'pdf-revision'
          )
        )
        const approval = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: draft.entry.version,
            revisionId: draft.revision.id,
          }
        )
        const link = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: approval.entry.version,
          revisionId: draft.revision.id,
        })
        const disabledStart = yield* Effect.flip(
          ensurePdfAttempt(application.id, entry.id, {
            expectedPublicationVersion: link.publicationVersion,
            eventId: 'request-disabled',
          })
        )
        const activeLink = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: true,
            expectedPublicationVersion: link.publicationVersion,
          }
        )
        const pending = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: link.publicationVersion,
          eventId: 'request-1',
        })
        const ready = yield* pdfs.complete(
          application.id,
          pending.id,
          'renderer-v1',
          pdf
        )
        const replay = yield* pdfs.complete(
          application.id,
          pending.id,
          'renderer-v1',
          pdf
        )
        const different = yield* Effect.flip(
          pdfs.complete(
            application.id,
            pending.id,
            'renderer-v1',
            new TextEncoder().encode('%PDF-different')
          )
        )
        const read = yield* pdfs.readCurrent(
          application.id,
          entry.id,
          'renderer-v1'
        )
        const disabled = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: false,
            expectedPublicationVersion: link.publicationVersion,
            reason: 'manual test',
          }
        )
        const reloadedWhileDisabled = yield* pdfs.readCurrent(
          application.id,
          entry.id,
          'renderer-v1'
        )
        const enabled = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: true,
            expectedPublicationVersion: link.publicationVersion,
          }
        )
        const readAfterEnable = yield* pdfs.readCurrent(
          application.id,
          entry.id,
          'renderer-v1'
        )
        const newerDraft = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"pdf":"newer-unpublished"}'),
            approval.entry.version,
            'newer-unpublished-pdf-revision'
          )
        )
        yield* content.approveRevision(application.id, entry.id, {
          expectedVersion: newerDraft.entry.version,
          revisionId: newerDraft.revision.id,
        })
        const systemDisabled = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: false,
            expectedPublicationVersion: link.publicationVersion,
            reason: 'application_rejected',
          }
        )
        const systemRestored = yield* publications.restoreAfterRejection(
          application.id,
          'restore-system-disabled-link'
        )
        const systemRestoredLink = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        return {
          activeLink,
          different,
          disabled,
          disabledStart,
          enabled,
          link,
          pending,
          read,
          readAfterEnable,
          ready,
          reloadedWhileDisabled,
          replay,
          systemDisabled,
          systemRestored,
          systemRestoredLink,
        }
      })
    )

    expect(result.disabledStart._tag).toBe('RegistryConflictError')
    expect(result.activeLink.enabled).toBe(true)
    expect(result.pending.contentRevisionId).toBe(result.link.currentRevisionId)
    expect(result.pending.qrTarget).toBe(result.link.publicUrl)
    expect(result.pending.publicationVersion).toBe(
      result.link.publicationVersion
    )
    expect(result.ready.status).toBe('ready')
    expect(result.replay).toEqual(result.ready)
    expect(result.different._tag).toBe('RegistryConflictError')
    expect(result.read.bytes).toEqual(pdf)
    expect(result.disabled.publicationVersion).toBe(
      result.link.publicationVersion
    )
    expect(result.enabled.publicationVersion).toBe(
      result.link.publicationVersion
    )
    expect(result.disabled.version).toBe(result.activeLink.version + 1)
    expect(result.enabled.version).toBe(result.disabled.version + 1)
    expect(result.enabled.currentRevisionId).toBe(result.link.currentRevisionId)
    expect(result.reloadedWhileDisabled.bytes).toEqual(pdf)
    expect(result.readAfterEnable.bytes).toEqual(pdf)
    expect(result.systemDisabled.enabled).toBe(false)
    expect(result.systemRestored).toBe(1)
    expect(result.systemRestoredLink.enabled).toBe(true)
    expect(result.systemRestoredLink.publicationVersion).toBe(
      result.link.publicationVersion
    )
    expect(state.artifacts.get(result.ready.id)?.qrTarget).toBe(
      result.link.publicUrl
    )
    expect(state.artifacts.size).toBe(1)
  })

  test('does not disable a newer successful attempt when an older failure is replayed', async () => {
    const { run, state } = makeHarness()
    const pdf = new TextEncoder().encode('%PDF newer successful attempt')
    const result = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const pdfs = yield* PdfArtifactsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const draft = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"latestAttempt":true}'),
            entry.version,
            'latest-attempt-revision'
          )
        )
        const approval = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: draft.entry.version,
            revisionId: draft.revision.id,
          }
        )
        const staged = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: approval.entry.version,
          revisionId: draft.revision.id,
        })
        yield* publications.setAvailability(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          enabled: true,
          expectedPublicationVersion: staged.publicationVersion,
        })

        const olderAttempt = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: staged.publicationVersion,
          eventId: 'request-older-failure',
        })
        const olderFailure = yield* pdfs.fail(
          application.id,
          olderAttempt.id,
          'browser_failed',
          'The older browser attempt failed.'
        )
        const disabledAfterOlderFailure = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        yield* publications.setAvailability(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          enabled: true,
          expectedPublicationVersion: staged.publicationVersion,
        })

        const newerAttempt = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: staged.publicationVersion,
          eventId: 'request-newer-success',
        })
        const newerReady = yield* pdfs.complete(
          application.id,
          newerAttempt.id,
          'renderer-v1',
          pdf
        )
        const activeBeforeReplay = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const replayedFailure = yield* pdfs.fail(
          application.id,
          olderAttempt.id,
          'browser_failed',
          'The older browser attempt failed.'
        )
        const activeAfterReplay = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const current = yield* pdfs.readCurrent(
          application.id,
          entry.id,
          'renderer-v1'
        )

        return {
          activeAfterReplay,
          activeBeforeReplay,
          current,
          disabledAfterOlderFailure,
          newerReady,
          olderFailure,
          replayedFailure,
        }
      })
    )

    expect(result.olderFailure.status).toBe('failed')
    expect(result.disabledAfterOlderFailure.enabled).toBe(false)
    expect(result.newerReady.status).toBe('ready')
    expect(result.activeBeforeReplay.enabled).toBe(true)
    expect(result.replayedFailure).toEqual(result.olderFailure)
    expect(result.activeAfterReplay).toEqual(result.activeBeforeReplay)
    expect(result.current.artifact.id).toBe(result.newerReady.id)
    expect(result.current.bytes).toEqual(pdf)
    expect(state.artifacts.size).toBe(2)
  })

  test('atomically keeps the link enabled when a newer attempt starts during failure handling', async () => {
    const { run, state } = makeHarness()
    const setup = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const draft = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"interleavedAttempt":true}'),
            entry.version,
            'interleaved-attempt-revision'
          )
        )
        const approval = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: draft.entry.version,
            revisionId: draft.revision.id,
          }
        )
        const staged = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: approval.entry.version,
          revisionId: draft.revision.id,
        })
        yield* publications.setAvailability(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          enabled: true,
          expectedPublicationVersion: staged.publicationVersion,
        })
        const olderAttempt = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: staged.publicationVersion,
          eventId: 'request-interleaved-older',
        })
        return { entry, olderAttempt }
      })
    )
    const interleavedAttempt: GeneratedArtifact = {
      ...setup.olderAttempt,
      createdAt: '9999-12-31T23:59:59.999Z',
      id: 'interleaved-newer-artifact',
      requestId: 'request-interleaved-newer',
      updatedAt: '9999-12-31T23:59:59.999Z',
    }
    state.beforeFailedArtifactDisable = () => {
      state.artifacts.set(interleavedAttempt.id, interleavedAttempt)
    }

    const result = await run(
      Effect.gen(function* () {
        const pdfs = yield* PdfArtifactsService
        const publications = yield* CvPublicationsService
        const failed = yield* pdfs.fail(
          application.id,
          setup.olderAttempt.id,
          'browser_failed',
          'The older browser attempt failed.'
        )
        const link = yield* publications.findByEntry(
          application.id,
          setup.entry.id
        )
        const current = yield* pdfs.findCurrent(application.id, setup.entry.id)
        return { current, failed, link }
      })
    )

    expect(result.failed.status).toBe('failed')
    expect(result.link.enabled).toBe(true)
    expect(result.current.id).toBe(interleavedAttempt.id)
    expect(state.beforeFailedArtifactDisable).toBeUndefined()
  })

  test('retries failed PDF attempts and isolates a restaged publication', async () => {
    const { run, state } = makeHarness()
    const firstPdf = new TextEncoder().encode('%PDF retry')
    const secondPdf = new TextEncoder().encode('%PDF restaged publication')
    const result = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
        const pdfs = yield* PdfArtifactsService
        const entry = yield* content.ensure(application.id, {
          kind: 'cv',
          locale: 'en',
        })
        const draft = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"retry":true}'),
            entry.version,
            'pdf-retry-revision'
          )
        )
        const approval = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: draft.entry.version,
            revisionId: draft.revision.id,
          }
        )
        const firstLink = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: approval.entry.version,
          revisionId: draft.revision.id,
        })
        const firstActive = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: true,
            expectedPublicationVersion: firstLink.publicationVersion,
          }
        )
        const failedAttempt = yield* ensurePdfAttempt(
          application.id,
          entry.id,
          {
            expectedPublicationVersion: firstLink.publicationVersion,
            eventId: 'request-failed',
          }
        )
        const failed = yield* pdfs.fail(
          application.id,
          failedAttempt.id,
          'browser_failed',
          'Browser failed.'
        )
        const disabledAfterFailure = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const failedReplayWhileDisabled = yield* ensurePdfAttempt(
          application.id,
          entry.id,
          {
            expectedPublicationVersion: firstLink.publicationVersion,
            eventId: 'request-failed',
          }
        )
        const failedIdempotent = yield* pdfs.fail(
          application.id,
          failedAttempt.id,
          'browser_failed',
          'Browser failed.'
        )
        const firstReenabled = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: true,
            expectedPublicationVersion: firstLink.publicationVersion,
          }
        )
        const failedReplay = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: firstLink.publicationVersion,
          eventId: 'request-failed',
        })
        const retryAttempt = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: firstLink.publicationVersion,
          eventId: 'request-retry',
        })
        const firstReady = yield* pdfs.complete(
          application.id,
          retryAttempt.id,
          'renderer-v1',
          firstPdf
        )
        const staleAttempt = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: firstLink.publicationVersion,
          eventId: 'request-stale',
        })

        const restagedDraft = yield* content.appendRevision(
          application.id,
          entry.id,
          appendInput(
            new TextEncoder().encode('{"retry":"restaged"}'),
            approval.entry.version,
            'pdf-restaged-revision'
          )
        )
        const restagedApproval = yield* content.approveRevision(
          application.id,
          entry.id,
          {
            expectedVersion: restagedDraft.entry.version,
            revisionId: restagedDraft.revision.id,
          }
        )
        const secondLink = yield* publications.stage(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          expectedContentVersion: restagedApproval.entry.version,
          revisionId: restagedDraft.revision.id,
        })
        const secondActive = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: true,
            expectedPublicationVersion: secondLink.publicationVersion,
          }
        )
        const staleCompletion = yield* Effect.flip(
          pdfs.complete(
            application.id,
            staleAttempt.id,
            'renderer-v1',
            firstPdf
          )
        )
        const staleRead = yield* Effect.flip(
          pdfs.readCurrent(application.id, entry.id, 'renderer-v1')
        )
        const staleFailure = yield* pdfs.fail(
          application.id,
          staleAttempt.id,
          'stale_browser_failed',
          'The stale browser attempt failed.'
        )
        const activeAfterStaleFailure = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        const restagedAttempt = yield* ensurePdfAttempt(
          application.id,
          entry.id,
          {
            expectedPublicationVersion: secondLink.publicationVersion,
            eventId: 'request-restaged',
          }
        )
        const manuallyDisabled = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            operationId: crypto.randomUUID(),
            enabled: false,
            expectedPublicationVersion: secondLink.publicationVersion,
            reason: 'manual test',
          }
        )
        const restagedFailure = yield* pdfs.fail(
          application.id,
          restagedAttempt.id,
          'manual_browser_failure',
          'The browser failed after a manual disable.'
        )
        const disabledAfterManualFailure = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        yield* publications.setAvailability(application.id, entry.id, {
          operationId: crypto.randomUUID(),
          enabled: true,
          expectedPublicationVersion: secondLink.publicationVersion,
        })
        const finalAttempt = yield* ensurePdfAttempt(application.id, entry.id, {
          expectedPublicationVersion: secondLink.publicationVersion,
          eventId: 'request-restaged-final',
        })
        const secondReady = yield* pdfs.complete(
          application.id,
          finalAttempt.id,
          'renderer-v1',
          secondPdf
        )
        const current = yield* pdfs.readCurrent(
          application.id,
          entry.id,
          'renderer-v1'
        )

        return {
          activeAfterStaleFailure,
          current,
          disabledAfterFailure,
          disabledAfterManualFailure,
          failed,
          failedIdempotent,
          failedReplay,
          failedReplayWhileDisabled,
          finalAttempt,
          firstActive,
          firstLink,
          firstReenabled,
          firstReady,
          manuallyDisabled,
          retryAttempt,
          restagedAttempt,
          restagedFailure,
          secondActive,
          secondLink,
          secondReady,
          staleCompletion,
          staleFailure,
          staleRead,
        }
      })
    )

    expect(result.failed.status).toBe('failed')
    expect(result.firstActive.enabled).toBe(true)
    expect(result.failedIdempotent).toEqual(result.failed)
    expect(result.failedReplayWhileDisabled).toEqual(result.failed)
    expect(result.disabledAfterFailure.enabled).toBe(false)
    expect(result.disabledAfterFailure.disabledReason).toBe(
      pdfGenerationFailedDisableReason
    )
    expect(result.firstReenabled.version).toBe(
      result.disabledAfterFailure.version + 1
    )
    expect(result.failedReplay).toEqual(result.failed)
    expect(result.retryAttempt.id).not.toBe(result.failed.id)
    expect(result.firstReady.status).toBe('ready')
    expect(result.staleCompletion._tag).toBe('RegistryConflictError')
    expect(result.staleRead._tag).toBe('RegistryNotFoundError')
    expect(result.staleFailure.status).toBe('failed')
    expect(result.activeAfterStaleFailure).toEqual(result.secondActive)
    expect(result.secondLink.version).toBeGreaterThan(result.firstLink.version)
    expect(result.secondLink.publicUrl).toBe(result.firstLink.publicUrl)
    expect(result.restagedAttempt.publicationVersion).toBe(
      result.secondLink.publicationVersion
    )
    expect(result.restagedAttempt.qrTarget).toBe(result.secondLink.publicUrl)
    expect(result.restagedFailure.status).toBe('failed')
    expect(result.manuallyDisabled.disabledReason).toBe('manual test')
    expect(result.disabledAfterManualFailure).toEqual(result.manuallyDisabled)
    expect(result.finalAttempt.publicationVersion).toBe(
      result.secondLink.publicationVersion
    )
    expect(result.finalAttempt.qrTarget).toBe(result.secondLink.publicUrl)
    expect(result.secondReady.id).toBe(result.finalAttempt.id)
    expect(result.current.artifact.id).toBe(result.secondReady.id)
    expect(result.current.bytes).toEqual(secondPdf)
    expect(state.artifacts.size).toBe(5)
  })

  test('stores raw and normalized job context as opaque objects', async () => {
    const { run } = makeHarness()
    const raw = new TextEncoder().encode('<html>untrusted posting</html>')
    const normalized = new TextEncoder().encode(
      JSON.stringify({ any: ['runtime', 'shape'] })
    )
    const result = await run(
      Effect.gen(function* () {
        const snapshots = yield* JobPostingSnapshotsService
        const snapshot = yield* snapshots.persist(application.id, {
          fetcherVersion: 'fetcher-v1',
          finalUrl: application.postingUrl,
          normalized: { bytes: normalized, mediaType: 'application/json' },
          raw: { bytes: raw, mediaType: 'text/html' },
          requestedUrl: application.postingUrl,
          status: 'fetched',
        })
        const storedRaw = yield* snapshots.readPayload(
          application.id,
          snapshot.id,
          'raw'
        )
        const storedNormalized = yield* snapshots.readPayload(
          application.id,
          snapshot.id,
          'normalized'
        )
        return { snapshot, storedNormalized, storedRaw }
      })
    )

    expect(result.storedRaw).toEqual(raw)
    expect(result.storedNormalized).toEqual(normalized)
    expect(result.snapshot.rawSha256).toMatch(/^[a-f\d]{64}$/u)
    expect(result.snapshot.normalizedObjectKey).toBe(
      `sha256/${result.snapshot.normalizedSha256}`
    )
  })
})
