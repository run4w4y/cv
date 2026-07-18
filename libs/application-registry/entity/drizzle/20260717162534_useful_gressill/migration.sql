CREATE TABLE `generated_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`cv_link_id` text NOT NULL,
	`content_revision_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`workflow_id` text,
	`renderer_version` text NOT NULL,
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
	CONSTRAINT `fk_generated_artifacts_cv_link_id_cv_links_id_fk` FOREIGN KEY (`cv_link_id`) REFERENCES `cv_links`(`id`),
	CONSTRAINT `fk_generated_artifacts_content_revision_id_content_revisions_id_fk` FOREIGN KEY (`content_revision_id`) REFERENCES `content_revisions`(`id`),
	CONSTRAINT "generated_artifacts_kind_check" CHECK("kind" in ('pdf')),
	CONSTRAINT "generated_artifacts_status_check" CHECK("status" in ('pending', 'ready', 'failed')),
	CONSTRAINT "generated_artifacts_byte_length_check" CHECK("byte_length" is null or "byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE `content_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`locale` text NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`head_revision_id` text,
	`approved_revision_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_content_entries_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "content_entries_kind_check" CHECK("kind" in ('cv', 'cover_letter')),
	CONSTRAINT "content_entries_state_check" CHECK("state" in ('draft', 'approved')),
	CONSTRAINT "content_entries_version_check" CHECK("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE `content_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_entry_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`parent_revision_id` text,
	`contract_id` text NOT NULL,
	`contract_version` text NOT NULL,
	`object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_length` integer NOT NULL,
	`media_type` text NOT NULL,
	`source` text NOT NULL,
	`facts_release_id` text,
	`job_snapshot_id` text,
	`operation_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_content_revisions_content_entry_id_content_entries_id_fk` FOREIGN KEY (`content_entry_id`) REFERENCES `content_entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_content_revisions_facts_release_id_facts_releases_id_fk` FOREIGN KEY (`facts_release_id`) REFERENCES `facts_releases`(`id`),
	CONSTRAINT `fk_content_revisions_job_snapshot_id_job_posting_snapshots_id_fk` FOREIGN KEY (`job_snapshot_id`) REFERENCES `job_posting_snapshots`(`id`) ON DELETE SET NULL,
	CONSTRAINT "content_revisions_source_check" CHECK("source" in ('ai', 'human', 'ai_adjustment', 'migration')),
	CONSTRAINT "content_revisions_revision_number_check" CHECK("revision_number" >= 1),
	CONSTRAINT "content_revisions_byte_length_check" CHECK("byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE `cv_links` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`content_entry_id` text NOT NULL,
	`published_revision_id` text NOT NULL,
	`token` text NOT NULL,
	`public_url` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`disabled_reason` text,
	`disabled_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_cv_links_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_cv_links_content_entry_id_content_entries_id_fk` FOREIGN KEY (`content_entry_id`) REFERENCES `content_entries`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_cv_links_published_revision_id_content_revisions_id_fk` FOREIGN KEY (`published_revision_id`) REFERENCES `content_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT "cv_links_version_check" CHECK("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE `facts_channels` (
	`name` text PRIMARY KEY NOT NULL,
	`active_release_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_facts_channels_active_release_id_facts_releases_id_fk` FOREIGN KEY (`active_release_id`) REFERENCES `facts_releases`(`id`),
	CONSTRAINT "facts_channels_version_check" CHECK("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE `facts_release_assets` (
	`release_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_length` integer NOT NULL,
	`media_type` text NOT NULL,
	CONSTRAINT `facts_release_assets_pk` PRIMARY KEY(`release_id`, `asset_id`),
	CONSTRAINT `fk_facts_release_assets_release_id_facts_releases_id_fk` FOREIGN KEY (`release_id`) REFERENCES `facts_releases`(`id`),
	CONSTRAINT "facts_release_assets_byte_length_check" CHECK("byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE `facts_release_catalogs` (
	`release_id` text NOT NULL,
	`locale` text NOT NULL,
	`object_key` text NOT NULL,
	`sha256` text NOT NULL,
	`byte_length` integer NOT NULL,
	`media_type` text NOT NULL,
	CONSTRAINT `facts_release_catalogs_pk` PRIMARY KEY(`release_id`, `locale`),
	CONSTRAINT `fk_facts_release_catalogs_release_id_facts_releases_id_fk` FOREIGN KEY (`release_id`) REFERENCES `facts_releases`(`id`),
	CONSTRAINT "facts_release_catalogs_byte_length_check" CHECK("byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE `facts_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`facts_schema_version` text NOT NULL,
	`source_repository` text NOT NULL,
	`source_commit` text NOT NULL,
	`compiler_repository` text NOT NULL,
	`compiler_commit` text NOT NULL,
	`manifest_object_key` text NOT NULL,
	`manifest_sha256` text NOT NULL,
	`manifest_byte_length` integer NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "facts_releases_manifest_byte_length_check" CHECK("manifest_byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE `job_posting_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`requested_url` text NOT NULL,
	`final_url` text,
	`status` text NOT NULL,
	`fetched_at` text NOT NULL,
	`fetcher_version` text NOT NULL,
	`raw_object_key` text,
	`raw_sha256` text,
	`raw_byte_length` integer,
	`raw_media_type` text,
	`normalized_object_key` text,
	`normalized_sha256` text,
	`normalized_byte_length` integer,
	`normalized_media_type` text,
	`error_code` text,
	`error_message` text,
	CONSTRAINT `fk_job_posting_snapshots_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "job_posting_snapshots_status_check" CHECK("status" in ('fetched', 'provided', 'failed')),
	CONSTRAINT "job_posting_snapshots_raw_byte_length_check" CHECK("raw_byte_length" is null or "raw_byte_length" >= 0),
	CONSTRAINT "job_posting_snapshots_normalized_byte_length_check" CHECK("normalized_byte_length" is null or "normalized_byte_length" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generated_artifacts_render_unique` ON `generated_artifacts` (`cv_link_id`,`content_revision_id`,`kind`,`renderer_version`);--> statement-breakpoint
CREATE INDEX `generated_artifacts_link_status_idx` ON `generated_artifacts` (`cv_link_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_entries_application_kind_locale_unique` ON `content_entries` (`application_id`,`kind`,`locale`);--> statement-breakpoint
CREATE INDEX `content_entries_application_updated_idx` ON `content_entries` (`application_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_revisions_entry_number_unique` ON `content_revisions` (`content_entry_id`,`revision_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_revisions_operation_unique` ON `content_revisions` (`operation_id`);--> statement-breakpoint
CREATE INDEX `content_revisions_entry_created_idx` ON `content_revisions` (`content_entry_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cv_links_token_unique` ON `cv_links` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `cv_links_content_entry_unique` ON `cv_links` (`content_entry_id`);--> statement-breakpoint
CREATE INDEX `cv_links_application_enabled_idx` ON `cv_links` (`application_id`,`enabled`);--> statement-breakpoint
CREATE UNIQUE INDEX `facts_releases_input_unique` ON `facts_releases` (`source_repository`,`source_commit`,`compiler_commit`,`facts_schema_version`);--> statement-breakpoint
CREATE INDEX `job_posting_snapshots_application_fetched_idx` ON `job_posting_snapshots` (`application_id`,`fetched_at`,`id`);
