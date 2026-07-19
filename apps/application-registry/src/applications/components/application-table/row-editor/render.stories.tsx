import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import * as React from 'react'
import { ApplicationsTable } from '..'

const application: ApplicationListItem = {
  id: 'application-1',
  postingUrl: 'https://example.test/jobs/one',
  company: 'Example Systems',
  role: 'Staff Platform Engineer working across a distributed systems estate',
  location: 'Remote — Europe',
  applicationStatus: 'technical_screen',
  targetStage: 'apply_next',
  personalPriority: 'high',
  followUpAt: '2026-07-20T09:30:00.000Z',
  appliedAt: null,
  listingAvailability: 'open',
  listingCheckedAt: '2026-07-15T09:30:00.000Z',
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  version: 1,
  updatedRevision: 4,
  createdAt: '2026-07-01T09:30:00.000Z',
  updatedAt: '2026-07-15T09:30:00.000Z',
  annualCompensation: {
    currencyCode: 'USD',
    minimumMinor: 15_000_000,
    maximumMinor: 18_000_000,
  },
  counts: { notes: 2 },
  labels: ['TypeScript', 'Remote'],
  latestActivity: {
    kind: 'status_changed',
    occurredAt: '2026-07-15T09:30:00.000Z',
  },
}

const RegistryMutationStub = ({
  children,
}: {
  readonly children: ReactNode
}) => {
  React.useEffect(() => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const url = String(input)
      if (
        init?.method === 'PATCH' &&
        url.endsWith(`/api/registry/applications/${application.id}`)
      ) {
        const request = JSON.parse(String(init.body)) as {
          readonly annualCompensation: ApplicationListItem['annualCompensation']
          readonly labels: readonly string[]
          readonly patch: Partial<ApplicationListItem>
        }
        return Response.json({
          application: {
            ...application,
            ...request.patch,
            version: application.version + 1,
          },
          annualCompensation: request.annualCompensation,
          labels: request.labels,
        })
      }
      return Response.json(
        {
          code: 'storybook_transport_blocked',
          message: 'This Storybook story does not call the registry API.',
        },
        { status: 501 }
      )
    }) as typeof fetch
    return () => {
      globalThis.fetch = originalFetch
    }
  }, [])

  return children
}

const ApplicationRowEditorPreview = () => (
  <RegistryMutationStub>
    <div className="flex h-dvh min-h-0 flex-col bg-card">
      <ApplicationsTable
        data={[application]}
        loading={false}
        sorting={[]}
        onSortingChange={() => undefined}
        density="comfortable"
        onDensityChange={() => undefined}
        columnVisibility={{}}
        onColumnVisibilityChange={() => undefined}
        hasNextPage={false}
        loadingMore={false}
        onLoadMore={() => undefined}
        availableLabels={['Remote', 'TypeScript', 'Priority']}
      />
    </div>
  </RegistryMutationStub>
)

const meta = {
  title: 'Application Registry/Row editor',
  component: ApplicationRowEditorPreview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ApplicationRowEditorPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
