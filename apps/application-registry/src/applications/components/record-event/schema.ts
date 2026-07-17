import type { AppendApplicationEventRequest } from '@cv/application-registry-api-contract'
import {
  type AppendableApplicationEventKind,
  AppendableApplicationEventKindSchema,
  type Application,
  ApplicationStatusSchema,
  type JsonValue,
  type StatusChangingApplicationEventKind,
  statusChangingApplicationEventKindValues,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

const validJson = Schema.makeFilter((value: string) => {
  if (value.trim().length === 0) return true
  try {
    JSON.parse(value)
    return true
  } catch {
    return 'Event payload must be valid JSON.'
  }
})

export const RecordEventFormSchema = Schema.Struct({
  kind: AppendableApplicationEventKindSchema,
  occurredAt: Schema.Date,
  nextApplicationStatus: ApplicationStatusSchema,
  payload: Schema.String.pipe(Schema.check(validJson)),
})

export type RecordEventValues = Schema.Schema.Type<typeof RecordEventFormSchema>

export const recordEventDefaults = (
  application: Application
): RecordEventValues => ({
  kind: 'contact_logged',
  occurredAt: new Date(),
  nextApplicationStatus: application.applicationStatus,
  payload: '',
})

export const isStatusChangingEventKind = (
  kind: AppendableApplicationEventKind
): kind is StatusChangingApplicationEventKind =>
  statusChangingApplicationEventKindValues.some((value) => value === kind)

export const recordEventRequest = (
  input: RecordEventValues,
  expectedVersion: number,
  operationId: string
): AppendApplicationEventRequest => {
  const values = Schema.decodeUnknownSync(RecordEventFormSchema)(input)
  const payload: JsonValue =
    values.payload.trim().length === 0 ? {} : JSON.parse(values.payload)
  const common = {
    occurredAt: values.occurredAt.toISOString(),
    payload,
    operationId,
    deviceId: null,
    expectedVersion,
  }
  return isStatusChangingEventKind(values.kind)
    ? {
        ...common,
        kind: values.kind,
        nextApplicationStatus: values.nextApplicationStatus,
      }
    : { ...common, kind: values.kind }
}
