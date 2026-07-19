import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import type { RegistryClient } from '@/lib/registry-client'
import { makePreparationPublicationRepository } from './publication'

describe('preparation publication repository', () => {
  test('downloads PDF bytes separately from artifact metadata', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70])
    const artifact = { id: 'artifact-1', mediaType: 'application/pdf' }
    const repository = makePreparationPublicationRepository({
      publications: {
        getCurrentPdfArtifact: () => Effect.succeed(artifact),
        readCurrentPdfArtifact: () => Effect.succeed(bytes),
      },
    } as unknown as RegistryClient['Service'])

    const result = await Effect.runPromise(
      repository.readCurrentPdf({
        applicationId: 'application-1',
        entryId: 'entry-1',
      })
    )

    expect(result.bytes).toEqual(bytes)
    expect(result.artifact).toMatchObject(artifact)
  })
})
