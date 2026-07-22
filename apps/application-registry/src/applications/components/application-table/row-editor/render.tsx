import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import { Form } from '@cv/internal-forms'
import { useAtom, useAtomSet } from '@effect/atom-react'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { Schema } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as React from 'react'
import { useForm } from 'react-hook-form'

import { asyncResultError } from '@/lib/async-result'
import {
  reloadLatestApplication,
  updateManagedApplication,
} from '../../../data'
import {
  type OperationSubmission,
  operationSubmissionFor,
} from '../../../model/operation-submission'
import {
  type ApplicationRowEditFormInput,
  type ApplicationRowEditFormOutput,
  ApplicationRowEditFormSchema,
  applicationRowEditDefaults,
} from '../../application-editor/schema'

type ApplicationRowEditorContextValue = {
  readonly cancel: () => void
  readonly formId: string
  readonly isConflict: boolean
  readonly pending: boolean
  readonly reloadLatest: () => void
  readonly serverError?: string
  readonly submit: React.FormEventHandler<HTMLFormElement>
}

const ApplicationRowEditorContext = React.createContext<
  ApplicationRowEditorContextValue | undefined
>(undefined)

export const useApplicationRowEditor = () => {
  const context = React.useContext(ApplicationRowEditorContext)
  if (context === undefined) {
    throw new Error(
      'useApplicationRowEditor must be used inside ApplicationRowEditor.'
    )
  }
  return context
}

export const ApplicationRowEditor = ({
  application,
  children,
  onCancel,
}: {
  readonly application: ApplicationListItem
  readonly children: React.ReactNode
  readonly onCancel: () => void
}) => {
  const generatedId = React.useId()
  const formId = `application-row-${generatedId.replaceAll(':', '')}`
  const [updateResult, saveApplication] = useAtom(updateManagedApplication, {
    mode: 'promise',
  })
  const resetUpdate = useAtomSet(updateManagedApplication)
  const [reloadResult, reloadApplication] = useAtom(reloadLatestApplication, {
    mode: 'promise',
  })
  const draft = React.useRef({
    applicationId: application.id,
    expectedVersion: application.version,
  })
  const submission = React.useRef<OperationSubmission | undefined>(undefined)
  const form = useForm<
    ApplicationRowEditFormInput,
    undefined,
    ApplicationRowEditFormOutput
  >({
    defaultValues: applicationRowEditDefaults(application),
    mode: 'onSubmit',
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(ApplicationRowEditFormSchema)
    ),
  })

  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root.server')
    try {
      const input = {
        ...values,
        expectedVersion: draft.current.expectedVersion,
        labels: [...new Set(values.labels)],
      }
      submission.current = operationSubmissionFor(submission.current, input)
      await saveApplication({
        applicationId: draft.current.applicationId,
        idempotencyKey: submission.current.operationId,
        input,
      })
      submission.current = undefined
      onCancel()
    } catch (reason) {
      form.setError('root.server', {
        message:
          reason instanceof Error
            ? reason.message
            : 'The application row could not be saved.',
      })
    }
  })

  const cancel = () => {
    submission.current = undefined
    resetUpdate(Atom.Reset)
    onCancel()
  }
  const reloadLatest = () => {
    void reloadApplication(draft.current.applicationId)
      .then(() => {
        submission.current = undefined
        resetUpdate(Atom.Reset)
        onCancel()
      })
      .catch((reason: unknown) => {
        form.setError('root.server', {
          message:
            reason instanceof Error
              ? `Could not reload the latest row: ${reason.message}`
              : 'Could not reload the latest row.',
        })
      })
  }
  const error = form.formState.errors.root?.server?.message
  const updateFailure = asyncResultError(updateResult)
  const context: ApplicationRowEditorContextValue = {
    cancel,
    formId,
    isConflict: updateFailure?._tag === 'ConflictError',
    pending:
      AsyncResult.isWaiting(updateResult) ||
      AsyncResult.isWaiting(reloadResult),
    reloadLatest,
    serverError: typeof error === 'string' ? error : undefined,
    submit,
  }

  return (
    <Form {...form}>
      <ApplicationRowEditorContext.Provider value={context}>
        {children}
      </ApplicationRowEditorContext.Provider>
    </Form>
  )
}
