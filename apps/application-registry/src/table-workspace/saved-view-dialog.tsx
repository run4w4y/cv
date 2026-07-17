import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@cv/internal-ui'

import type { SavedViewCopy } from './saved-view-model'

export const SavedViewDialog = ({
  mode,
  name,
  error,
  copy,
  onNameChange,
  onClose,
  onSubmit,
}: {
  readonly mode: 'create' | 'rename' | null
  readonly name: string
  readonly error: string | null
  readonly copy: SavedViewCopy
  readonly onNameChange: (name: string) => void
  readonly onClose: () => void
  readonly onSubmit: () => void
}) => (
  <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {mode === 'rename' ? 'Rename saved view' : 'Save view'}
        </DialogTitle>
        <DialogDescription>
          {mode === 'rename' ? copy.renameDescription : copy.createDescription}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Input
          autoFocus
          aria-label="View name"
          placeholder={copy.placeholder}
          value={name}
          aria-invalid={error !== null}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSubmit()
            }
          }}
        />
        {error !== null ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={onSubmit}>
          {mode === 'rename' ? 'Rename view' : 'Save view'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
