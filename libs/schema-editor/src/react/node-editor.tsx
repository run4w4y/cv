import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@cv/internal-ui'

import { CompositeEditor } from './composite-editors'
import type { NodeEditorProps } from './editor-types'
import { PrimitiveEditor } from './primitive-editors'
import { RawJsonEditor } from './raw-json-editor'
import {
  FieldMessages,
  issueMessages,
  issueMessagesWithin,
} from './validation-messages'

export const NodeEditor = (props: NodeEditorProps) => {
  const { descriptor } = props
  switch (descriptor.kind) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'literal':
    case 'choice':
      return <PrimitiveEditor {...props} descriptor={descriptor} />
    case 'nullable':
    case 'array':
    case 'object':
    case 'union':
      return (
        <CompositeEditor
          {...props}
          descriptor={descriptor}
          NodeEditor={NodeEditor}
        />
      )
    case 'raw':
      return (
        <RawJsonEditor
          className={props.className}
          value={props.value}
          onChange={props.onChange}
          label={props.label ?? descriptor.title ?? 'Raw JSON'}
          description={
            descriptor.description ??
            descriptor.documentation ??
            descriptor.reason
          }
          disabled={props.disabled}
          issues={issueMessagesWithin(props.issues, props.pointer)}
        />
      )
    case 'unrepresentable': {
      const messages = issueMessages(props.issues, props.pointer)
      const title = props.label ?? descriptor.title ?? 'Unavailable value'
      const description = descriptor.description ?? descriptor.documentation
      return (
        <Field className={props.className} invalid>
          <FieldLabel>{title}</FieldLabel>
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          <FieldError match>{descriptor.reason}</FieldError>
          <FieldMessages messages={messages} />
        </Field>
      )
    }
  }
}
