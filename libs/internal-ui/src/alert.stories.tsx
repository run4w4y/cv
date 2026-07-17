import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertTriangle, CircleAlert, Info } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from './alert'

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  tags: ['autodocs'],
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => (
    <div className="grid w-xl gap-3">
      <Alert>
        <Info />
        <AlertTitle>Registry synchronized</AlertTitle>
        <AlertDescription>Application metadata is up to date.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Listing expires soon</AlertTitle>
        <AlertDescription>
          Review this application in two days.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Synchronization failed</AlertTitle>
        <AlertDescription>Try the operation again.</AlertDescription>
      </Alert>
    </div>
  ),
}
