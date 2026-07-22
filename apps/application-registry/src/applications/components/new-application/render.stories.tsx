import type { Application } from '@cv/application-registry-entity'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { NewApplicationDialog } from './render'

const createdApplication: Application = {
  id: 'application-story-created',
  postingUrl: 'https://example.test/jobs/new-application',
  company: 'Example Systems',
  role: 'Staff Engineer',
  location: 'Remote',
  applicationStatus: 'not_started',
  targetStage: 'apply_next',
  personalPriority: null,
  followUpAt: null,
  appliedAt: null,
  listingAvailability: 'unknown',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  version: 1,
  updatedRevision: 1,
  createdAt: '2026-07-17T08:00:00.000Z',
  updatedAt: '2026-07-17T08:00:00.000Z',
}

const NewApplicationDialogPreview = () => (
  <NewApplicationDialog
    saveApplication={async (input) => ({
      ...createdApplication,
      ...input,
      location: input.location ?? null,
    })}
  />
)

const meta = {
  title: 'Application Registry/New application dialog',
  component: NewApplicationDialogPreview,
  tags: ['autodocs'],
} satisfies Meta<typeof NewApplicationDialogPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
