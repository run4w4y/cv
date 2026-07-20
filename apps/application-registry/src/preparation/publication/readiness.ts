import type { GeneratedArtifact } from '@cv/application-registry-entity'

import type { CvPageState } from '@/preparation/data'

export const currentCvPdfArtifact = (
  publication: CvPageState
): GeneratedArtifact | null => {
  const { artifact, link } = publication
  return artifact !== null &&
    artifact.cvLinkId === link.id &&
    artifact.contentRevisionId === link.currentRevisionId &&
    artifact.publicationVersion === link.publicationVersion &&
    artifact.qrTarget === link.publicUrl
    ? artifact
    : null
}

export const cvPublicationHasReadyPdf = (publication: CvPageState): boolean =>
  currentCvPdfArtifact(publication)?.status === 'ready'

export const cvPublicationIsShareable = (publication: CvPageState): boolean =>
  publication.link.enabled && cvPublicationHasReadyPdf(publication)

export const cvPublicationCanGeneratePdf = (
  publication: CvPageState
): boolean =>
  publication.link.enabled &&
  currentCvPdfArtifact(publication)?.status !== 'pending'
