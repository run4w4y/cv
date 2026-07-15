ALTER TABLE `campaign_captures` ADD `application_url` text;--> statement-breakpoint
UPDATE `campaign_captures`
SET
	`application_url` = json_extract(`submission_details`, '$.applicationUrl'),
	`submission_details` = json_remove(`submission_details`, '$.applicationUrl')
WHERE json_type(`submission_details`, '$.applicationUrl') IS NOT NULL;--> statement-breakpoint
CREATE INDEX `application_events_application_revision_idx` ON `application_events` (`application_id`,`revision`);
