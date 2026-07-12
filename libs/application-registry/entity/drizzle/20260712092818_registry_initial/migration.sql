CREATE TABLE `application_compensations` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`currency_code` text NOT NULL,
	`minimum_minor` integer,
	`maximum_minor` integer,
	`period` text NOT NULL,
	`raw_text` text,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_application_compensations_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "application_compensations_kind_check" CHECK("kind" in ('base_salary', 'total_compensation', 'bonus', 'equity', 'other')),
	CONSTRAINT "application_compensations_currency_code_check" CHECK(length("currency_code") = 3 and "currency_code" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "application_compensations_period_check" CHECK("period" in ('hour', 'day', 'week', 'month', 'year', 'one_time', 'unknown')),
	CONSTRAINT "application_compensations_minimum_check" CHECK("minimum_minor" is null or "minimum_minor" >= 0),
	CONSTRAINT "application_compensations_maximum_check" CHECK("maximum_minor" is null or "maximum_minor" >= 0),
	CONSTRAINT "application_compensations_range_check" CHECK("minimum_minor" is null or "maximum_minor" is null or "minimum_minor" <= "maximum_minor")
);
--> statement-breakpoint
CREATE TABLE `application_events` (
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
	CONSTRAINT "application_events_kind_check" CHECK("kind" in ('discovered', 'campaign_prepared', 'submitted', 'stage_changed', 'interview_scheduled', 'rejected', 'withdrawn', 'offer_received', 'note_added', 'contact_logged', 'follow_up_scheduled', 'research_updated')),
	CONSTRAINT "application_events_payload_json_check" CHECK(json_valid("payload"))
);
--> statement-breakpoint
CREATE TABLE `application_labels` (
	`application_id` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `application_labels_pk` PRIMARY KEY(`application_id`, `label`),
	CONSTRAINT `fk_application_labels_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `application_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`source` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_application_notes_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "application_notes_kind_check" CHECK("kind" in ('summary', 'role_description', 'why_this_fits', 'caveat', 'research', 'application', 'interview_prep', 'contact', 'general'))
);
--> statement-breakpoint
CREATE TABLE `applications` (
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
	`version` integer DEFAULT 1 NOT NULL,
	`updated_revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "applications_status_check" CHECK("application_status" in ('not_started', 'preparing', 'applied', 'recruiter_screen', 'technical_screen', 'take_home', 'interview_loop', 'paused', 'offer', 'rejected', 'withdrawn', 'archived')),
	CONSTRAINT "applications_target_stage_check" CHECK("target_stage" in ('apply_next', 'verify_first', 'secondary', 'backlog', 'watch_after_move', 'closed_skip')),
	CONSTRAINT "applications_personal_priority_check" CHECK("personal_priority" is null or "personal_priority" in ('low', 'medium', 'high', 'pass')),
	CONSTRAINT "applications_fit_score_check" CHECK("fit_score" is null or ("fit_score" >= 0 and "fit_score" <= 100)),
	CONSTRAINT "applications_details_json_check" CHECK("details" is null or json_valid("details")),
	CONSTRAINT "applications_version_check" CHECK("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE `campaign_captures` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`campaign_run_id` text NOT NULL,
	`profile` text NOT NULL,
	`audience` text,
	`confidence` real,
	`submission_details` text NOT NULL,
	`artifacts` text NOT NULL,
	`job_content_hash` text,
	`captured_at` text NOT NULL,
	`operation_id` text NOT NULL,
	CONSTRAINT `fk_campaign_captures_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "campaign_captures_confidence_check" CHECK("confidence" is null or ("confidence" >= 0 and "confidence" <= 1)),
	CONSTRAINT "campaign_captures_submission_details_json_check" CHECK(json_valid("submission_details")),
	CONSTRAINT "campaign_captures_artifacts_json_check" CHECK(json_valid("artifacts"))
);
--> statement-breakpoint
CREATE TABLE `command_receipts` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`request_fingerprint` text NOT NULL,
	`kind` text NOT NULL,
	`application_id` text NOT NULL,
	`event_id` text,
	`capture_id` text,
	`note_id` text,
	`recorded_at` text NOT NULL,
	CONSTRAINT `fk_command_receipts_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "command_receipts_kind_check" CHECK("kind" in ('campaign_capture', 'application_event', 'application_note'))
);
--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`base_currency` text NOT NULL,
	`quote_currency` text NOT NULL,
	`rate` real NOT NULL,
	`provider` text NOT NULL,
	`observed_at` text NOT NULL,
	`fetched_at` text NOT NULL,
	CONSTRAINT `fx_rates_pk` PRIMARY KEY(`base_currency`, `quote_currency`, `provider`, `observed_at`),
	CONSTRAINT "fx_rates_base_currency_check" CHECK(length("base_currency") = 3 and "base_currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "fx_rates_quote_currency_check" CHECK(length("quote_currency") = 3 and "quote_currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "fx_rates_rate_check" CHECK("rate" > 0)
);
--> statement-breakpoint
CREATE TABLE `registry_sequence` (
	`id` integer PRIMARY KEY,
	`revision` integer NOT NULL,
	CONSTRAINT "registry_sequence_singleton_check" CHECK("id" = 1),
	CONSTRAINT "registry_sequence_revision_check" CHECK("revision" >= 1)
);
--> statement-breakpoint
CREATE INDEX `application_compensations_application_idx` ON `application_compensations` (`application_id`,`kind`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_events_operation_id_unique` ON `application_events` (`operation_id`);--> statement-breakpoint
CREATE INDEX `application_events_application_occurred_idx` ON `application_events` (`application_id`,`occurred_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_events_revision_unique` ON `application_events` (`revision`);--> statement-breakpoint
CREATE INDEX `application_labels_label_idx` ON `application_labels` (`label`,`application_id`);--> statement-breakpoint
CREATE INDEX `application_notes_application_created_idx` ON `application_notes` (`application_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_job_key_unique` ON `applications` (`job_key`);--> statement-breakpoint
CREATE INDEX `applications_company_normalized_idx` ON `applications` (`company_normalized`);--> statement-breakpoint
CREATE INDEX `applications_status_updated_revision_idx` ON `applications` (`application_status`,`updated_revision`);--> statement-breakpoint
CREATE INDEX `applications_target_stage_updated_revision_idx` ON `applications` (`target_stage`,`updated_revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_updated_revision_unique` ON `applications` (`updated_revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_captures_operation_id_unique` ON `campaign_captures` (`operation_id`);--> statement-breakpoint
CREATE INDEX `campaign_captures_application_captured_idx` ON `campaign_captures` (`application_id`,`captured_at`,`id`);--> statement-breakpoint
CREATE INDEX `fx_rates_pair_fetched_idx` ON `fx_rates` (`base_currency`,`quote_currency`,`fetched_at`);