CREATE TABLE `application_identity_aliases` (
	`job_key` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_application_identity_aliases_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_campaign_captures` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`campaign_run_id` text NOT NULL,
	`profile` text NOT NULL,
	`audience` text,
	`confidence` real,
	`fit_assessment` text,
	`submission_details` text NOT NULL,
	`artifacts` text NOT NULL,
	`job_content_hash` text,
	`captured_at` text NOT NULL,
	`operation_id` text NOT NULL,
	CONSTRAINT `fk_campaign_captures_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "campaign_captures_confidence_check" CHECK("confidence" is null or ("confidence" >= 0 and "confidence" <= 1)),
	CONSTRAINT "campaign_captures_fit_assessment_json_check" CHECK("fit_assessment" is null or json_valid("fit_assessment")),
	CONSTRAINT "campaign_captures_submission_details_json_check" CHECK(json_valid("submission_details")),
	CONSTRAINT "campaign_captures_artifacts_json_check" CHECK(json_valid("artifacts"))
);
--> statement-breakpoint
INSERT INTO `__new_campaign_captures`(`id`, `application_id`, `campaign_run_id`, `profile`, `audience`, `confidence`, `submission_details`, `artifacts`, `job_content_hash`, `captured_at`, `operation_id`) SELECT `id`, `application_id`, `campaign_run_id`, `profile`, `audience`, `confidence`, `submission_details`, `artifacts`, `job_content_hash`, `captured_at`, `operation_id` FROM `campaign_captures`;--> statement-breakpoint
DROP TABLE `campaign_captures`;--> statement-breakpoint
ALTER TABLE `__new_campaign_captures` RENAME TO `campaign_captures`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_captures_operation_id_unique` ON `campaign_captures` (`operation_id`);--> statement-breakpoint
CREATE INDEX `campaign_captures_application_captured_idx` ON `campaign_captures` (`application_id`,`captured_at`,`id`);--> statement-breakpoint
CREATE INDEX `application_identity_aliases_application_idx` ON `application_identity_aliases` (`application_id`);
