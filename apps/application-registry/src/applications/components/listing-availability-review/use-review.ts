import { ConflictError } from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { useAtom, useAtomSet } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as React from 'react'

import {
  reloadLatestApplication,
  resolveApplicationListingAvailability,
} from '../../data'
import {
  type OperationSubmission,
  operationSubmissionFor,
} from '../../model/operation-submission'

const archiveEligibleStatuses = new Set(['not_started', 'preparing'])

export type ListingResolution = 'open' | 'closed'

export type SaveListingResolution = (
  resolution: ListingResolution,
  operationId: string
) => Promise<Application>

export const useListingAvailabilityReview = ({
  application,
  onResolved,
  saveResolution,
}: {
  readonly application: Application
  readonly onResolved?: (application: Application) => void
  readonly saveResolution?: SaveListingResolution
}) => {
  const [listingResult, saveListingResolution] = useAtom(
    resolveApplicationListingAvailability,
    { mode: 'promise' }
  )
  const resetListingResolution = useAtomSet(
    resolveApplicationListingAvailability
  )
  const [reloadResult, reloadApplication] = useAtom(reloadLatestApplication, {
    mode: 'promise',
  })
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState<ListingResolution>()
  const [overrideFailure, setOverrideFailure] = React.useState<unknown>()
  const [recoveryError, setRecoveryError] = React.useState<string>()
  const session = React.useRef<
    | {
        applicationId: string
        expectedVersion: number
        submission?: OperationSubmission
      }
    | undefined
  >(undefined)

  const listingFailure = AsyncResult.matchWithError(listingResult, {
    onInitial: () => undefined,
    onError: (error) => error,
    onDefect: (defect) => defect,
    onSuccess: () => undefined,
  })
  const mutationFailure = listingFailure ?? overrideFailure
  const conflict = mutationFailure instanceof ConflictError
  const error =
    recoveryError ??
    (mutationFailure === undefined
      ? undefined
      : mutationFailure instanceof Error
        ? mutationFailure.message
        : 'The listing review could not be saved.')
  const reloading = AsyncResult.isWaiting(reloadResult)

  const resetSession = () => {
    session.current = undefined
    setRecoveryError(undefined)
    setOverrideFailure(undefined)
    resetListingResolution(Atom.Reset)
  }

  const onOpenChange = (nextOpen: boolean) => {
    if (saving !== undefined || reloading) return
    setOpen(nextOpen)
    resetSession()
    if (nextOpen) {
      session.current = {
        applicationId: application.id,
        expectedVersion: application.version,
      }
    }
  }

  const resolve = (resolution: ListingResolution) => {
    const activeSession = session.current
    if (activeSession === undefined) return
    const payload = {
      applicationId: activeSession.applicationId,
      expectedVersion: activeSession.expectedVersion,
      resolution,
    }
    activeSession.submission = operationSubmissionFor(
      activeSession.submission,
      payload
    )
    const operationId = activeSession.submission.operationId
    setSaving(resolution)
    setOverrideFailure(undefined)
    const save =
      saveResolution === undefined
        ? saveListingResolution({
            applicationId: activeSession.applicationId,
            input: {
              expectedVersion: activeSession.expectedVersion,
              operationId,
              resolution,
            },
          }).then((response) => response.application)
        : saveResolution(resolution, operationId)

    void save
      .then((updated) => {
        onResolved?.(updated)
        session.current = undefined
        setOpen(false)
      })
      .catch((reason: unknown) => {
        if (saveResolution !== undefined) setOverrideFailure(reason)
      })
      .finally(() => setSaving(undefined))
  }

  const reloadLatest = () => {
    const activeSession = session.current
    if (activeSession === undefined) return
    setRecoveryError(undefined)
    void reloadApplication(activeSession.applicationId)
      .then(() => {
        resetSession()
        setOpen(false)
      })
      .catch((reason: unknown) => {
        setRecoveryError(
          reason instanceof Error
            ? `Could not reload the latest application: ${reason.message}`
            : 'Could not reload the latest application.'
        )
      })
  }

  return {
    archivesApplication: archiveEligibleStatuses.has(
      application.applicationStatus
    ),
    conflict,
    error,
    onOpenChange,
    open,
    reloadLatest,
    reloading,
    resolve,
    saving,
  }
}
