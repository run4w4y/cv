import { defineRelations } from 'drizzle-orm'

import { applicationLabels, applicationNotes } from './tables/annotations'
import { applications } from './tables/applications'
import { generatedArtifacts } from './tables/artifacts'
import { applicationCompensations } from './tables/compensations'
import { contentEntries, contentRevisions } from './tables/content'
import { cvLinks } from './tables/cv-links'
import { applicationEvents } from './tables/events'
import {
  factsChannels,
  factsReleaseAssets,
  factsReleaseCatalogs,
  factsReleases,
} from './tables/facts-releases'
import { applicationIdentityAliases } from './tables/identity-aliases'
import { jobPostingSnapshots } from './tables/job-posting-snapshots'
import { pdfGenerationOutbox } from './tables/pdf-generation-outbox'

const relationalTables = {
  applicationCompensations,
  applicationEvents,
  applicationIdentityAliases,
  applicationLabels,
  applicationNotes,
  applications,
  contentEntries,
  contentRevisions,
  cvLinks,
  factsChannels,
  factsReleaseAssets,
  factsReleaseCatalogs,
  factsReleases,
  generatedArtifacts,
  jobPostingSnapshots,
  pdfGenerationOutbox,
}

/** Drizzle relation graph used by application-registry relational queries. */
export const applicationRegistryRelations = defineRelations(
  relationalTables,
  (relation) => ({
    applications: {
      compensations: relation.many.applicationCompensations({
        from: relation.applications.id,
        to: relation.applicationCompensations.applicationId,
      }),
      events: relation.many.applicationEvents({
        from: relation.applications.id,
        to: relation.applicationEvents.applicationId,
      }),
      identityAliases: relation.many.applicationIdentityAliases({
        from: relation.applications.id,
        to: relation.applicationIdentityAliases.applicationId,
      }),
      labels: relation.many.applicationLabels({
        from: relation.applications.id,
        to: relation.applicationLabels.applicationId,
      }),
      notes: relation.many.applicationNotes({
        from: relation.applications.id,
        to: relation.applicationNotes.applicationId,
      }),
      contentEntries: relation.many.contentEntries({
        from: relation.applications.id,
        to: relation.contentEntries.applicationId,
      }),
      cvLinks: relation.many.cvLinks({
        from: relation.applications.id,
        to: relation.cvLinks.applicationId,
      }),
      jobPostingSnapshots: relation.many.jobPostingSnapshots({
        from: relation.applications.id,
        to: relation.jobPostingSnapshots.applicationId,
      }),
      pdfGenerationOutbox: relation.many.pdfGenerationOutbox({
        from: relation.applications.id,
        to: relation.pdfGenerationOutbox.applicationId,
      }),
    },
    applicationCompensations: {
      application: relation.one.applications({
        from: relation.applicationCompensations.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
    },
    applicationEvents: {
      application: relation.one.applications({
        from: relation.applicationEvents.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
    },
    applicationIdentityAliases: {
      application: relation.one.applications({
        from: relation.applicationIdentityAliases.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
    },
    applicationLabels: {
      application: relation.one.applications({
        from: relation.applicationLabels.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
    },
    applicationNotes: {
      application: relation.one.applications({
        from: relation.applicationNotes.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
    },
    contentEntries: {
      application: relation.one.applications({
        from: relation.contentEntries.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
      revisions: relation.many.contentRevisions({
        from: relation.contentEntries.id,
        to: relation.contentRevisions.contentEntryId,
      }),
      cvLink: relation.one.cvLinks({
        from: relation.contentEntries.id,
        to: relation.cvLinks.contentEntryId,
        optional: true,
      }),
      pdfGenerationOutbox: relation.many.pdfGenerationOutbox({
        from: relation.contentEntries.id,
        to: relation.pdfGenerationOutbox.contentEntryId,
      }),
    },
    contentRevisions: {
      entry: relation.one.contentEntries({
        from: relation.contentRevisions.contentEntryId,
        to: relation.contentEntries.id,
        optional: false,
      }),
      factsRelease: relation.one.factsReleases({
        from: relation.contentRevisions.factsReleaseId,
        to: relation.factsReleases.id,
        optional: true,
      }),
      jobSnapshot: relation.one.jobPostingSnapshots({
        from: relation.contentRevisions.jobSnapshotId,
        to: relation.jobPostingSnapshots.id,
        optional: true,
      }),
      artifacts: relation.many.generatedArtifacts({
        from: relation.contentRevisions.id,
        to: relation.generatedArtifacts.contentRevisionId,
      }),
    },
    cvLinks: {
      application: relation.one.applications({
        from: relation.cvLinks.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
      entry: relation.one.contentEntries({
        from: relation.cvLinks.contentEntryId,
        to: relation.contentEntries.id,
        optional: false,
      }),
      publishedRevision: relation.one.contentRevisions({
        from: relation.cvLinks.publishedRevisionId,
        to: relation.contentRevisions.id,
        optional: false,
      }),
      artifacts: relation.many.generatedArtifacts({
        from: relation.cvLinks.id,
        to: relation.generatedArtifacts.cvLinkId,
      }),
    },
    factsReleases: {
      catalogs: relation.many.factsReleaseCatalogs({
        from: relation.factsReleases.id,
        to: relation.factsReleaseCatalogs.releaseId,
      }),
      assets: relation.many.factsReleaseAssets({
        from: relation.factsReleases.id,
        to: relation.factsReleaseAssets.releaseId,
      }),
      channels: relation.many.factsChannels({
        from: relation.factsReleases.id,
        to: relation.factsChannels.activeReleaseId,
      }),
    },
    factsReleaseCatalogs: {
      release: relation.one.factsReleases({
        from: relation.factsReleaseCatalogs.releaseId,
        to: relation.factsReleases.id,
        optional: false,
      }),
    },
    factsReleaseAssets: {
      release: relation.one.factsReleases({
        from: relation.factsReleaseAssets.releaseId,
        to: relation.factsReleases.id,
        optional: false,
      }),
    },
    factsChannels: {
      activeRelease: relation.one.factsReleases({
        from: relation.factsChannels.activeReleaseId,
        to: relation.factsReleases.id,
        optional: false,
      }),
    },
    generatedArtifacts: {
      cvLink: relation.one.cvLinks({
        from: relation.generatedArtifacts.cvLinkId,
        to: relation.cvLinks.id,
        optional: false,
      }),
      contentRevision: relation.one.contentRevisions({
        from: relation.generatedArtifacts.contentRevisionId,
        to: relation.contentRevisions.id,
        optional: false,
      }),
      outbox: relation.one.pdfGenerationOutbox({
        from: relation.generatedArtifacts.id,
        to: relation.pdfGenerationOutbox.artifactId,
        optional: true,
      }),
    },
    pdfGenerationOutbox: {
      application: relation.one.applications({
        from: relation.pdfGenerationOutbox.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
      artifact: relation.one.generatedArtifacts({
        from: relation.pdfGenerationOutbox.artifactId,
        to: relation.generatedArtifacts.id,
        optional: false,
      }),
      contentEntry: relation.one.contentEntries({
        from: relation.pdfGenerationOutbox.contentEntryId,
        to: relation.contentEntries.id,
        optional: false,
      }),
    },
    jobPostingSnapshots: {
      application: relation.one.applications({
        from: relation.jobPostingSnapshots.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
      contentRevisions: relation.many.contentRevisions({
        from: relation.jobPostingSnapshots.id,
        to: relation.contentRevisions.jobSnapshotId,
      }),
    },
  })
)
