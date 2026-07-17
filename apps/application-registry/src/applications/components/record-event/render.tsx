import { ConflictError } from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { Form } from '@cv/internal-forms'
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@cv/internal-ui'
import { useAtom, useAtomSet } from '@effect/atom-react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { Schema } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { Activity, AlertCircle } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'

import { appendApplicationEvent, reloadLatestApplication } from '../../data'
import {
  type OperationSubmission,
  operationSubmissionFor,
} from '../../model/operation-submission'
import { RecordEventFields } from './fields'
import {
  RecordEventFormSchema,
  type RecordEventValues,
  recordEventDefaults,
  recordEventRequest,
} from './schema'

export const RecordEventDialog = ({
  application,
  onSaved,
}: {
  readonly application: Application
  readonly onSaved?: (application: Application) => void
}) => {
  const [eventResult, saveApplicationEvent] = useAtom(appendApplicationEvent, {
    mode: 'promise',
  })
  const resetApplicationEvent = useAtomSet(appendApplicationEvent)
  const [reloadResult, reloadApplication] = useAtom(reloadLatestApplication, {
    mode: 'promise',
  })
  const [open, setOpen] = React.useState(false)
  const form = useForm<RecordEventValues>({
    defaultValues: recordEventDefaults(application),
    mode: 'onSubmit',
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(RecordEventFormSchema)
    ),
  })
  const session = React.useRef<
    | {
        applicationId: string
        expectedVersion: number
        submission?: OperationSubmission
      }
    | undefined
  >(undefined)
  const eventFailure = AsyncResult.matchWithError(eventResult, {
    onInitial: () => undefined,
    onError: (error) => error,
    onDefect: (defect) => defect,
    onSuccess: () => undefined,
  })
  const saving = AsyncResult.isWaiting(eventResult)
  const conflict = eventFailure instanceof ConflictError
  const reloading = AsyncResult.isWaiting(reloadResult)
  const blocked = saving || reloading || conflict
  const error =
    form.formState.errors.root?.server?.message ??
    (eventFailure === undefined
      ? undefined
      : eventFailure instanceof Error
        ? eventFailure.message
        : 'The event could not be recorded.')

  const submit = form.handleSubmit(async (values) => {
    const activeSession = session.current
    if (activeSession === undefined || conflict) return
    form.clearErrors('root.server')
    const fingerprintRequest = recordEventRequest(
      values,
      activeSession.expectedVersion,
      'payload-fingerprint'
    )
    activeSession.submission = operationSubmissionFor(
      activeSession.submission,
      fingerprintRequest
    )
    try {
      const response = await saveApplicationEvent({
        applicationId: activeSession.applicationId,
        input: {
          ...fingerprintRequest,
          operationId: activeSession.submission.operationId,
        },
      })
      onSaved?.(response.application)
      session.current = undefined
      form.reset(recordEventDefaults(response.application))
      setOpen(false)
    } catch {
      // The mutation AsyncResult owns transport and conflict presentation.
    }
  })

  const reloadLatest = async () => {
    const activeSession = session.current
    if (activeSession === undefined) return
    form.clearErrors('root.server')
    try {
      const latest = await reloadApplication(activeSession.applicationId)
      form.reset(recordEventDefaults(latest))
      session.current = undefined
      resetApplicationEvent(Atom.Reset)
      setOpen(false)
    } catch (reason) {
      form.setError('root.server', {
        message:
          reason instanceof Error
            ? `Could not reload the latest application: ${reason.message}`
            : 'Could not reload the latest application.',
      })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (saving || reloading) return
        setOpen(nextOpen)
        form.clearErrors()
        resetApplicationEvent(Atom.Reset)
        if (nextOpen) {
          form.reset(recordEventDefaults(application))
          session.current = {
            applicationId: application.id,
            expectedVersion: application.version,
          }
        } else {
          session.current = undefined
          form.reset(recordEventDefaults(application))
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Activity />
            Record event
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record application event</DialogTitle>
          <DialogDescription>
            Add an auditable timeline entry with an optimistic version check.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={submit}>
            <RecordEventFields blocked={blocked} />
            {error === undefined ? null : (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
                {conflict ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-fit"
                    disabled={reloading}
                    onClick={() => void reloadLatest()}
                  >
                    <Activity className={reloading ? 'animate-spin' : ''} />
                    {reloading ? 'Reloading…' : 'Reload latest and restart'}
                  </Button>
                ) : null}
              </Alert>
            )}
            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="outline"
                disabled={saving || reloading}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={blocked}>
                {saving ? 'Recording…' : 'Record event'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export { recordEventRequest }
export type { RecordEventValues }
