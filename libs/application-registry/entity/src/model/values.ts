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

export const systemApplicationEventKindValues = [
  'discovered',
  'campaign_prepared',
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
  'campaign_capture',
  'application_event',
  'application_note',
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
