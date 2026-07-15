import { Schema } from 'effect'
import { type Application, ApplicationSchema } from '../codecs/applications'
import { type CampaignCapture, CampaignCaptureSchema } from '../codecs/captures'
import { type ApplicationEvent, ApplicationEventSchema } from '../codecs/events'
import { NonEmptyTrimmedStringSchema } from '../model/constraints'

/** Application representation returned by list queries. */
export type ApplicationListItem = Application & {
  readonly compensationSummary: string | null
  readonly counts: { readonly captures: number; readonly notes: number }
  readonly identityAliases: readonly string[]
  readonly labels: readonly string[]
  readonly latestCapture: Pick<CampaignCapture, 'applicationUrl'> | null
  readonly latestEvent: Pick<ApplicationEvent, 'kind' | 'occurredAt'> | null
}

/** Runtime schema for {@link ApplicationListItem}. */
export const ApplicationListItemSchema: Schema.Codec<ApplicationListItem> =
  Schema.revealCodec(
    Schema.Struct({
      ...ApplicationSchema.fields,
      compensationSummary: Schema.NullOr(NonEmptyTrimmedStringSchema),
      counts: Schema.Struct({
        captures: Schema.Int.pipe(
          Schema.check(Schema.isGreaterThanOrEqualTo(0))
        ),
        notes: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
      }),
      identityAliases: Schema.Array(NonEmptyTrimmedStringSchema),
      labels: Schema.Array(NonEmptyTrimmedStringSchema),
      latestCapture: Schema.NullOr(
        Schema.Struct({
          applicationUrl: CampaignCaptureSchema.fields.applicationUrl,
        })
      ),
      latestEvent: Schema.NullOr(
        Schema.Struct({
          kind: ApplicationEventSchema.fields.kind,
          occurredAt: ApplicationEventSchema.fields.occurredAt,
        })
      ),
    })
  )

/** Event representation returned by registry-wide list queries. */
export type RegistryEventListItem = ApplicationEvent &
  Pick<Application, 'canonicalUrl' | 'company' | 'role'>

/** Runtime schema for {@link RegistryEventListItem}. */
export const RegistryEventListItemSchema: Schema.Codec<RegistryEventListItem> =
  Schema.revealCodec(
    Schema.Struct({
      ...ApplicationEventSchema.fields,
      canonicalUrl: ApplicationSchema.fields.canonicalUrl,
      company: ApplicationSchema.fields.company,
      role: ApplicationSchema.fields.role,
    })
  )
