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
	CONSTRAINT "application_events_kind_check" CHECK("kind" in ('discovered', 'listing_closed', 'submitted', 'stage_changed', 'interview_scheduled', 'rejected', 'withdrawn', 'offer_received', 'note_added', 'contact_logged', 'follow_up_scheduled', 'research_updated')),
	CONSTRAINT "application_events_payload_json_check" CHECK(json_valid("payload"))
);
--> statement-breakpoint
INSERT INTO `__new_application_events`(`id`, `application_id`, `kind`, `revision`, `occurred_at`, `recorded_at`, `device_id`, `payload`, `operation_id`) SELECT `id`, `application_id`, `kind`, `revision`, `occurred_at`, `recorded_at`, `device_id`, `payload`, `operation_id` FROM `application_events` WHERE `kind` <> 'campaign_prepared';--> statement-breakpoint
DROP TABLE `application_events`;--> statement-breakpoint
ALTER TABLE `__new_application_events` RENAME TO `application_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_command_receipts` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`operation_request_signature` text NOT NULL,
	`kind` text NOT NULL,
	`application_id` text NOT NULL,
	`event_id` text,
	`note_id` text,
	`recorded_at` text NOT NULL,
	CONSTRAINT `fk_command_receipts_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "command_receipts_kind_check" CHECK("kind" in ('application_event', 'application_note', 'listing_check', 'managed_application_update'))
);
--> statement-breakpoint
INSERT INTO `__new_command_receipts`(`operation_id`, `operation_request_signature`, `kind`, `application_id`, `event_id`, `note_id`, `recorded_at`) SELECT `operation_id`, `operation_request_signature`, `kind`, `application_id`, `event_id`, `note_id`, `recorded_at` FROM `command_receipts` WHERE `kind` <> 'campaign_capture';--> statement-breakpoint
DROP TABLE `command_receipts`;--> statement-breakpoint
ALTER TABLE `__new_command_receipts` RENAME TO `command_receipts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `campaign_captures_operation_id_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `campaign_captures_application_captured_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `application_events_operation_id_unique` ON `application_events` (`operation_id`);--> statement-breakpoint
CREATE INDEX `application_events_application_occurred_idx` ON `application_events` (`application_id`,`occurred_at`,`id`);--> statement-breakpoint
CREATE INDEX `application_events_application_revision_idx` ON `application_events` (`application_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_events_revision_unique` ON `application_events` (`revision`);--> statement-breakpoint
DROP TABLE `campaign_captures`;--> statement-breakpoint
PRAGMA foreign_key_check;
