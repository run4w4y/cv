import type { CvLink } from '@cv/application-registry-entity'

import type { PublishedCvState } from '../../data'
import type { CvPublicationRun } from '../../publication'

const activePublicationTags = new Set<CvPublicationRun['_tag']>([
  'Queued',
  'PublishingLink',
  'StartingPdf',
  'PollingPdf',
  'VerifyingArtifact',
  'Cancelling',
])

export const cvPublicationIsExecuting = (
  run: CvPublicationRun | null
): boolean => run !== null && activePublicationTags.has(run._tag)

const compareLinkFreshness = (left: CvLink, right: CvLink): number => {
  if (left.publicationVersion !== right.publicationVersion) {
    return left.publicationVersion - right.publicationVersion
  }
  return left.version - right.version
}

const publicationFromRun = (
  run: CvPublicationRun | null
): PublishedCvState | null =>
  run?._tag === 'Published'
    ? { artifact: run.result.artifact, link: run.result.link }
    : null

/**
 * Reconciles the durable query with faster in-memory Workflow and mutation
 * results. The query wins ties; a newer Workflow publication remains visible
 * while its invalidated query catches up.
 */
export const resolveCurrentCvPublication = ({
  availabilityLink,
  publicationRun,
  queriedPublication,
}: {
  readonly availabilityLink: CvLink | null
  readonly publicationRun: CvPublicationRun | null
  readonly queriedPublication: PublishedCvState | null
}): PublishedCvState | null => {
  const runPublication = publicationFromRun(publicationRun)
  const publication =
    runPublication === null
      ? queriedPublication
      : queriedPublication === null
        ? runPublication
        : compareLinkFreshness(queriedPublication.link, runPublication.link) >=
            0
          ? queriedPublication
          : runPublication
  if (
    publication === null ||
    availabilityLink === null ||
    availabilityLink.id !== publication.link.id ||
    availabilityLink.applicationId !== publication.link.applicationId ||
    availabilityLink.contentEntryId !== publication.link.contentEntryId ||
    availabilityLink.publicationVersion !==
      publication.link.publicationVersion ||
    availabilityLink.version < publication.link.version
  ) {
    return publication
  }
  return { ...publication, link: availabilityLink }
}
