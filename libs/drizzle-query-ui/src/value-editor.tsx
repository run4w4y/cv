import { ArrayEditor } from './editors/array-editor'
import type { ValueEditorProps } from './editors/editor-types'
import { JsonEditor } from './editors/json-editor'
import { ScalarEditor } from './editors/scalar-editor'
import { TupleEditor } from './editors/tuple-editor'

export const ValueEditor = (props: ValueEditorProps) => {
  const { descriptor } = props
  if (descriptor.type === 'array') {
    return <ArrayEditor {...props} descriptor={descriptor} />
  }
  if (descriptor.type === 'tuple') {
    return <TupleEditor {...props} descriptor={descriptor} />
  }
  if (descriptor.type === 'struct') {
    return <JsonEditor {...props} />
  }
  return <ScalarEditor {...props} />
}
