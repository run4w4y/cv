import { Schema } from 'effect'

export const ApplicationStatusSchema = Schema.Literals([
  'not_started',
  'preparing',
  'applied',
  'recruiter_screen',
  'technical_screen',
  'take_home',
  'interview_loop',
  'paused',
  'offer',
  'rejected',
  'withdrawn',
  'archived',
])

export const applicationStatusValues = ApplicationStatusSchema.literals

export type ApplicationStatus = Schema.Schema.Type<
  typeof ApplicationStatusSchema
>

export const TargetStageSchema = Schema.Literals([
  'apply_next',
  'verify_first',
  'secondary',
  'backlog',
  'watch_after_move',
  'closed_skip',
])

export const targetStageValues = TargetStageSchema.literals

export type TargetStage = Schema.Schema.Type<typeof TargetStageSchema>

export const PersonalPrioritySchema = Schema.Literals([
  'low',
  'medium',
  'high',
  'pass',
])

export const personalPriorityValues = PersonalPrioritySchema.literals

export type PersonalPriority = Schema.Schema.Type<typeof PersonalPrioritySchema>

export const ListingAvailabilitySchema = Schema.Literals([
  'unchecked',
  'open',
  'suspected_closed',
  'closed',
  'unknown',
])

export const listingAvailabilityValues = ListingAvailabilitySchema.literals

export type ListingAvailability = Schema.Schema.Type<
  typeof ListingAvailabilitySchema
>

export const ListingCheckOutcomeSchema = Schema.Literals([
  'open',
  'closed',
  'unknown',
])

export const listingCheckOutcomeValues = ListingCheckOutcomeSchema.literals

export type ListingCheckOutcome = Schema.Schema.Type<
  typeof ListingCheckOutcomeSchema
>

export const ListingCheckConfidenceSchema = Schema.Literals([
  'low',
  'medium',
  'high',
  'confirmed',
])

export const listingCheckConfidenceValues =
  ListingCheckConfidenceSchema.literals

export type ListingCheckConfidence = Schema.Schema.Type<
  typeof ListingCheckConfidenceSchema
>

export const ListingCheckActionSchema = Schema.Literals([
  'keep',
  'recheck',
  'review',
  'archive',
])

export const listingCheckActionValues = ListingCheckActionSchema.literals

export type ListingCheckAction = Schema.Schema.Type<
  typeof ListingCheckActionSchema
>

export const ListingCheckReasonSchema = Schema.Literals([
  'http_404',
  'http_410',
  'provider_open',
  'provider_closed',
  'valid_through_expired',
  'explicit_closed_text',
  'working_application_path',
  'identity_mismatch',
  'redirected_to_listing_page',
  'access_forbidden',
  'rate_limited',
  'server_error',
  'network_error',
  'unclassified_page',
])

export const listingCheckReasonValues = ListingCheckReasonSchema.literals

export type ListingCheckReason = Schema.Schema.Type<
  typeof ListingCheckReasonSchema
>

export const ListingCheckRunTriggerSchema = Schema.Literals([
  'cli',
  'scheduled',
])

export const listingCheckRunTriggerValues =
  ListingCheckRunTriggerSchema.literals

export type ListingCheckRunTrigger = Schema.Schema.Type<
  typeof ListingCheckRunTriggerSchema
>

export const ListingCheckModeSchema = Schema.Literals([
  'report',
  'archive_eligible',
])

export const listingCheckModeValues = ListingCheckModeSchema.literals

export type ListingCheckMode = Schema.Schema.Type<typeof ListingCheckModeSchema>

export const ListingCheckRunStateSchema = Schema.Literals([
  'running',
  'completed',
])

export const listingCheckRunStateValues = ListingCheckRunStateSchema.literals

export type ListingCheckRunState = Schema.Schema.Type<
  typeof ListingCheckRunStateSchema
>

export const systemApplicationEventKindValues = [
  'discovered',
  'listing_closed',
] as const

export const statusChangingApplicationEventKindValues = [
  'submitted',
  'stage_changed',
  'interview_scheduled',
  'rejected',
  'withdrawn',
  'offer_received',
] as const

export const informationalApplicationEventKindValues = [
  'note_added',
  'contact_logged',
  'follow_up_scheduled',
  'research_updated',
] as const

export const appendableApplicationEventKindValues = [
  ...statusChangingApplicationEventKindValues,
  ...informationalApplicationEventKindValues,
] as const

export const ApplicationEventKindSchema = Schema.Literals([
  ...systemApplicationEventKindValues,
  ...appendableApplicationEventKindValues,
])

export const StatusChangingApplicationEventKindSchema = Schema.Literals(
  statusChangingApplicationEventKindValues
)

export const InformationalApplicationEventKindSchema = Schema.Literals(
  informationalApplicationEventKindValues
)

export const AppendableApplicationEventKindSchema = Schema.Literals(
  appendableApplicationEventKindValues
)

export const applicationEventKindValues = ApplicationEventKindSchema.literals

export type ApplicationEventKind = Schema.Schema.Type<
  typeof ApplicationEventKindSchema
>

export type StatusChangingApplicationEventKind = Schema.Schema.Type<
  typeof StatusChangingApplicationEventKindSchema
>

export type InformationalApplicationEventKind = Schema.Schema.Type<
  typeof InformationalApplicationEventKindSchema
>

export type AppendableApplicationEventKind = Schema.Schema.Type<
  typeof AppendableApplicationEventKindSchema
>

export const ApplicationNoteKindSchema = Schema.Literals([
  'summary',
  'role_description',
  'why_this_fits',
  'caveat',
  'research',
  'application',
  'interview_prep',
  'contact',
  'general',
])

export const applicationNoteKindValues = ApplicationNoteKindSchema.literals

export type ApplicationNoteKind = Schema.Schema.Type<
  typeof ApplicationNoteKindSchema
>

export const CommandKindSchema = Schema.Literals([
  'application_event',
  'application_note',
  'listing_check',
  'managed_application_update',
])

export const commandKindValues = CommandKindSchema.literals

export type CommandKind = Schema.Schema.Type<typeof CommandKindSchema>

export const CompensationKindSchema = Schema.Literals([
  'base_salary',
  'total_compensation',
  'bonus',
  'equity',
  'other',
])

export const compensationKindValues = CompensationKindSchema.literals

export type CompensationKind = Schema.Schema.Type<typeof CompensationKindSchema>

export const CompensationPeriodSchema = Schema.Literals([
  'hour',
  'day',
  'week',
  'month',
  'year',
  'one_time',
  'unknown',
])

export const compensationPeriodValues = CompensationPeriodSchema.literals

export type CompensationPeriod = Schema.Schema.Type<
  typeof CompensationPeriodSchema
>
