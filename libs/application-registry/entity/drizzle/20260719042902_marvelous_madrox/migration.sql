CREATE TABLE `application_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor` text NOT NULL,
	`source` text NOT NULL,
	`revision` integer NOT NULL,
	`occurred_at` text NOT NULL,
	`payload` text NOT NULL,
	CONSTRAINT `fk_application_activities_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "application_activities_kind_check" CHECK("kind" in ('application_created', 'details_changed', 'status_changed', 'follow_up_changed', 'note_added', 'listing_availability_changed', 'preparation_started', 'content_approved', 'publication_changed', 'milestone_recorded')),
	CONSTRAINT "application_activities_actor_check" CHECK("actor" in ('user', 'system', 'automation', 'migration')),
	CONSTRAINT "application_activities_source_check" CHECK("source" in ('management', 'preparation', 'listing_checker', 'publisher', 'migration')),
	CONSTRAINT "application_activities_payload_json_check" CHECK(json_valid("payload"))
);
--> statement-breakpoint
INSERT INTO `application_activities` (
	`id`,
	`application_id`,
	`kind`,
	`actor`,
	`source`,
	`revision`,
	`occurred_at`,
	`payload`
)
SELECT
	`id`,
	`application_id`,
	CASE
		WHEN `kind` = 'discovered' THEN 'application_created'
		WHEN `kind` = 'listing_closed' THEN 'listing_availability_changed'
		WHEN `kind` IN (
			'submitted',
			'stage_changed',
			'interview_scheduled',
			'rejected',
			'withdrawn',
			'offer_received'
		) THEN 'status_changed'
		WHEN `kind` = 'note_added' THEN 'note_added'
		WHEN `kind` = 'follow_up_scheduled' THEN 'follow_up_changed'
		ELSE 'milestone_recorded'
	END,
	'migration',
	'migration',
	`revision`,
	`occurred_at`,
	`payload`
FROM `application_events`;
--> statement-breakpoint
CREATE TABLE `idempotency_receipts` (
	`idempotency_key` text PRIMARY KEY NOT NULL,
	`request_hash` text NOT NULL,
	`scope` text NOT NULL,
	`application_id` text NOT NULL,
	`resource_id` text,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_idempotency_receipts_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE,
	CONSTRAINT "idempotency_receipts_scope_check" CHECK("scope" in ('application_update', 'application_note', 'listing_check'))
);
--> statement-breakpoint
INSERT INTO `idempotency_receipts` (
	`idempotency_key`,
	`request_hash`,
	`scope`,
	`application_id`,
	`resource_id`,
	`created_at`
)
SELECT
	`operation_id`,
	`operation_request_signature`,
	CASE
		WHEN `kind` = 'managed_application_update' THEN 'application_update'
		WHEN `kind` = 'application_note' THEN 'application_note'
		ELSE 'listing_check'
	END,
	`application_id`,
	CASE
		WHEN `kind` = 'application_note' THEN `note_id`
		ELSE `event_id`
	END,
	`recorded_at`
FROM `command_receipts`
WHERE `kind` IN (
	'managed_application_update',
	'application_note',
	'listing_check'
);
--> statement-breakpoint
ALTER TABLE `applications` RENAME COLUMN `canonical_url` TO `posting_url`;--> statement-breakpoint
ALTER TABLE `applications` ADD `posting_url_normalized` text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `applications` ADD `posting_fingerprint` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `applications`
SET `posting_url_normalized` = `posting_url`;
--> statement-breakpoint
UPDATE `applications`
SET `posting_fingerprint` = CASE
	WHEN (
		SELECT count(*)
		FROM `applications` AS `duplicate`
		WHERE `duplicate`.`posting_url` = `applications`.`posting_url`
	) > 1
	THEN `posting_url` || '#' || `id`
	ELSE `posting_url`
END;
--> statement-breakpoint
DROP INDEX IF EXISTS `applications_job_key_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `applications_company_normalized_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `application_events_operation_id_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `application_events_application_occurred_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `application_events_application_revision_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `application_events_revision_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `application_identity_aliases_application_idx`;--> statement-breakpoint
CREATE INDEX `application_activities_application_occurred_idx` ON `application_activities` (`application_id`,`occurred_at`,`id`);--> statement-breakpoint
CREATE INDEX `application_activities_application_revision_idx` ON `application_activities` (`application_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `application_activities_revision_unique` ON `application_activities` (`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_posting_fingerprint_unique` ON `applications` (`posting_fingerprint`);--> statement-breakpoint
CREATE INDEX `applications_posting_url_normalized_idx` ON `applications` (`posting_url_normalized`);--> statement-breakpoint
CREATE INDEX `applications_company_idx` ON `applications` (`company`);--> statement-breakpoint
DROP TABLE `application_events`;--> statement-breakpoint
DROP TABLE `application_identity_aliases`;--> statement-breakpoint
DROP TABLE `command_receipts`;--> statement-breakpoint
ALTER TABLE `applications` DROP COLUMN `job_key`;--> statement-breakpoint
ALTER TABLE `applications` DROP COLUMN `source`;--> statement-breakpoint
ALTER TABLE `applications` DROP COLUMN `source_job_id`;--> statement-breakpoint
ALTER TABLE `applications` DROP COLUMN `company_normalized`;--> statement-breakpoint
ALTER TABLE `applications` DROP COLUMN `last_contact_at`;
