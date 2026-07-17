import type { CreateApplicationRequest } from '@cv/application-registry-api-contract'
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
import { AlertCircle, Plus } from 'lucide-react'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'

import { createApplication } from '../../data'
import { NewApplicationFields } from './fields'
import {
  type NewApplicationFormInput,
  type NewApplicationFormOutput,
  NewApplicationFormSchema,
  newApplicationDefaults,
  newApplicationRequest,
  newApplicationRequestFromOutput,
} from './schema'

export const NewApplicationDialog = ({
  saveApplication,
}: {
  readonly saveApplication?: (
    request: CreateApplicationRequest
  ) => Promise<Application>
} = {}) => {
  const navigate = useNavigate()
  const [createResult, saveNewApplication] = useAtom(createApplication, {
    mode: 'promise',
  })
  const resetCreate = useAtomSet(createApplication)
  const [open, setOpen] = React.useState(false)
  const [overrideSaving, setOverrideSaving] = React.useState(false)
  const [overrideError, setOverrideError] = React.useState<string>()
  const form = useForm<
    NewApplicationFormInput,
    undefined,
    NewApplicationFormOutput
  >({
    defaultValues: newApplicationDefaults,
    mode: 'onSubmit',
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(NewApplicationFormSchema)
    ),
  })
  const createFailure = AsyncResult.matchWithError(createResult, {
    onInitial: () => undefined,
    onError: (error) => error,
    onDefect: (defect) => defect,
    onSuccess: () => undefined,
  })
  const saving = AsyncResult.isWaiting(createResult) || overrideSaving
  const error =
    form.formState.errors.root?.server?.message ??
    overrideError ??
    (createFailure === undefined
      ? undefined
      : createFailure instanceof Error
        ? createFailure.message
        : 'The application could not be created.')

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root.server')
    setOverrideError(undefined)
    if (saveApplication !== undefined) setOverrideSaving(true)
    try {
      const application = await (saveApplication === undefined
        ? saveNewApplication(newApplicationRequestFromOutput(values))
        : saveApplication(newApplicationRequestFromOutput(values)))
      form.reset(newApplicationDefaults)
      setOpen(false)
      navigate(`/applications/${application.id}`)
    } catch (reason) {
      if (saveApplication !== undefined) {
        setOverrideError(
          reason instanceof Error
            ? reason.message
            : 'The application could not be created.'
        )
      }
    } finally {
      setOverrideSaving(false)
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return
        setOpen(next)
        if (!next) {
          form.reset(newApplicationDefaults)
          setOverrideError(undefined)
          resetCreate(Atom.Reset)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" size="sm">
            <Plus />
            New application
          </Button>
        }
      />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New application</DialogTitle>
          <DialogDescription>
            Add an opportunity and its original annual compensation range.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={submit}>
            <NewApplicationFields pending={saving} />
            {error === undefined ? null : (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create application'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export { newApplicationRequest }
