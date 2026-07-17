import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from './badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

const applications = [
  ['Acme', 'Senior frontend engineer', 'Interview'],
  ['Northstar', 'Platform engineer', 'Applied'],
  ['Atlas', 'Product engineer', 'Offer'],
] as const

const meta = {
  title: 'Data Display/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

export const ApplicationRegistry: Story = {
  render: () => (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map(([company, role, status]) => (
            <TableRow key={company}>
              <TableCell className="font-medium">{company}</TableCell>
              <TableCell>{role}</TableCell>
              <TableCell>
                <Badge variant={status === 'Offer' ? 'success' : 'default'}>
                  {status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
}
