import { Button } from '@cv/internal-ui'
import { AlertCircle, Check, RefreshCw, X } from 'lucide-react'

import { useApplicationRowEditor } from '../row-editor'

export const RowEditorActions = ({ company }: { readonly company: string }) => {
  const {
    cancel,
    formId,
    isConflict,
    pending,
    reloadLatest,
    serverError,
    submit,
  } = useApplicationRowEditor()

  return (
    <div className="min-w-36">
      <form
        id={formId}
        noValidate
        className="flex items-center gap-1"
        onSubmit={submit}
      >
        <Button
          type="submit"
          size="icon-sm"
          disabled={pending || isConflict}
          aria-label={`Save ${company} row`}
        >
          <Check />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          disabled={pending}
          aria-label={`Cancel editing ${company} row`}
          onClick={cancel}
        >
          <X />
        </Button>
      </form>
      {serverError === undefined ? null : (
        <div className="mt-2 min-w-40 text-xs/4 text-destructive" role="alert">
          <p className="flex items-start gap-1 whitespace-normal break-words">
            <AlertCircle className="mt-0.5 size-3 shrink-0" />
            <span>{serverError}</span>
          </p>
          {isConflict ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-auto p-0 text-xs"
              onClick={reloadLatest}
            >
              <RefreshCw />
              Reload latest row
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
