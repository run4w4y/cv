import { FieldError } from '@cv/internal-ui'

import type { ValidationIssue } from '../core'

type IssueMap = ReadonlyMap<string, ReadonlyArray<ValidationIssue>>

const isWithinPointer = (parent: string, child: string): boolean =>
  child === parent ||
  (parent === '' ? child.startsWith('/') : child.startsWith(`${parent}/`))

export const issueMessages = (
  issues: IssueMap,
  pointer: string
): ReadonlyArray<string> =>
  (issues.get(pointer) ?? []).map((issue) => issue.message)

export const issueMessagesWithin = (
  issues: IssueMap,
  pointer: string
): ReadonlyArray<string> => {
  const messages: Array<string> = []
  for (const [issuePointer, pointerIssues] of issues) {
    if (!isWithinPointer(pointer, issuePointer)) continue
    for (const issue of pointerIssues) {
      messages.push(
        issuePointer === pointer
          ? issue.message
          : `${issuePointer || '/'}: ${issue.message}`
      )
    }
  }
  return messages
}

export const FieldMessages = ({
  messages,
}: {
  readonly messages: ReadonlyArray<string>
}) => (
  <>
    {messages.map((message) => (
      <FieldError match key={message}>
        {message}
      </FieldError>
    ))}
  </>
)

export const GroupMessages = ({
  messages,
}: {
  readonly messages: ReadonlyArray<string>
}) => (
  <>
    {messages.map((message) => (
      <p className="text-xs font-medium text-destructive" key={message}>
        {message}
      </p>
    ))}
  </>
)
