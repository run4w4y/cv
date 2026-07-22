import { defineRelations } from 'drizzle-orm'
import { applicationActivities } from './tables/activities'
import { applicationLabels, applicationNotes } from './tables/annotations'
import { applications } from './tables/applications'
import { generatedArtifacts } from './tables/artifacts'
import { applicationCompensations } from './tables/compensations'
import { contentEntries, contentRevisions } from './tables/content'
import { cvLinks } from './tables/cv-links'
import { jobPostingSnapshots } from './tables/job-posting-snapshots'

const relationalTables = {
  applicationCompensations,
  applicationActivities,
  applicationLabels,
  applicationNotes,
  applications,
  contentEntries,
  contentRevisions,
  cvLinks,
  generatedArtifacts,
  jobPostingSnapshots,
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
      activities: relation.many.applicationActivities({
        from: relation.applications.id,
        to: relation.applicationActivities.applicationId,
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
    },
    applicationCompensations: {
      application: relation.one.applications({
        from: relation.applicationCompensations.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
    },
    applicationActivities: {
      application: relation.one.applications({
        from: relation.applicationActivities.applicationId,
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
    },
    contentRevisions: {
      entry: relation.one.contentEntries({
        from: relation.contentRevisions.contentEntryId,
        to: relation.contentEntries.id,
        optional: false,
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
      currentRevision: relation.one.contentRevisions({
        from: relation.cvLinks.currentRevisionId,
        to: relation.contentRevisions.id,
        optional: false,
      }),
      artifacts: relation.many.generatedArtifacts({
        from: relation.cvLinks.id,
        to: relation.generatedArtifacts.cvLinkId,
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
