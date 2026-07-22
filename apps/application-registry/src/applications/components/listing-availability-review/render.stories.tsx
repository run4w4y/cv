import type { Application } from '@cv/application-registry-entity'
import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import { ListingAvailabilityReviewDialog } from './render'

const suspectedApplication: Application = {
  applicationStatus: 'not_started',
  appliedAt: null,
  postingUrl: 'https://example.com/jobs/staff-engineer',
  company: 'Northstar Labs',
  createdAt: '2026-07-15T09:00:00.000Z',
  followUpAt: null,
  id: 'application-story',
  listingAvailability: 'suspected_closed',
  listingCheckedAt: '2026-07-16T09:30:00.000Z',
  listingClosedCandidateAt: '2026-07-16T09:30:00.000Z',
  listingConfidence: 'medium',
  listingConsecutiveClosedChecks: 1,
  listingReasonCode: 'explicit_closed_text',
  location: 'Remote',
  personalPriority: 'high',
  role: 'Staff Software Engineer',
  targetStage: 'verify_first',
  updatedAt: '2026-07-16T09:30:00.000Z',
  updatedRevision: 2,
  version: 2,
}

const ListingReviewPreview = () => {
  const [application, setApplication] = React.useState(suspectedApplication)
  return (
    <div className="flex min-h-48 items-center justify-center bg-card p-8">
      <ListingAvailabilityReviewDialog
        application={application}
        onResolved={setApplication}
        saveResolution={async (resolution) => ({
          ...application,
          applicationStatus:
            resolution === 'closed'
              ? 'archived'
              : application.applicationStatus,
          listingAvailability: resolution,
          listingClosedCandidateAt: null,
          listingConsecutiveClosedChecks: resolution === 'closed' ? 2 : 0,
          version: application.version + 1,
        })}
      />
    </div>
  )
}

const meta = {
  title: 'Application Registry/Listing availability review',
  component: ListingReviewPreview,
} satisfies Meta<typeof ListingReviewPreview>

export default meta
type Story = StoryObj<typeof meta>

export const SuspectedClosed: Story = {}
