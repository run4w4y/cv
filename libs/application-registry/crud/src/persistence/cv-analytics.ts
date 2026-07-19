import {
  applicationLabels,
  applications,
  contentEntries,
  cvLinks,
} from '@cv/application-registry-entity'
import { asc, eq } from 'drizzle-orm'
import { Effect } from 'effect'

import { databaseFailure } from '../errors'
import type { RegistryQueryDatabase } from '../internal/connection'
import type { CvAnalyticsLinkRecord } from '../types'

export const listCvAnalyticsLinks = (database: RegistryQueryDatabase) =>
  database
    .select({
      application: {
        appliedAt: applications.appliedAt,
        applicationStatus: applications.applicationStatus,
        company: applications.company,
        createdAt: applications.createdAt,
        id: applications.id,
        listingAvailability: applications.listingAvailability,
        postingUrl: applications.postingUrl,
        role: applications.role,
      },
      label: applicationLabels.label,
      link: {
        contentEntryId: cvLinks.contentEntryId,
        createdAt: cvLinks.createdAt,
        enabled: cvLinks.enabled,
        id: cvLinks.id,
        currentRevisionId: cvLinks.currentRevisionId,
        token: cvLinks.token,
        updatedAt: cvLinks.updatedAt,
      },
      locale: contentEntries.locale,
    })
    .from(cvLinks)
    .innerJoin(applications, eq(cvLinks.applicationId, applications.id))
    .innerJoin(contentEntries, eq(cvLinks.contentEntryId, contentEntries.id))
    .leftJoin(
      applicationLabels,
      eq(applicationLabels.applicationId, applications.id)
    )
    .orderBy(
      asc(applications.company),
      asc(applications.role),
      asc(cvLinks.id),
      asc(applicationLabels.label)
    )
    .pipe(
      Effect.map((rows) => {
        const records = new Map<string, CvAnalyticsLinkRecord>()

        for (const row of rows) {
          const current = records.get(row.link.id)
          if (current) {
            if (row.label !== null && !current.labels.includes(row.label)) {
              records.set(row.link.id, {
                ...current,
                labels: [...current.labels, row.label],
              })
            }
            continue
          }

          records.set(row.link.id, {
            application: row.application,
            labels: row.label === null ? [] : [row.label],
            link: row.link,
            locale: row.locale,
          })
        }

        return [...records.values()]
      }),
      Effect.mapError(databaseFailure('Failed to list CV analytics links'))
    )
