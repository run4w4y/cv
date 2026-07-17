import { ConflictError } from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from '@cv/internal-ui'
import { useAtom, useAtomSet } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import * as React from 'react'

import { deleteApplication, reloadLatestApplication } from '../../data'

export const DeleteApplicationDialog = ({
  application,
  onDeleted,
}: {
  readonly application: Application
  readonly onDeleted: () => void
}) => {
  const [open, setOpen] = React.useState(false)
  const [reloadResult, reloadApplication] = useAtom(reloadLatestApplication, {
    mode: 'promise',
  })
  const [recoveryError, setRecoveryError] = React.useState<string>()
  const expectedVersion = React.useRef<number | undefined>(undefined)
  const deleting = React.useRef(false)
  const [deleteResult, removeApplication] = useAtom(deleteApplication, {
    mode: 'promise',
  })
  const resetDelete = useAtomSet(deleteApplication)
  const deletionFailure = AsyncResult.matchWithError(deleteResult, {
    onInitial: () => undefined,
    onError: (error) => error,
    onDefect: (defect) => defect,
    onSuccess: () => undefined,
  })
  const conflict = deletionFailure instanceof ConflictError
  const error =
    recoveryError ??
    (deletionFailure === undefined
      ? undefined
      : deletionFailure instanceof Error
        ? deletionFailure.message
        : 'The application could not be deleted.')
  const deletingPending = AsyncResult.isWaiting(deleteResult)
  const reloading = AsyncResult.isWaiting(reloadResult)

  const reloadLatest = async () => {
    setRecoveryError(undefined)
    try {
      await reloadApplication(application.id)
      expectedVersion.current = undefined
      resetDelete(Atom.Reset)
      setOpen(false)
    } catch (reason) {
      setRecoveryError(
        reason instanceof Error
          ? `Could not reload the latest application: ${reason.message}`
          : 'Could not reload the latest application.'
      )
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (deleting.current || deletingPending || reloading) return
        setOpen(nextOpen)
        deleting.current = false
        expectedVersion.current = nextOpen ? application.version : undefined
        setRecoveryError(undefined)
        resetDelete(Atom.Reset)
      }}
    >
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive" size="sm">
            <Trash2 />
            Delete
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this application?</AlertDialogTitle>
          <AlertDialogDescription>
            {application.company} — {application.role} will be permanently
            removed from the registry.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error === undefined ? null : (
          <Alert variant="destructive">
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
                <RefreshCw className={reloading ? 'animate-spin' : ''} />
                {reloading ? 'Reloading…' : 'Reload latest and review'}
              </Button>
            ) : null}
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletingPending || reloading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deletingPending || reloading || conflict}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault()
              const version = expectedVersion.current
              if (version === undefined) return
              deleting.current = true
              void removeApplication({
                applicationId: application.id,
                expectedVersion: version,
              })
                .then(onDeleted)
                .catch(() => undefined)
                .finally(() => {
                  deleting.current = false
                })
            }}
          >
            {deletingPending ? 'Deleting…' : 'Delete permanently'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
