import type {
  Application,
  ListingObservation,
} from '@cv/application-registry-entity'

import type { ListingCheckDecision } from '../types'

const hour = 60 * 60 * 1000

const plus = (now: string, milliseconds: number) =>
  new Date(Date.parse(now) + milliseconds).toISOString()

const checkInterval = (application: Application) => {
  switch (application.targetStage) {
    case 'apply_next':
      return 24 * hour
    case 'verify_first':
      return 48 * hour
    case 'secondary':
    case 'backlog':
      return 7 * 24 * hour
    case 'watch_after_move':
      return 14 * 24 * hour
    case 'closed_skip':
      return 30 * 24 * hour
  }
}

const definitiveClosureReasons = new Set(['http_410', 'provider_closed'])

const closureGrace = (observation: ListingObservation) =>
  observation.reasonCode === 'explicit_closed_text' ? 6 * hour : 24 * hour

export const decideListingCheck = (
  application: Application,
  observation: ListingObservation,
  mode: 'report' | 'archive_eligible'
): ListingCheckDecision => {
  const eligibleForArchive =
    application.applicationStatus === 'not_started' ||
    application.applicationStatus === 'preparing'

  if (observation.outcome === 'open') {
    return {
      action: 'keep',
      archiveApplication: false,
      availability: 'open',
      closedCandidateAt: null,
      consecutiveClosedChecks: 0,
      nextCheckAt: plus(observation.checkedAt, checkInterval(application)),
    }
  }

  if (observation.outcome === 'unknown') {
    const preserveCandidate =
      application.listingAvailability === 'suspected_closed' &&
      application.listingClosedCandidateAt !== null
    return {
      action:
        observation.reasonCode === 'identity_mismatch' ? 'review' : 'recheck',
      archiveApplication: false,
      availability: preserveCandidate ? 'suspected_closed' : 'unknown',
      closedCandidateAt: preserveCandidate
        ? application.listingClosedCandidateAt
        : null,
      consecutiveClosedChecks: preserveCandidate
        ? application.listingConsecutiveClosedChecks
        : 0,
      nextCheckAt: plus(observation.checkedAt, 6 * hour),
    }
  }

  const previousCandidate = application.listingClosedCandidateAt
  const grace = closureGrace(observation)
  const candidateMatured =
    previousCandidate !== null &&
    Date.parse(observation.checkedAt) >= Date.parse(previousCandidate) + grace
  const confirmed =
    definitiveClosureReasons.has(observation.reasonCode) || candidateMatured
  const consecutiveClosedChecks =
    application.listingAvailability === 'suspected_closed' ||
    application.listingAvailability === 'closed'
      ? application.listingConsecutiveClosedChecks + 1
      : 1

  if (!confirmed) {
    return {
      action: 'recheck',
      archiveApplication: false,
      availability: 'suspected_closed',
      closedCandidateAt: previousCandidate ?? observation.checkedAt,
      consecutiveClosedChecks,
      nextCheckAt: plus(observation.checkedAt, grace),
    }
  }

  return {
    action: eligibleForArchive ? 'archive' : 'review',
    archiveApplication: mode === 'archive_eligible' && eligibleForArchive,
    availability: 'closed',
    closedCandidateAt: previousCandidate ?? observation.checkedAt,
    consecutiveClosedChecks,
    nextCheckAt: plus(observation.checkedAt, 24 * hour),
  }
}
