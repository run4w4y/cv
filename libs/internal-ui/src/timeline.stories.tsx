import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineIndicator,
  TimelineItem,
  type TimelineStatus,
  TimelineTime,
  TimelineTitle,
} from './timeline'

const events: readonly {
  title: string
  description: string
  time: string
  status: TimelineStatus
}[] = [
  {
    title: 'Capture posting',
    description: 'Job description and source metadata saved.',
    time: '10:42:08',
    status: 'complete',
  },
  {
    title: 'Analyze role',
    description: 'Role requirements and signals extracted.',
    time: '10:42:31',
    status: 'complete',
  },
  {
    title: 'Compose document',
    description: 'Generating a tailored CV candidate.',
    time: 'Running for 38 seconds',
    status: 'active',
  },
  {
    title: 'Validate candidate',
    description: 'Waiting for composition.',
    time: 'Pending',
    status: 'pending',
  },
]

const WorkflowTimeline = ({
  orientation = 'vertical',
}: {
  readonly orientation?: 'horizontal' | 'vertical'
}) => (
  <Timeline
    orientation={orientation}
    aria-label="Job progress"
    className={orientation === 'horizontal' ? 'w-4xl' : 'w-xl'}
  >
    {events.map((event) => (
      <TimelineItem key={event.title} status={event.status}>
        <TimelineIndicator />
        <TimelineConnector />
        <TimelineContent>
          <TimelineTitle>{event.title}</TimelineTitle>
          <TimelineDescription>{event.description}</TimelineDescription>
          <TimelineTime>{event.time}</TimelineTime>
        </TimelineContent>
      </TimelineItem>
    ))}
  </Timeline>
)

const meta = {
  title: 'Data Display/Timeline',
  component: Timeline,
  tags: ['autodocs'],
} satisfies Meta<typeof Timeline>

export default meta
type Story = StoryObj<typeof meta>

export const Vertical: Story = {
  render: () => <WorkflowTimeline />,
}

export const Horizontal: Story = {
  render: () => <WorkflowTimeline orientation="horizontal" />,
}

export const Failure: Story = {
  render: () => (
    <Timeline aria-label="Failed job" className="w-xl">
      <TimelineItem status="complete">
        <TimelineIndicator />
        <TimelineConnector />
        <TimelineContent>
          <TimelineTitle>Capture posting</TimelineTitle>
          <TimelineDescription>Source page captured.</TimelineDescription>
        </TimelineContent>
      </TimelineItem>
      <TimelineItem status="error">
        <TimelineIndicator />
        <TimelineContent>
          <TimelineTitle>Analyze role</TimelineTitle>
          <TimelineDescription>
            The captured page did not contain a recognizable job description.
          </TimelineDescription>
          <TimelineTime>Failed after 12 seconds</TimelineTime>
        </TimelineContent>
      </TimelineItem>
    </Timeline>
  ),
}
