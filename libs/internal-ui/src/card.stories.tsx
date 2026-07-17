import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from './badge'
import { Button } from './button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'

const meta = {
  title: 'Surfaces/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const ApplicationSummary: Story = {
  render: () => (
    <Card className="w-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Senior frontend engineer</CardTitle>
            <CardDescription>Acme · Remote</CardDescription>
          </div>
          <Badge variant="warning">Interview</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Applied</dt>
            <dd className="mt-1 font-medium">July 14, 2026</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Priority</dt>
            <dd className="mt-1 font-medium">High</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter>
        <Button size="sm">Open application</Button>
        <Button size="sm" variant="outline">
          Add note
        </Button>
      </CardFooter>
    </Card>
  ),
}
