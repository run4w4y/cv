import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
} from '@cv/internal-ui'
import { Settings2 } from 'lucide-react'
import { Link } from 'react-router'

import { cvGenerationGuidanceChanged } from './atoms'

export const CvGenerationGuidanceSummary = ({
  base,
  factsReleaseId,
  value,
}: {
  readonly base: CvGenerationGuidanceV1
  readonly factsReleaseId: string
  readonly value: CvGenerationGuidanceV1
}) => {
  const overridden = cvGenerationGuidanceChanged(base, value)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <CardTitle>CV writing guidance</CardTitle>
            <CardDescription>
              New workflows use “{value.label}” and freeze that guidance when
              they start.
            </CardDescription>
          </div>
          <Badge variant={overridden ? 'default' : 'outline'}>
            {overridden ? 'Client override' : 'Release default'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Facts release {factsReleaseId} · {value.fields.length} guided fields
        </p>
        <Link
          className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
          to="/preparation/cv-guidance"
        >
          <Settings2 /> Manage guidance
        </Link>
      </CardContent>
    </Card>
  )
}
