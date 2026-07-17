PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_command_receipts` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`operation_request_signature` text NOT NULL,
	`kind` text NOT NULL,
	`application_id` text NOT NULL,
	`event_id` text,
	`capture_id` text,
	`note_id` text,
	`recorded_at` text NOT NULL,
	CONSTRAINT `fk_command_receipts_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "command_receipts_kind_check" CHECK("kind" in ('campaign_capture', 'application_event', 'application_note', 'listing_check', 'managed_application_update'))
);
--> statement-breakpoint
INSERT INTO `__new_command_receipts`(`operation_id`, `operation_request_signature`, `kind`, `application_id`, `event_id`, `capture_id`, `note_id`, `recorded_at`) SELECT `operation_id`, `operation_request_signature`, `kind`, `application_id`, `event_id`, `capture_id`, `note_id`, `recorded_at` FROM `command_receipts`;--> statement-breakpoint
DROP TABLE `command_receipts`;--> statement-breakpoint
ALTER TABLE `__new_command_receipts` RENAME TO `command_receipts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;