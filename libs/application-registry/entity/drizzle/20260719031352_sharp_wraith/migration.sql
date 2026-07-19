CREATE TABLE `pdf_generation_outbox` (
	`artifact_id` text PRIMARY KEY,
	`application_id` text NOT NULL,
	`content_entry_id` text NOT NULL,
	`message_version` integer NOT NULL,
	`attempts` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_attempt_at` text,
	`last_error` text,
	`dispatched_at` text,
	CONSTRAINT `fk_pdf_generation_outbox_artifact_id_generated_artifacts_id_fk` FOREIGN KEY (`artifact_id`) REFERENCES `generated_artifacts`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_pdf_generation_outbox_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_pdf_generation_outbox_content_entry_id_content_entries_id_fk` FOREIGN KEY (`content_entry_id`) REFERENCES `content_entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT "pdf_generation_outbox_message_version_check" CHECK("message_version" >= 1),
	CONSTRAINT "pdf_generation_outbox_attempts_check" CHECK("attempts" >= 0)
);
--> statement-breakpoint
INSERT INTO `pdf_generation_outbox` (
	`artifact_id`,
	`application_id`,
	`content_entry_id`,
	`message_version`,
	`attempts`,
	`created_at`,
	`updated_at`
)
SELECT
	`generated_artifacts`.`id`,
	`cv_links`.`application_id`,
	`cv_links`.`content_entry_id`,
	1,
	0,
	`generated_artifacts`.`created_at`,
	`generated_artifacts`.`updated_at`
FROM `generated_artifacts`
INNER JOIN `cv_links`
	ON `cv_links`.`id` = `generated_artifacts`.`cv_link_id`
WHERE `generated_artifacts`.`status` = 'pending';
--> statement-breakpoint
ALTER TABLE `generated_artifacts` RENAME COLUMN `workflow_id` TO `request_id`;--> statement-breakpoint
DROP INDEX IF EXISTS `generated_artifacts_workflow_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `generated_artifacts_request_unique` ON `generated_artifacts` (`request_id`);--> statement-breakpoint
CREATE INDEX `pdf_generation_outbox_pending_idx` ON `pdf_generation_outbox` (`dispatched_at`,`created_at`);
