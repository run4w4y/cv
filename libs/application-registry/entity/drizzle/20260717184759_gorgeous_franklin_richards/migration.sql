PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__applications_backup_labels` AS SELECT * FROM `application_labels`;--> statement-breakpoint
CREATE TABLE `__applications_backup_notes` AS SELECT * FROM `application_notes`;--> statement-breakpoint
CREATE TABLE `__applications_backup_compensations` AS SELECT * FROM `application_compensations`;--> statement-breakpoint
CREATE TABLE `__applications_backup_identity_aliases` AS SELECT * FROM `application_identity_aliases`;--> statement-breakpoint
CREATE TABLE `__applications_backup_captures` AS SELECT * FROM `campaign_captures`;--> statement-breakpoint
CREATE TABLE `__applications_backup_events` AS SELECT * FROM `application_events`;--> statement-breakpoint
CREATE TABLE `__applications_backup_command_receipts` AS SELECT * FROM `command_receipts`;--> statement-breakpoint
CREATE TABLE `__applications_backup_listing_schedules` AS SELECT * FROM `application_listing_check_schedules`;--> statement-breakpoint
CREATE TABLE `__applications_backup_listing_checks` AS SELECT * FROM `application_listing_checks`;--> statement-breakpoint
CREATE TABLE `__applications_backup_job_snapshots` AS SELECT * FROM `job_posting_snapshots`;--> statement-breakpoint
CREATE TABLE `__applications_backup_content_entries` AS SELECT * FROM `content_entries`;--> statement-breakpoint
CREATE TABLE `__applications_backup_content_revisions` AS SELECT * FROM `content_revisions`;--> statement-breakpoint
CREATE TABLE `__applications_backup_cv_links` AS SELECT * FROM `cv_links`;--> statement-breakpoint
CREATE TABLE `__applications_backup_generated_artifacts` AS SELECT * FROM `generated_artifacts`;--> statement-breakpoint
CREATE TABLE `__new_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`job_key` text NOT NULL,
	`source` text NOT NULL,
	`source_job_id` text,
	`canonical_url` text NOT NULL,
	`company` text NOT NULL,
	`company_normalized` text NOT NULL,
	`role` text NOT NULL,
	`location` text,
	`application_status` text DEFAULT 'not_started' NOT NULL,
	`target_stage` text DEFAULT 'backlog' NOT NULL,
	`personal_priority` text,
	`follow_up_at` text,
	`applied_at` text,
	`last_contact_at` text,
	`listing_availability` text DEFAULT 'unchecked' NOT NULL,
	`listing_confidence` text,
	`listing_reason_code` text,
	`listing_checked_at` text,
	`listing_closed_candidate_at` text,
	`listing_consecutive_closed_checks` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "applications_status_check" CHECK("application_status" in ('not_started', 'preparing', 'applied', 'recruiter_screen', 'technical_screen', 'take_home', 'interview_loop', 'paused', 'offer', 'rejected', 'withdrawn', 'archived')),
	CONSTRAINT "applications_target_stage_check" CHECK("target_stage" in ('apply_next', 'verify_first', 'secondary', 'backlog', 'watch_after_move', 'closed_skip')),
	CONSTRAINT "applications_personal_priority_check" CHECK("personal_priority" is null or "personal_priority" in ('low', 'medium', 'high', 'pass')),
	CONSTRAINT "applications_listing_availability_check" CHECK("listing_availability" in ('unchecked', 'open', 'suspected_closed', 'closed', 'unknown')),
	CONSTRAINT "applications_listing_confidence_check" CHECK("listing_confidence" is null or "listing_confidence" in ('low', 'medium', 'high', 'confirmed')),
	CONSTRAINT "applications_listing_reason_check" CHECK("listing_reason_code" is null or "listing_reason_code" in ('http_404', 'http_410', 'provider_open', 'provider_closed', 'valid_through_expired', 'explicit_closed_text', 'working_application_path', 'identity_mismatch', 'redirected_to_listing_page', 'access_forbidden', 'rate_limited', 'server_error', 'network_error', 'unclassified_page')),
	CONSTRAINT "applications_listing_closed_count_check" CHECK("listing_consecutive_closed_checks" >= 0),
	CONSTRAINT "applications_version_check" CHECK("version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_applications`(`id`, `job_key`, `source`, `source_job_id`, `canonical_url`, `company`, `company_normalized`, `role`, `location`, `application_status`, `target_stage`, `personal_priority`, `follow_up_at`, `applied_at`, `last_contact_at`, `listing_availability`, `listing_confidence`, `listing_reason_code`, `listing_checked_at`, `listing_closed_candidate_at`, `listing_consecutive_closed_checks`, `version`, `updated_revision`, `created_at`, `updated_at`) SELECT `id`, `job_key`, `source`, `source_job_id`, `canonical_url`, `company`, `company_normalized`, `role`, `location`, `application_status`, `target_stage`, `personal_priority`, `follow_up_at`, `applied_at`, `last_contact_at`, `listing_availability`, `listing_confidence`, `listing_reason_code`, `listing_checked_at`, `listing_closed_candidate_at`, `listing_consecutive_closed_checks`, `version`, `updated_revision`, `created_at`, `updated_at` FROM `applications`;--> statement-breakpoint
DROP TABLE `applications`;--> statement-breakpoint
ALTER TABLE `__new_applications` RENAME TO `applications`;--> statement-breakpoint
DELETE FROM `generated_artifacts`;--> statement-breakpoint
INSERT INTO `application_labels` SELECT * FROM `__applications_backup_labels`;--> statement-breakpoint
INSERT INTO `application_notes` SELECT * FROM `__applications_backup_notes`;--> statement-breakpoint
INSERT INTO `application_compensations` SELECT * FROM `__applications_backup_compensations`;--> statement-breakpoint
INSERT INTO `application_identity_aliases` SELECT * FROM `__applications_backup_identity_aliases`;--> statement-breakpoint
INSERT INTO `campaign_captures` SELECT * FROM `__applications_backup_captures`;--> statement-breakpoint
INSERT INTO `application_events` SELECT * FROM `__applications_backup_events`;--> statement-breakpoint
INSERT INTO `command_receipts` SELECT * FROM `__applications_backup_command_receipts`;--> statement-breakpoint
INSERT INTO `application_listing_check_schedules` SELECT * FROM `__applications_backup_listing_schedules`;--> statement-breakpoint
INSERT INTO `application_listing_checks` SELECT * FROM `__applications_backup_listing_checks`;--> statement-breakpoint
INSERT INTO `job_posting_snapshots` SELECT * FROM `__applications_backup_job_snapshots`;--> statement-breakpoint
INSERT INTO `content_entries` SELECT * FROM `__applications_backup_content_entries`;--> statement-breakpoint
INSERT INTO `content_revisions` SELECT * FROM `__applications_backup_content_revisions`;--> statement-breakpoint
INSERT INTO `cv_links` SELECT * FROM `__applications_backup_cv_links`;--> statement-breakpoint
INSERT INTO `generated_artifacts` SELECT * FROM `__applications_backup_generated_artifacts`;--> statement-breakpoint
DROP TABLE `__applications_backup_labels`;--> statement-breakpoint
DROP TABLE `__applications_backup_notes`;--> statement-breakpoint
DROP TABLE `__applications_backup_compensations`;--> statement-breakpoint
DROP TABLE `__applications_backup_identity_aliases`;--> statement-breakpoint
DROP TABLE `__applications_backup_captures`;--> statement-breakpoint
DROP TABLE `__applications_backup_events`;--> statement-breakpoint
DROP TABLE `__applications_backup_command_receipts`;--> statement-breakpoint
DROP TABLE `__applications_backup_listing_schedules`;--> statement-breakpoint
DROP TABLE `__applications_backup_listing_checks`;--> statement-breakpoint
DROP TABLE `__applications_backup_job_snapshots`;--> statement-breakpoint
DROP TABLE `__applications_backup_content_entries`;--> statement-breakpoint
DROP TABLE `__applications_backup_content_revisions`;--> statement-breakpoint
DROP TABLE `__applications_backup_cv_links`;--> statement-breakpoint
DROP TABLE `__applications_backup_generated_artifacts`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `applications_job_key_unique` ON `applications` (`job_key`);--> statement-breakpoint
CREATE INDEX `applications_company_normalized_idx` ON `applications` (`company_normalized`);--> statement-breakpoint
CREATE INDEX `applications_status_updated_revision_idx` ON `applications` (`application_status`,`updated_revision`);--> statement-breakpoint
CREATE INDEX `applications_target_stage_updated_revision_idx` ON `applications` (`target_stage`,`updated_revision`);--> statement-breakpoint
CREATE INDEX `applications_listing_availability_idx` ON `applications` (`listing_availability`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_updated_revision_unique` ON `applications` (`updated_revision`);
