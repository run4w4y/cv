import type { ApplicationArtifactCategory } from '@cv/application-registry-entity'
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
  Input,
  Label,
  Select,
} from '@cv/internal-ui'
import { useAtom, useAtomSet } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { AlertCircle, Upload } from 'lucide-react'
import * as React from 'react'

import {
  asyncResultErrorMessage,
  expectedErrorMessage,
} from '@/lib/async-result'
import {
  type UploadApplicationArtifactInput,
  uploadApplicationArtifact,
} from '../../data'
import {
  type OperationSubmission,
  operationSubmissionFor,
} from '../../model/operation-submission'

const categoryOptions = [
  { label: 'Resume', value: 'resume' },
  { label: 'Cover letter', value: 'cover_letter' },
  { label: 'Supporting document', value: 'supporting_document' },
  { label: 'Other', value: 'other' },
] as const

const artifactCategories = categoryOptions.map(({ value }) => value)

const isArtifactCategory = (
  value: string
): value is ApplicationArtifactCategory =>
  artifactCategories.some((category) => category === value)

const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u

export const artifactUploadFingerprint = ({
  applicationId,
  category,
  file,
  locale,
}: Omit<UploadApplicationArtifactInput, 'filename' | 'operationId'>) => ({
  applicationId,
  category,
  file: {
    lastModified: file.lastModified,
    name: file.name,
    size: file.size,
    type: file.type,
  },
  locale,
})

type UploadArtifact = (
  input: UploadApplicationArtifactInput
) => Promise<unknown>

export const UploadApplicationArtifactDialog = ({
  applicationId,
  uploadArtifact,
}: {
  readonly applicationId: string
  readonly uploadArtifact?: UploadArtifact
}) => {
  const [open, setOpen] = React.useState(false)
  const [category, setCategory] =
    React.useState<ApplicationArtifactCategory>('resume')
  const [file, setFile] = React.useState<File>()
  const [locale, setLocale] = React.useState('')
  const [overrideSaving, setOverrideSaving] = React.useState(false)
  const [overrideError, setOverrideError] = React.useState<string>()
  const submission = React.useRef<OperationSubmission | undefined>(undefined)
  const fileInput = React.useRef<HTMLInputElement>(null)
  const categoryLabelId = React.useId()
  const fileInputId = React.useId()
  const localeInputId = React.useId()
  const [uploadResult, upload] = useAtom(uploadApplicationArtifact, {
    mode: 'promise',
  })
  const resetUpload = useAtomSet(uploadApplicationArtifact)
  const saving = AsyncResult.isWaiting(uploadResult) || overrideSaving
  const error =
    overrideError ??
    asyncResultErrorMessage(uploadResult, 'The artifact could not be uploaded.')

  const resetForm = () => {
    setCategory('resume')
    setFile(undefined)
    setLocale('')
    setOverrideError(undefined)
    submission.current = undefined
    if (fileInput.current !== null) fileInput.current.value = ''
  }

  const close = () => {
    setOpen(false)
    resetForm()
    resetUpload(Atom.Reset)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOverrideError(undefined)
    if (file === undefined) {
      setOverrideError('Choose a file to upload.')
      return
    }
    const normalizedLocale = locale.trim()
    if (normalizedLocale !== '' && !localePattern.test(normalizedLocale)) {
      setOverrideError(
        'Use a locale such as en, en-US, or pt-BR, or leave it blank.'
      )
      return
    }
    const inputLocale = normalizedLocale || undefined
    const fingerprint = artifactUploadFingerprint({
      applicationId,
      category,
      file,
      locale: inputLocale,
    })
    submission.current = operationSubmissionFor(submission.current, fingerprint)
    const input: UploadApplicationArtifactInput = {
      applicationId,
      category,
      file,
      filename: file.name,
      locale: inputLocale,
      operationId: submission.current.operationId,
    }
    if (uploadArtifact !== undefined) setOverrideSaving(true)
    try {
      await (uploadArtifact ?? upload)(input)
      close()
    } catch (reason) {
      setOverrideError(
        expectedErrorMessage(reason, 'The artifact could not be uploaded.')
      )
    } finally {
      setOverrideSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (saving) return
        if (nextOpen) {
          setOpen(true)
          return
        }
        close()
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" size="sm">
            <Upload />
            Upload artifact
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload application artifact</DialogTitle>
          <DialogDescription>
            Attach a resume, cover letter, or supporting file directly to this
            application.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label id={categoryLabelId}>Category</Label>
              <Select
                value={category}
                options={categoryOptions}
                ariaLabelledBy={categoryLabelId}
                disabled={saving}
                onValueChange={(value) => {
                  if (value !== null && isArtifactCategory(value)) {
                    setCategory(value)
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={fileInputId}>File</Label>
              <Input
                ref={fileInput}
                id={fileInputId}
                type="file"
                disabled={saving}
                onChange={(event) =>
                  setFile(event.currentTarget.files?.[0] ?? undefined)
                }
              />
              <p className="text-xs text-muted-foreground">
                The original filename and media type will be preserved.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={localeInputId}>Locale (optional)</Label>
              <Input
                id={localeInputId}
                value={locale}
                placeholder="en-US"
                disabled={saving}
                onChange={(event) => setLocale(event.currentTarget.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use the document locale when it is known.
              </p>
            </div>
          </div>
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
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Uploading…' : 'Upload artifact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
