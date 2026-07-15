import { defineRelations } from 'drizzle-orm'

import { applicationLabels, applicationNotes } from './tables/annotations'
import { applications } from './tables/applications'
import { campaignCaptures } from './tables/captures'
import { applicationCompensations } from './tables/compensations'
import { applicationEvents } from './tables/events'
import { applicationIdentityAliases } from './tables/identity-aliases'

const relationalTables = {
  applicationCompensations,
  applicationEvents,
  applicationIdentityAliases,
  applicationLabels,
  applicationNotes,
  applications,
  campaignCaptures,
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
      captures: relation.many.campaignCaptures({
        from: relation.applications.id,
        to: relation.campaignCaptures.applicationId,
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
    campaignCaptures: {
      application: relation.one.applications({
        from: relation.campaignCaptures.applicationId,
        to: relation.applications.id,
        optional: false,
      }),
    },
  })
)
