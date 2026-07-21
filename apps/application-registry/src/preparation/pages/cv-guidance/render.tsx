import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from '@cv/internal-ui'
import { useAtom, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { Check, CircleAlert, PencilLine, RotateCcw, X } from 'lucide-react'
import * as React from 'react'

import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  type ActiveCvGenerationGuidance,
  activeCvGenerationGuidanceAtom,
} from '@/preparation/data'
import {
  cvGenerationGuidanceChanged,
  cvGenerationGuidanceOverrideAtom,
  isValidCvGenerationGuidance,
} from '@/preparation/guidance/atoms'
import { CvGenerationGuidanceEditor } from '@/preparation/guidance/editor'
import { HeaderActions } from '@/shell/header-actions'

const PageCard = ({ children }: { readonly children: React.ReactNode }) => (
  <section className="min-h-0 flex-1 overflow-y-auto bg-background p-4 lg:p-6">
    <div className="mx-auto max-w-6xl">{children}</div>
  </section>
)

export const LoadedCvGuidancePage = ({
  loaded,
}: {
  readonly loaded: ActiveCvGenerationGuidance
}) => {
  const [override, setOverride] = useAtom(
    cvGenerationGuidanceOverrideAtom(loaded.factsReleaseId)
  )
  const effective = override ?? loaded.guidance
  const [draft, setDraft] = React.useState<CvGenerationGuidanceV1 | null>(null)
  const editing = draft !== null
  const visibleGuidance = draft ?? effective
  const draftChanged =
    draft !== null && cvGenerationGuidanceChanged(effective, draft)
  const draftValid =
    draft !== null && isValidCvGenerationGuidance(visibleGuidance)

  const applyDraft = () => {
    if (draft === null || !draftChanged || !draftValid) return
    setOverride(
      cvGenerationGuidanceChanged(loaded.guidance, draft) ? draft : null
    )
    setDraft(null)
  }

  return (
    <PageCard>
      <HeaderActions>
        {editing ? (
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              <X /> Cancel
            </Button>
            <Button
              disabled={!draftChanged || !draftValid}
              onClick={applyDraft}
            >
              <Check /> Apply override
            </Button>
          </>
        ) : (
          <>
            {override === null ? null : (
              <Button variant="outline" onClick={() => setOverride(null)}>
                <RotateCcw /> Restore release default
              </Button>
            )}
            <Button onClick={() => setDraft(effective)}>
              <PencilLine /> Edit guidance
            </Button>
          </>
        )}
      </HeaderActions>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-3xl gap-1.5">
              <CardTitle>CV writing guidance</CardTitle>
              <CardDescription>
                Review the instructions used to generate CV content from your
                facts and a job posting. An override applies to new CV workflows
                in this client.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={override === null ? 'outline' : 'default'}>
                {override === null ? 'Release default' : 'Client override'}
              </Badge>
              <Badge variant="outline">
                Facts release {loaded.factsReleaseId}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6">
          {editing && !draftValid ? (
            <p className="text-sm text-destructive" role="alert">
              Complete the guidance name, overall instruction, rules, and every
              field instruction. Keep at least one allowed source selected and
              use whole-number word limits from 1 to 1,000.
            </p>
          ) : null}
          <CvGenerationGuidanceEditor
            base={loaded.guidance}
            editing={editing}
            value={visibleGuidance}
            onChange={setDraft}
          />
        </CardContent>
      </Card>
    </PageCard>
  )
}

export const CvGuidancePage = () => {
  const result = useAtomValue(activeCvGenerationGuidanceAtom)

  if (AsyncResult.isSuccess(result)) {
    return (
      <LoadedCvGuidancePage
        key={result.value.factsReleaseId}
        loaded={result.value}
      />
    )
  }

  const error =
    asyncResultErrorMessage(
      result,
      'CV writing guidance could not be loaded from the active facts release.'
    ) ?? null

  return (
    <PageCard>
      <Card>
        <CardHeader>
          <CardTitle>CV writing guidance</CardTitle>
          <CardDescription>
            Instructions used to generate CV content from your facts and a job
            posting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner aria-hidden /> Loading guidance…
            </div>
          ) : (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>CV guidance unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </PageCard>
  )
}
