import { describe, expect, test } from 'bun:test'
import { makeInMemoryArtifactStoreLayer } from '@cv/application-registry-artifact-store/test-support'
import {
  ArtifactsCrud,
  ContentCrud,
  CvLinksCrud,
  FactsReleasesCrud,
  JobPostingSnapshotsCrud,
  type PersistedContentEntry,
  type PersistedCvLink,
  type PersistedGeneratedArtifact,
  type PersistedJobPostingSnapshot,
} from '@cv/application-registry-crud'
import type {
  ApplicationStatus,
  ContentEntry,
  ContentRevision,
  CvLink,
  GeneratedArtifact,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import { Effect, Layer } from 'effect'

import { application } from '../../test/support/fixtures'
import { applicationsCrudLayer } from '../../test/support/layers'
import {
  ContentEntriesService,
  CvPublicationsService,
  JobPostingSnapshotsService,
  PdfArtifactsService,
} from '../services'
import { RegistryContentServicesLive } from './layers'

type MemoryState = {
  applicationStatus: ApplicationStatus
  allowLinkAvailabilityRepair: boolean
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
            link.disabledReason === disabledReason &&
            [...state.artifacts.values()].some(
              (artifact) =>
                artifact.cvLinkId === link.id &&
                artifact.contentRevisionId === link.publishedRevisionId &&
                artifact.publicationVersion === link.publicationVersion &&
                artifact.qrTarget === link.publicUrl &&
                artifact.status === 'ready'
            )
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
    findByToken: (token) =>
      Effect.succeed(
        [...state.links.values()].find((link) => link.token === token)
      ),
    publish: (input: PersistedCvLink) =>
      Effect.sync(() => {
        const existing = [...state.links.values()].find(
          ({ contentEntryId }) => contentEntryId === input.contentEntryId
        )
        if (existing) {
          state.links.set(existing.id, {
            ...existing,
            disabledAt: null,
            disabledReason: null,
            enabled: true,
            publicUrl: input.publicUrl,
            publishedRevisionId: input.publishedRevisionId,
            publicationVersion: existing.publicationVersion + 1,
            updatedAt: input.updatedAt,
            version: existing.version + 1,
          })
        } else {
          state.links.set(input.id, {
            ...input,
            disabledAt: null,
            disabledReason: null,
            enabled: true,
            publicationVersion: 1,
            version: 1,
          })
        }
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
          link.publicationVersion !== expectedPublicationVersion ||
          (enabled &&
            ![...state.artifacts.values()].some(
              (artifact) =>
                artifact.cvLinkId === link.id &&
                artifact.contentRevisionId === link.publishedRevisionId &&
                artifact.publicationVersion === link.publicationVersion &&
                artifact.qrTarget === link.publicUrl &&
                artifact.status === 'ready'
            ))
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
    findPendingDispatch: () => Effect.succeed(undefined),
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
    markDispatchFailed: () => Effect.succeed(true),
    markDispatched: () => Effect.succeed(true),
    markReady: (artifact: PersistedGeneratedArtifact) =>
      Effect.sync(() => {
        const existing = state.artifacts.get(artifact.id)
        const link = state.links.get(artifact.cvLinkId)
        if (
          existing?.status !== 'pending' ||
          !link?.enabled ||
          link.publicationVersion !== artifact.publicationVersion ||
          link.publicUrl !== artifact.qrTarget ||
          link.publishedRevisionId !== artifact.contentRevisionId
        ) {
          return false
        }
        state.artifacts.set(artifact.id, artifact)
        return true
      }),
    persistPending: (artifact: PersistedGeneratedArtifact) =>
      Effect.sync(() => {
        const existing = [...state.artifacts.values()].find(
          (candidate) => candidate.requestId === artifact.requestId
        )
        if (!existing) state.artifacts.set(artifact.id, artifact)
      }),
    pendingDispatches: () => Effect.succeed([]),
  }

  const layer = Layer.mergeAll(
    applicationsCrudLayer({
      findByIdentifier: (identifier) =>
        Effect.succeed(
          identifier === application.id || identifier === application.jobKey
            ? { ...application, applicationStatus: state.applicationStatus }
            : undefined
        ),
    }),
    Layer.succeed(ContentCrud, contentCrud),
    Layer.succeed(JobPostingSnapshotsCrud, snapshotsCrud),
    Layer.succeed(CvLinksCrud, linksCrud),
    Layer.succeed(ArtifactsCrud, artifactsCrud),
    Layer.succeed(FactsReleasesCrud, {
      activate: () => Effect.succeed(false),
      assets: () => Effect.succeed([]),
      catalogs: () => Effect.succeed([]),
      find: () => Effect.succeed(undefined),
      findActiveCatalog: () => Effect.succeed(undefined),
      register: () => Effect.void,
    })
  )

  return { layer, state }
}

const makeHarness = () => {
  const memory = makeMemoryCrudLayer()
  const live = RegistryContentServicesLive.pipe(
    Layer.provide(memory.layer),
    Layer.provide(makeInMemoryArtifactStoreLayer())
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

describe('v2 content domain services', () => {
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

  test('preserves a public token across revisions and hides disabled links', async () => {
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
        const firstLink = yield* publications.publish(
          application.id,
          entry.id,
          {
            expectedContentVersion: firstApproval.entry.version,
            publicBaseUrl: 'https://cv.example.test/cv',
          }
        )
        yield* Effect.sync(() => {
          state.applicationStatus = 'rejected'
        })
        yield* publications.setAvailability(application.id, entry.id, {
          enabled: false,
          expectedPublicationVersion: firstLink.publicationVersion,
          reason: 'application_rejected',
        })
        const hidden = yield* Effect.flip(publications.resolve(firstLink.token))
        yield* Effect.sync(() => {
          state.applicationStatus = 'preparing'
        })
        const restored = yield* publications.restoreAfterRejection(
          application.id
        )
        const enableWithoutPdf = yield* Effect.flip(
          publications.setAvailability(application.id, entry.id, {
            enabled: true,
            expectedPublicationVersion: firstLink.publicationVersion,
          })
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
        const secondLink = yield* publications.publish(
          application.id,
          entry.id,
          {
            expectedContentVersion: secondApproval.entry.version,
            publicBaseUrl: 'https://cv.example.test/cv',
          }
        )
        const resolved = yield* publications.resolve(secondLink.token)
        return {
          enableWithoutPdf,
          firstLink,
          hidden,
          resolved,
          restored,
          second,
          secondLink,
        }
      })
    )

    expect(result.hidden._tag).toBe('RegistryNotFoundError')
    expect(result.restored).toBe(0)
    expect(result.enableWithoutPdf._tag).toBe('RegistryConflictError')
    expect(result.secondLink.id).toBe(result.firstLink.id)
    expect(result.secondLink.token).toBe(result.firstLink.token)
    expect(result.secondLink.publishedRevisionId).toBe(
      result.second.revision.id
    )
    expect(result.secondLink.publicUrl).toBe(
      `https://cv.example.test/cv/${result.firstLink.token}`
    )
    expect(new TextDecoder().decode(result.resolved.bytes)).toBe(
      '{"revision":2}'
    )
  })

  test('fails closed on rejected applications and repairs derived link state on reads', async () => {
    const { run, state } = makeHarness()
    const result = await run(
      Effect.gen(function* () {
        const content = yield* ContentEntriesService
        const publications = yield* CvPublicationsService
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
        const link = yield* publications.publish(application.id, entry.id, {
          expectedContentVersion: approved.entry.version,
          publicBaseUrl: 'https://cv.example.test/c',
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
        const restored = yield* publications.restoreAfterRejection(
          application.id
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
          projectedDisabled,
          remainedDisabledInStorage,
          remainedVisibleInStorage,
          restored,
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
    expect(result.restored).toBe(0)
    expect(result.persistedRestored.enabled).toBe(false)
    expect(result.restoredInStorage).toBe(false)
  })

  test('pins a PDF to the published revision and exact public QR target', async () => {
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
        const link = yield* publications.publish(application.id, entry.id, {
          expectedContentVersion: approval.entry.version,
          publicBaseUrl: 'https://cv.example.test/cv/',
        })
        const pending = yield* pdfs.startJob(application.id, entry.id, {
          expectedPublicationVersion: link.publicationVersion,
          rendererVersion: 'renderer-v1',
          requestId: 'request-1',
        })
        const ready = yield* pdfs.complete(application.id, pending.id, pdf)
        const replay = yield* pdfs.complete(application.id, pending.id, pdf)
        const different = yield* Effect.flip(
          pdfs.complete(
            application.id,
            pending.id,
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
        const enabled = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            enabled: true,
            expectedPublicationVersion: link.publicationVersion,
          }
        )
        const readAfterEnable = yield* pdfs.readCurrent(
          application.id,
          entry.id,
          'renderer-v1'
        )
        const systemDisabled = yield* publications.setAvailability(
          application.id,
          entry.id,
          {
            enabled: false,
            expectedPublicationVersion: link.publicationVersion,
            reason: 'application_rejected',
          }
        )
        const systemRestored = yield* publications.restoreAfterRejection(
          application.id
        )
        const systemRestoredLink = yield* publications.findByEntry(
          application.id,
          entry.id
        )
        return {
          different,
          disabled,
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

    expect(result.pending.contentRevisionId).toBe(
      result.link.publishedRevisionId
    )
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
    expect(result.enabled.version).toBe(result.link.version + 2)
    expect(result.enabled.publishedRevisionId).toBe(
      result.link.publishedRevisionId
    )
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
  })

  test('retries failed PDF attempts and isolates a changed publication URL', async () => {
    const { run, state } = makeHarness()
    const firstPdf = new TextEncoder().encode('%PDF retry')
    const secondPdf = new TextEncoder().encode('%PDF changed URL')
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
        const firstLink = yield* publications.publish(
          application.id,
          entry.id,
          {
            expectedContentVersion: approval.entry.version,
            publicBaseUrl: 'https://cv.example.test/c/',
          }
        )
        const failedAttempt = yield* pdfs.startJob(application.id, entry.id, {
          expectedPublicationVersion: firstLink.publicationVersion,
          rendererVersion: 'renderer-v1',
          requestId: 'request-failed',
        })
        const failed = yield* pdfs.fail(
          application.id,
          failedAttempt.id,
          'browser_failed',
          'Browser failed.'
        )
        const failedReplay = yield* pdfs.startJob(application.id, entry.id, {
          expectedPublicationVersion: firstLink.publicationVersion,
          rendererVersion: 'renderer-v1',
          requestId: 'request-failed',
        })
        const retryAttempt = yield* pdfs.startJob(application.id, entry.id, {
          expectedPublicationVersion: firstLink.publicationVersion,
          rendererVersion: 'renderer-v1',
          requestId: 'request-retry',
        })
        const firstReady = yield* pdfs.complete(
          application.id,
          retryAttempt.id,
          firstPdf
        )
        const staleAttempt = yield* pdfs.startJob(application.id, entry.id, {
          expectedPublicationVersion: firstLink.publicationVersion,
          rendererVersion: 'renderer-v1',
          requestId: 'request-stale',
        })

        const secondLink = yield* publications.publish(
          application.id,
          entry.id,
          {
            expectedContentVersion: approval.entry.version,
            publicBaseUrl: 'https://new-cv.example.test/c/',
          }
        )
        const staleCompletion = yield* Effect.flip(
          pdfs.complete(application.id, staleAttempt.id, firstPdf)
        )
        const staleRead = yield* Effect.flip(
          pdfs.readCurrent(application.id, entry.id, 'renderer-v1')
        )
        const changedUrlAttempt = yield* pdfs.startJob(
          application.id,
          entry.id,
          {
            expectedPublicationVersion: secondLink.publicationVersion,
            rendererVersion: 'renderer-v1',
            requestId: 'request-changed-url',
          }
        )
        const secondReady = yield* pdfs.complete(
          application.id,
          changedUrlAttempt.id,
          secondPdf
        )
        const current = yield* pdfs.readCurrent(
          application.id,
          entry.id,
          'renderer-v1'
        )

        return {
          changedUrlAttempt,
          current,
          failed,
          failedReplay,
          firstLink,
          firstReady,
          retryAttempt,
          secondLink,
          secondReady,
          staleCompletion,
          staleRead,
        }
      })
    )

    expect(result.failed.status).toBe('failed')
    expect(result.failedReplay).toEqual(result.failed)
    expect(result.retryAttempt.id).not.toBe(result.failed.id)
    expect(result.firstReady.status).toBe('ready')
    expect(result.staleCompletion._tag).toBe('RegistryConflictError')
    expect(result.staleRead._tag).toBe('RegistryNotFoundError')
    expect(result.secondLink.version).toBeGreaterThan(result.firstLink.version)
    expect(result.secondLink.publicUrl).not.toBe(result.firstLink.publicUrl)
    expect(result.changedUrlAttempt.publicationVersion).toBe(
      result.secondLink.publicationVersion
    )
    expect(result.changedUrlAttempt.qrTarget).toBe(result.secondLink.publicUrl)
    expect(result.secondReady.id).toBe(result.changedUrlAttempt.id)
    expect(result.current.artifact.id).toBe(result.secondReady.id)
    expect(result.current.bytes).toEqual(secondPdf)
    expect(state.artifacts.size).toBe(4)
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
          finalUrl: application.canonicalUrl,
          normalized: { bytes: normalized, mediaType: 'application/json' },
          raw: { bytes: raw, mediaType: 'text/html' },
          requestedUrl: application.canonicalUrl,
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
