PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__cv_links_backup_generated_artifacts` AS SELECT * FROM `generated_artifacts`;--> statement-breakpoint
CREATE TABLE `__cv_links_backup_pdf_generation_outbox` AS SELECT * FROM `pdf_generation_outbox`;--> statement-breakpoint
CREATE TABLE `__new_cv_links` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`content_entry_id` text NOT NULL,
	`current_revision_id` text NOT NULL,
	`token` text NOT NULL,
	`preview_token` text NOT NULL,
	`public_url` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`disabled_reason` text,
	`disabled_at` text,
	`publication_version` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_cv_links_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_cv_links_content_entry_id_content_entries_id_fk` FOREIGN KEY (`content_entry_id`) REFERENCES `content_entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_cv_links_current_revision_id_content_revisions_id_fk` FOREIGN KEY (`current_revision_id`) REFERENCES `content_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT "cv_links_publication_version_check" CHECK("publication_version" >= 1),
	CONSTRAINT "cv_links_version_check" CHECK("version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_cv_links`(
	`id`,
	`application_id`,
	`content_entry_id`,
	`current_revision_id`,
	`token`,
	`preview_token`,
	`public_url`,
	`enabled`,
	`disabled_reason`,
	`disabled_at`,
	`publication_version`,
	`version`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`application_id`,
	`content_entry_id`,
	`published_revision_id`,
	`token`,
	lower(hex(randomblob(16))),
	`public_url`,
	`enabled`,
	`disabled_reason`,
	`disabled_at`,
	`publication_version`,
	`version`,
	`created_at`,
	`updated_at`
FROM `cv_links`;--> statement-breakpoint
DROP TABLE `cv_links`;--> statement-breakpoint
ALTER TABLE `__new_cv_links` RENAME TO `cv_links`;--> statement-breakpoint
DELETE FROM `pdf_generation_outbox`;--> statement-breakpoint
DELETE FROM `generated_artifacts`;--> statement-breakpoint
INSERT INTO `generated_artifacts` SELECT * FROM `__cv_links_backup_generated_artifacts`;--> statement-breakpoint
INSERT INTO `pdf_generation_outbox` SELECT * FROM `__cv_links_backup_pdf_generation_outbox`;--> statement-breakpoint
DROP TABLE `__cv_links_backup_generated_artifacts`;--> statement-breakpoint
DROP TABLE `__cv_links_backup_pdf_generation_outbox`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `cv_links_token_unique` ON `cv_links` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `cv_links_preview_token_unique` ON `cv_links` (`preview_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `cv_links_content_entry_unique` ON `cv_links` (`content_entry_id`);--> statement-breakpoint
CREATE INDEX `cv_links_application_enabled_idx` ON `cv_links` (`application_id`,`enabled`);
