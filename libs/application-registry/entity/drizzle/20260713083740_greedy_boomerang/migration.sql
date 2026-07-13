CREATE TABLE `application_listing_check_schedules` (
	`application_id` text PRIMARY KEY NOT NULL,
	`due_at` text NOT NULL,
	`lease_token` text,
	`lease_until` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_application_listing_check_schedules_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "listing_check_schedules_attempt_count_check" CHECK("attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE `application_listing_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`run_id` text,
	`operation_id` text NOT NULL,
	`requested_url` text NOT NULL,
	`final_url` text,
	`provider` text NOT NULL,
	`outcome` text NOT NULL,
	`confidence` text NOT NULL,
	`recommended_action` text NOT NULL,
	`reason_code` text NOT NULL,
	`http_status` integer,
	`evidence` text NOT NULL,
	`content_hash` text,
	`checker_version` text NOT NULL,
	`checked_at` text NOT NULL,
	`received_at` text NOT NULL,
	`next_check_at` text NOT NULL,
	CONSTRAINT `fk_application_listing_checks_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_application_listing_checks_run_id_listing_check_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `listing_check_runs`(`id`) ON DELETE SET NULL,
	CONSTRAINT "application_listing_checks_outcome_check" CHECK("outcome" in ('open', 'closed', 'unknown')),
	CONSTRAINT "application_listing_checks_confidence_check" CHECK("confidence" in ('low', 'medium', 'high', 'confirmed')),
	CONSTRAINT "application_listing_checks_action_check" CHECK("recommended_action" in ('keep', 'recheck', 'review', 'archive')),
	CONSTRAINT "application_listing_checks_reason_check" CHECK("reason_code" in ('http_404', 'http_410', 'provider_open', 'provider_closed', 'valid_through_expired', 'explicit_closed_text', 'working_application_path', 'identity_mismatch', 'redirected_to_listing_page', 'access_forbidden', 'rate_limited', 'server_error', 'network_error', 'unclassified_page')),
	CONSTRAINT "application_listing_checks_http_status_check" CHECK("http_status" is null or ("http_status" >= 100 and "http_status" <= 599)),
	CONSTRAINT "application_listing_checks_evidence_json_check" CHECK(json_valid("evidence"))
);
--> statement-breakpoint
CREATE TABLE `listing_check_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`mode` text NOT NULL,
	`state` text NOT NULL,
	`selected_count` integer DEFAULT 0 NOT NULL,
	`checked_count` integer DEFAULT 0 NOT NULL,
	`open_count` integer DEFAULT 0 NOT NULL,
	`closed_count` integer DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	CONSTRAINT "listing_check_runs_trigger_check" CHECK("trigger" in ('cli', 'scheduled')),
	CONSTRAINT "listing_check_runs_mode_check" CHECK("mode" in ('report', 'archive_eligible')),
	CONSTRAINT "listing_check_runs_state_check" CHECK("state" in ('running', 'completed')),
	CONSTRAINT "listing_check_runs_counts_check" CHECK("selected_count" >= 0 and "checked_count" >= 0 and "open_count" >= 0 and "closed_count" >= 0 and "review_count" >= 0 and "error_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE `applications` ADD `listing_availability` text DEFAULT 'unchecked' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `listing_confidence` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `listing_reason_code` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `listing_checked_at` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `listing_closed_candidate_at` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `listing_consecutive_closed_checks` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`fit_score` real,
	`category` text,
	`remote_policy` text,
	`details` text,
	`open_status` text,
	`source_confidence` text,
	`technology_stack` text,
	`recommended_action` text,
	`research_priority` text,
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
	CONSTRAINT "applications_fit_score_check" CHECK("fit_score" is null or ("fit_score" >= 0 and "fit_score" <= 100)),
	CONSTRAINT "applications_details_json_check" CHECK("details" is null or json_valid("details")),
	CONSTRAINT "applications_version_check" CHECK("version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_applications`(`id`, `job_key`, `source`, `source_job_id`, `canonical_url`, `company`, `company_normalized`, `role`, `location`, `application_status`, `target_stage`, `personal_priority`, `fit_score`, `category`, `remote_policy`, `details`, `open_status`, `source_confidence`, `technology_stack`, `recommended_action`, `research_priority`, `follow_up_at`, `applied_at`, `last_contact_at`, `version`, `updated_revision`, `created_at`, `updated_at`) SELECT `id`, `job_key`, `source`, `source_job_id`, `canonical_url`, `company`, `company_normalized`, `role`, `location`, `application_status`, `target_stage`, `personal_priority`, `fit_score`, `category`, `remote_policy`, `details`, `open_status`, `source_confidence`, `technology_stack`, `recommended_action`, `research_priority`, `follow_up_at`, `applied_at`, `last_contact_at`, `version`, `updated_revision`, `created_at`, `updated_at` FROM `applications`;--> statement-breakpoint
DROP TABLE `applications`;--> statement-breakpoint
ALTER TABLE `__new_applications` RENAME TO `applications`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`revision` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`recorded_at` text NOT NULL,
	`device_id` text,
	`payload` text NOT NULL,
	`operation_id` text NOT NULL,
	CONSTRAINT `fk_application_events_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "application_events_kind_check" CHECK("kind" in ('discovered', 'campaign_prepared', 'listing_closed', 'submitted', 'stage_changed', 'interview_scheduled', 'rejected', 'withdrawn', 'offer_received', 'note_added', 'contact_logged', 'follow_up_scheduled', 'research_updated')),
	CONSTRAINT "application_events_payload_json_check" CHECK(json_valid("payload"))
);
--> statement-breakpoint
INSERT INTO `__new_application_events`(`id`, `application_id`, `kind`, `revision`, `occurred_at`, `recorded_at`, `device_id`, `payload`, `operation_id`) SELECT `id`, `application_id`, `kind`, `revision`, `occurred_at`, `recorded_at`, `device_id`, `payload`, `operation_id` FROM `application_events`;--> statement-breakpoint
DROP TABLE `application_events`;--> statement-breakpoint
ALTER TABLE `__new_application_events` RENAME TO `application_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `applications_job_key_unique` ON `applications` (`job_key`);--> statement-breakpoint
CREATE INDEX `applications_company_normalized_idx` ON `applications` (`company_normalized`);--> statement-breakpoint
CREATE INDEX `applications_status_updated_revision_idx` ON `applications` (`application_status`,`updated_revision`);--> statement-breakpoint
CREATE INDEX `applications_target_stage_updated_revision_idx` ON `applications` (`target_stage`,`updated_revision`);--> statement-breakpoint
CREATE INDEX `applications_listing_availability_idx` ON `applications` (`listing_availability`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_updated_revision_unique` ON `applications` (`updated_revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_events_operation_id_unique` ON `application_events` (`operation_id`);--> statement-breakpoint
CREATE INDEX `application_events_application_occurred_idx` ON `application_events` (`application_id`,`occurred_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_events_revision_unique` ON `application_events` (`revision`);--> statement-breakpoint
CREATE INDEX `listing_check_schedules_due_lease_idx` ON `application_listing_check_schedules` (`due_at`,`lease_until`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_listing_checks_operation_unique` ON `application_listing_checks` (`operation_id`);--> statement-breakpoint
CREATE INDEX `application_listing_checks_application_checked_idx` ON `application_listing_checks` (`application_id`,`checked_at`,`id`);--> statement-breakpoint
CREATE INDEX `application_listing_checks_run_idx` ON `application_listing_checks` (`run_id`,`id`);--> statement-breakpoint
CREATE INDEX `listing_check_runs_started_idx` ON `listing_check_runs` (`started_at`,`id`);