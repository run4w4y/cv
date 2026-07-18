PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_generated_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`cv_link_id` text NOT NULL,
	`content_revision_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`workflow_id` text NOT NULL,
	`renderer_version` text NOT NULL,
	`publication_version` integer NOT NULL,
	`qr_target` text NOT NULL,
	`object_key` text,
	`sha256` text,
	`byte_length` integer,
	`media_type` text,
	`error_code` text,
	`error_message` text,
	`generated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_generated_artifacts_cv_link_id_cv_links_id_fk` FOREIGN KEY (`cv_link_id`) REFERENCES `cv_links`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_generated_artifacts_content_revision_id_content_revisions_id_fk` FOREIGN KEY (`content_revision_id`) REFERENCES `content_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT "generated_artifacts_kind_check" CHECK("kind" in ('pdf')),
	CONSTRAINT "generated_artifacts_status_check" CHECK("status" in ('pending', 'ready', 'failed')),
	CONSTRAINT "generated_artifacts_byte_length_check" CHECK("byte_length" is null or "byte_length" >= 0),
	CONSTRAINT "generated_artifacts_publication_version_check" CHECK("publication_version" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_generated_artifacts`(`id`, `cv_link_id`, `content_revision_id`, `kind`, `status`, `workflow_id`, `renderer_version`, `publication_version`, `qr_target`, `object_key`, `sha256`, `byte_length`, `media_type`, `error_code`, `error_message`, `generated_at`, `created_at`, `updated_at`)
SELECT
	`id`,
	`cv_link_id`,
	`content_revision_id`,
	`kind`,
	`status`,
	'legacy:' || `id` || ':' || coalesce(`workflow_id`, 'missing'),
	`renderer_version`,
	coalesce((SELECT `version` FROM `cv_links` WHERE `cv_links`.`id` = `generated_artifacts`.`cv_link_id`), 1),
	`qr_target`,
	`object_key`,
	`sha256`,
	`byte_length`,
	`media_type`,
	`error_code`,
	`error_message`,
	`generated_at`,
	`created_at`,
	`updated_at`
FROM `generated_artifacts`;--> statement-breakpoint
DROP TABLE `generated_artifacts`;--> statement-breakpoint
ALTER TABLE `__new_generated_artifacts` RENAME TO `generated_artifacts`;--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `generated_artifacts_workflow_unique` ON `generated_artifacts` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `generated_artifacts_publication_status_idx` ON `generated_artifacts` (`cv_link_id`,`content_revision_id`,`renderer_version`,`publication_version`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `generated_artifacts_link_status_idx` ON `generated_artifacts` (`cv_link_id`,`status`,`updated_at`);
