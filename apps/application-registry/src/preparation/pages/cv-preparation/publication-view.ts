import type { CvLink } from '@cv/application-registry-entity'

import type { CvPageState } from '@/preparation/data'
import type { CvPublicationRun } from '@/preparation/publication'

const activePublicationTags = new Set<CvPublicationRun['_tag']>([
  'Queued',
  'PublishingLink',
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

const pageFromRun = (run: CvPublicationRun | null): CvPageState | null =>
  run?._tag === 'Published' ? { artifact: null, link: run.result.link } : null

/**
 * Reconciles the durable query with faster in-memory Workflow and mutation
 * results. The query wins ties; a newer Workflow publication remains visible
 * while its invalidated query catches up.
 */
export const resolveCurrentCvPage = ({
  availabilityLink,
  publicationRun,
  queriedPage,
}: {
  readonly availabilityLink: CvLink | null
  readonly publicationRun: CvPublicationRun | null
  readonly queriedPage: CvPageState | null
}): CvPageState | null => {
  const runPage = pageFromRun(publicationRun)
  const page =
    runPage === null
      ? queriedPage
      : queriedPage === null
        ? runPage
        : compareLinkFreshness(queriedPage.link, runPage.link) >= 0
          ? queriedPage
          : runPage
  if (
    page === null ||
    availabilityLink === null ||
    availabilityLink.id !== page.link.id ||
    availabilityLink.applicationId !== page.link.applicationId ||
    availabilityLink.contentEntryId !== page.link.contentEntryId ||
    availabilityLink.publicationVersion !== page.link.publicationVersion ||
    availabilityLink.version < page.link.version
  ) {
    return page
  }
  return { ...page, link: availabilityLink }
}
