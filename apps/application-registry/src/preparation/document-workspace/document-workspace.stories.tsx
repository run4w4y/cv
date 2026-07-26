import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import { HeaderActionsProvider } from '@/shell/header-actions'

import { CoverLetterDocumentEditor } from './cover-letter-editor'
import { CvDocumentEditor } from './cv-editor'
import { CvWebPreview } from './cv-web-preview'
import { CoverLetterDocumentPreview } from './document-preview'
import {
  documentChanges,
  removeDocumentAtPath,
  updateDocumentAtPath,
} from './document-utils'
import { DocumentWorkspace } from './document-workspace'
import {
  documentWorkspaceCoverLetterFixture,
  documentWorkspaceCvFixture,
} from './story-fixtures'
import type {
  DocumentAssistantMessage,
  DocumentPath,
  DocumentWorkspaceMode,
} from './types'

const initialMessages: ReadonlyArray<DocumentAssistantMessage> = [
  {
    content:
      'I emphasized the platform migration and removed two generic bullets. The draft is still yours to review.',
    id: 'assistant-1',
    role: 'assistant',
    status: 'applied',
    changeCount: 3,
  },
  {
    content:
      'Can you make the opening summary more direct without adding any new claims?',
    id: 'user-1',
    role: 'user',
  },
  {
    content:
      'Done. I tightened the summary around reliability, developer workflows, and technical leadership.',
    id: 'assistant-2',
    role: 'assistant',
    status: 'applied',
    changeCount: 1,
  },
]

const WorkspaceStoryFrame = ({
  children,
}: {
  readonly children: React.ReactNode
}) => {
  const [actionsTarget, setActionsTarget] =
    React.useState<HTMLDivElement | null>(null)

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-muted-foreground">Registry</span>
          <span aria-hidden="true" className="text-muted-foreground">
            /
          </span>
          <span className="font-medium">Document workspace</span>
        </div>
        <div
          className="flex shrink-0 items-center gap-2"
          ref={setActionsTarget}
        />
      </header>
      <HeaderActionsProvider target={actionsTarget}>
        <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
      </HeaderActionsProvider>
    </div>
  )
}

const CvWorkspaceStory = () => {
  const [document, setDocument] = React.useState(documentWorkspaceCvFixture)
  const [original, setOriginal] = React.useState(documentWorkspaceCvFixture)
  const [messages, setMessages] = React.useState(initialMessages)
  const [composer, setComposer] = React.useState('')
  const [mode, setMode] = React.useState<DocumentWorkspaceMode>('edit')
  const edit = (path: DocumentPath, value: unknown) => {
    setDocument(
      (current) =>
        (value === undefined
          ? removeDocumentAtPath(current, path)
          : updateDocumentAtPath(current, path, value)) as typeof current
    )
  }

  return (
    <DocumentWorkspace
      assistant={{
        available: true,
        composer,
        messages,
        onComposerChange: setComposer,
        onSubmitComposer: () => {
          setMessages((current) => [
            ...current,
            {
              content: composer,
              id: `user-${current.length}`,
              role: 'user',
              status: 'sending',
            },
          ])
          setComposer('')
        },
        pending: false,
      }}
      canRedo={false}
      canUndo={document !== original}
      changes={documentChanges(original, document)}
      dirty={document !== original}
      mode={mode}
      onModeChange={setMode}
      onRedo={() => undefined}
      onUndo={() => setDocument(original)}
      postingHref="https://jobs.example.test/platform"
      preview={<CvWebPreview url={null} />}
      primaryAction={
        document !== original
          ? {
              kind: 'save',
              label: 'Save draft',
              onAction: () => setOriginal(document),
            }
          : {
              kind: 'approve',
              label: 'Approve',
              onAction: () => undefined,
            }
      }
      title="Review CV candidate"
      validationIssues={[]}
    >
      <CvDocumentEditor
        document={document}
        issues={[]}
        mutations={{ onEdit: edit }}
      />
    </DocumentWorkspace>
  )
}

const CoverLetterWorkspaceStory = () => {
  const [document, setDocument] = React.useState(
    documentWorkspaceCoverLetterFixture
  )
  const [original, setOriginal] = React.useState(
    documentWorkspaceCoverLetterFixture
  )
  const [composer, setComposer] = React.useState('')
  const [mode, setMode] = React.useState<DocumentWorkspaceMode>('edit')
  const edit = (path: DocumentPath, value: unknown) => {
    setDocument(
      (current) => updateDocumentAtPath(current, path, value) as typeof current
    )
  }

  return (
    <DocumentWorkspace
      assistant={{
        available: true,
        composer,
        messages: [],
        onComposerChange: setComposer,
        onSubmitComposer: () => setComposer(''),
        pending: false,
      }}
      canRedo={false}
      canUndo={document !== original}
      changes={documentChanges(original, document)}
      dirty={document !== original}
      mode={mode}
      onModeChange={setMode}
      onRedo={() => undefined}
      onUndo={() => setDocument(original)}
      postingHref="https://jobs.example.test/platform"
      preview={<CoverLetterDocumentPreview document={document} />}
      primaryAction={
        document !== original
          ? {
              kind: 'save',
              label: 'Save draft',
              onAction: () => setOriginal(document),
            }
          : {
              kind: 'approve',
              label: 'Approve',
              onAction: () => undefined,
            }
      }
      title="Review cover-letter candidate"
      validationIssues={[]}
    >
      <CoverLetterDocumentEditor
        document={document}
        mutations={{ onEdit: edit }}
      />
    </DocumentWorkspace>
  )
}

const meta = {
  title: 'Application Registry/Document workspace/Variant A',
  component: CvWorkspaceStory,
  decorators: [
    (Story) => (
      <WorkspaceStoryFrame>
        <Story />
      </WorkspaceStoryFrame>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CvWorkspaceStory>

export default meta
type Story = StoryObj<typeof meta>

export const CvEditor: Story = {
  render: () => <CvWorkspaceStory />,
}

export const CoverLetterEditor: Story = {
  render: () => <CoverLetterWorkspaceStory />,
}
