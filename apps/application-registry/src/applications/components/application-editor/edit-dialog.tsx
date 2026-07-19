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
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { AlertCircle, Pencil, RefreshCw } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'

import { reloadLatestApplication, updateManagedApplication } from '../../data'
import {
  type OperationSubmission,
  operationSubmissionFor,
} from '../../model/operation-submission'
import { ApplicationEditFields } from './fields'
import {
  type ApplicationDetailEditFormInput,
  type ApplicationDetailEditFormOutput,
  ApplicationDetailEditFormSchema,
  applicationDetailEditDefaults,
} from './schema'

export const ApplicationEditDialog = ({
  application,
  onSaved,
}: {
  readonly application: Application
  readonly onSaved?: (application: Application) => void
}) => {
  const [open, setOpen] = React.useState(false)
  const [reloading, setReloading] = React.useState(false)
  const [updateResult, saveApplication] = useAtom(updateManagedApplication, {
    mode: 'promise',
  })
  const resetUpdate = useAtomSet(updateManagedApplication)
  const [reloadResult, reloadApplication] = useAtom(reloadLatestApplication, {
    mode: 'promise',
  })
  const draft = React.useRef<
    | {
        applicationId: string
        expectedVersion: number
        submission?: OperationSubmission
      }
    | undefined
  >(undefined)
  const form = useForm<
    ApplicationDetailEditFormInput,
    undefined,
    ApplicationDetailEditFormOutput
  >({
    defaultValues: applicationDetailEditDefaults(application),
    mode: 'onSubmit',
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(ApplicationDetailEditFormSchema)
    ),
  })
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root.server')
    const activeDraft = draft.current
    if (activeDraft === undefined) {
      form.setError('root.server', {
        message: 'Close and reopen the editor before saving.',
      })
      return
    }
    try {
      const input = {
        ...values,
        postingUrl: values.postingUrl.toString(),
        expectedVersion: activeDraft.expectedVersion,
      }
      activeDraft.submission = operationSubmissionFor(
        activeDraft.submission,
        input
      )
      const response = await saveApplication({
        applicationId: activeDraft.applicationId,
        idempotencyKey: activeDraft.submission.operationId,
        input,
      })
      activeDraft.submission = undefined
      onSaved?.(response.application)
      form.reset(applicationDetailEditDefaults(response.application))
      draft.current = undefined
      setOpen(false)
    } catch (reason) {
      form.setError('root.server', {
        message:
          reason instanceof Error
            ? reason.message
            : 'The application could not be updated.',
      })
    }
  })
  const updateFailure = AsyncResult.matchWithError(updateResult, {
    onInitial: () => undefined,
    onError: (error) => error,
    onDefect: (defect) => defect,
    onSuccess: () => undefined,
  })
  const conflict = updateFailure instanceof ConflictError
  const pending =
    AsyncResult.isWaiting(updateResult) ||
    reloading ||
    AsyncResult.isWaiting(reloadResult)
  const serverError = form.formState.errors.root?.server?.message

  const reloadLatest = async () => {
    const activeDraft = draft.current
    if (activeDraft === undefined) return
    setReloading(true)
    form.clearErrors('root.server')
    try {
      const latest = await reloadApplication(activeDraft.applicationId)
      form.reset(applicationDetailEditDefaults(latest))
      draft.current = {
        applicationId: latest.id,
        expectedVersion: latest.version,
      }
      resetUpdate(Atom.Reset)
    } catch (reason) {
      form.setError('root.server', {
        message:
          reason instanceof Error
            ? `Could not reload the latest application: ${reason.message}`
            : 'Could not reload the latest application.',
      })
    } finally {
      setReloading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        setOpen(nextOpen)
        resetUpdate(Atom.Reset)
        form.reset(applicationDetailEditDefaults(application))
        draft.current = nextOpen
          ? {
              applicationId: application.id,
              expectedVersion: application.version,
            }
          : undefined
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Pencil />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit application</DialogTitle>
          <DialogDescription>
            Update registry metadata. All fields are saved atomically with a
            version check.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={submit}>
            <ApplicationEditFields pending={pending} />
            {serverError === undefined ? null : (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle />
                <AlertDescription>{serverError}</AlertDescription>
                {conflict ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-fit"
                    disabled={reloading}
                    onClick={() => void reloadLatest()}
                  >
                    <RefreshCw className={reloading ? 'animate-spin' : ''} />
                    {reloading ? 'Reloading…' : 'Reload latest application'}
                  </Button>
                ) : null}
              </Alert>
            )}
            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending || conflict}>
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
