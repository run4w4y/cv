import {
  RegistryProvider,
  useAtomSet,
  useAtomSuspense,
} from '@effect/atom-react'
import { useLingui } from '@lingui/react'
import { LockKeyhole } from 'lucide-react'
import { Suspense, useCallback } from 'react'
import { CvDocumentCore } from '@/components/cv/cv-document-core'
import { CvUnlockSkeleton } from '@/components/cv/cv-unlock-skeleton'
import { cvMessages } from '@/i18n/messages'
import { CvLinguiProvider } from '@/i18n/runtime'
import { CvDocumentProvider, type OpenCvFile } from '@/lib/cv-document/context'
import {
  cvPageContextAtom,
  cvSessionAtom,
  openCvFileCommand,
} from '@/lib/private-content-session/layers'
import {
  type CvPageContextValue,
  readCvPageContext,
} from '@/lib/private-content-session/page-context'

type CvPrivateRootProps = {
  page: CvPageContextValue
}

export const CvPrivateRoot = ({ page }: CvPrivateRootProps) => (
  <CvLinguiProvider locale={page.locale}>
    <CvPrivateRuntimeRoot page={page} />
  </CvLinguiProvider>
)

const CvPrivateRuntimeRoot = ({ page }: CvPrivateRootProps) => {
  if (typeof window === 'undefined') {
    return <CvUnlockSkeleton />
  }

  const browserPage = {
    ...page,
    ...readCvPageContext(),
  }

  return (
    <RegistryProvider initialValues={[[cvPageContextAtom, browserPage]]}>
      <Suspense fallback={<CvUnlockSkeleton />}>
        <CvPrivateDocument />
      </Suspense>
    </RegistryProvider>
  )
}

const CvPrivateDocument = () => {
  const openFileCommand = useAtomSet(openCvFileCommand, { mode: 'promise' })
  const openFile = useCallback<OpenCvFile>(
    async (href) => {
      await openFileCommand(href)
    },
    [openFileCommand]
  )
  const result = useAtomSuspense(cvSessionAtom, {
    includeFailure: true,
    suspendOnWaiting: true,
  })

  if (result._tag === 'Failure') {
    return <CvUnlockFailure />
  }

  const session = result.value

  return (
    <CvDocumentProvider
      value={{
        content: session.content,
        openFile,
        page: session.page,
        session,
      }}
    >
      <CvDocumentCore />
    </CvDocumentProvider>
  )
}

const CvUnlockFailure = () => {
  const { i18n } = useLingui()

  return (
    <>
      <div className="screen-only border-b border-border bg-card/65">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-2 font-mono text-xs/5 text-muted-foreground">
            <LockKeyhole
              aria-hidden="true"
              className="size-3.5 shrink-0"
              strokeWidth={1.8}
            />
            <span>{i18n._(cvMessages.status.unavailable)}</span>
          </div>
        </div>
      </div>
      <div className="print-root print-hidden min-h-dvh bg-background">
        <main className="mx-auto max-w-7xl border-x border-border">
          <section className="px-5 py-16 sm:px-8 lg:px-10">
            <p className="font-mono text-xs/5 uppercase text-muted-foreground">
              {i18n._(cvMessages.status.loading)}
            </p>
            <h1 className="mt-4 max-w-2xl text-2xl font-semibold tracking-normal text-foreground">
              {i18n._(cvMessages.status.unavailable)}
            </h1>
          </section>
        </main>
      </div>
    </>
  )
}
