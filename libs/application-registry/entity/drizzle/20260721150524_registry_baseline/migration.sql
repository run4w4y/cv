CREATE TABLE "application_activities" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"kind" text NOT NULL,
	"actor" text NOT NULL,
	"source" text NOT NULL,
	"revision" integer NOT NULL,
	"occurred_at" timestamp(3) with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "application_activities_kind_check" CHECK ("kind" in ('application_created', 'details_changed', 'status_changed', 'follow_up_changed', 'note_added', 'listing_availability_changed', 'preparation_started', 'content_approved', 'publication_changed', 'milestone_recorded')),
	CONSTRAINT "application_activities_actor_check" CHECK ("actor" in ('user', 'system', 'automation', 'migration')),
	CONSTRAINT "application_activities_source_check" CHECK ("source" in ('management', 'preparation', 'listing_checker', 'publisher', 'migration'))
);
--> statement-breakpoint
CREATE TABLE "application_labels" (
	"application_id" text,
	"label" text,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "application_labels_pkey" PRIMARY KEY("application_id","label")
);
--> statement-breakpoint
CREATE TABLE "application_notes" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"source" text,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "application_notes_kind_check" CHECK ("kind" in ('summary', 'role_description', 'why_this_fits', 'caveat', 'research', 'application', 'interview_prep', 'contact', 'general'))
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY,
	"posting_url" text NOT NULL,
	"posting_url_normalized" text NOT NULL,
	"posting_fingerprint" text NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"location" text,
	"application_status" text DEFAULT 'not_started' NOT NULL,
	"target_stage" text DEFAULT 'backlog' NOT NULL,
	"personal_priority" text,
	"follow_up_at" timestamp(3) with time zone,
	"applied_at" timestamp(3) with time zone,
	"listing_availability" text DEFAULT 'unchecked' NOT NULL,
	"listing_confidence" text,
	"listing_reason_code" text,
	"listing_checked_at" timestamp(3) with time zone,
	"listing_closed_candidate_at" timestamp(3) with time zone,
	"listing_consecutive_closed_checks" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_revision" integer NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "applications_status_check" CHECK ("application_status" in ('not_started', 'preparing', 'applied', 'recruiter_screen', 'technical_screen', 'take_home', 'interview_loop', 'paused', 'offer', 'rejected', 'withdrawn', 'archived')),
	CONSTRAINT "applications_target_stage_check" CHECK ("target_stage" in ('apply_next', 'verify_first', 'secondary', 'backlog', 'watch_after_move', 'closed_skip')),
	CONSTRAINT "applications_personal_priority_check" CHECK ("personal_priority" is null or "personal_priority" in ('low', 'medium', 'high', 'pass')),
	CONSTRAINT "applications_listing_availability_check" CHECK ("listing_availability" in ('unchecked', 'open', 'suspected_closed', 'closed', 'unknown')),
	CONSTRAINT "applications_listing_confidence_check" CHECK ("listing_confidence" is null or "listing_confidence" in ('low', 'medium', 'high', 'confirmed')),
	CONSTRAINT "applications_listing_reason_check" CHECK ("listing_reason_code" is null or "listing_reason_code" in ('http_404', 'http_410', 'provider_open', 'provider_closed', 'valid_through_expired', 'explicit_closed_text', 'working_application_path', 'identity_mismatch', 'redirected_to_listing_page', 'access_forbidden', 'rate_limited', 'server_error', 'network_error', 'unclassified_page')),
	CONSTRAINT "applications_listing_closed_count_check" CHECK ("listing_consecutive_closed_checks" >= 0),
	CONSTRAINT "applications_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "generated_artifacts" (
	"id" text PRIMARY KEY,
	"cv_link_id" text NOT NULL,
	"content_revision_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"request_id" text NOT NULL,
	"renderer_version" text NOT NULL,
	"publication_version" integer NOT NULL,
	"qr_target" text NOT NULL,
	"object_key" text,
	"sha256" text,
	"byte_length" integer,
	"media_type" text,
	"error_code" text,
	"error_message" text,
	"generated_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "generated_artifacts_kind_check" CHECK ("kind" in ('pdf')),
	CONSTRAINT "generated_artifacts_status_check" CHECK ("status" in ('pending', 'ready', 'failed')),
	CONSTRAINT "generated_artifacts_byte_length_check" CHECK ("byte_length" is null or "byte_length" >= 0),
	CONSTRAINT "generated_artifacts_publication_version_check" CHECK ("publication_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "application_compensations" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"kind" text NOT NULL,
	"currency_code" text NOT NULL,
	"minimum_minor" bigint,
	"maximum_minor" bigint,
	"period" text NOT NULL,
	"raw_text" text,
	"source" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "application_compensations_kind_check" CHECK ("kind" in ('base_salary', 'total_compensation', 'bonus', 'equity', 'other')),
	CONSTRAINT "application_compensations_currency_code_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
	CONSTRAINT "application_compensations_period_check" CHECK ("period" in ('hour', 'day', 'week', 'month', 'year', 'one_time', 'unknown')),
	CONSTRAINT "application_compensations_minimum_check" CHECK ("minimum_minor" is null or ("minimum_minor" between 0 and 9007199254740991)),
	CONSTRAINT "application_compensations_maximum_check" CHECK ("maximum_minor" is null or ("maximum_minor" between 0 and 9007199254740991)),
	CONSTRAINT "application_compensations_range_check" CHECK ("minimum_minor" is null or "maximum_minor" is null or "minimum_minor" <= "maximum_minor")
);
--> statement-breakpoint
CREATE TABLE "content_entries" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"kind" text NOT NULL,
	"locale" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"head_revision_id" text,
	"approved_revision_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "content_entries_kind_check" CHECK ("kind" in ('cv', 'cover_letter')),
	CONSTRAINT "content_entries_state_check" CHECK ("state" in ('draft', 'approved')),
	CONSTRAINT "content_entries_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" text PRIMARY KEY,
	"content_entry_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"parent_revision_id" text,
	"contract_id" text NOT NULL,
	"contract_version" text NOT NULL,
	"object_key" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_length" integer NOT NULL,
	"media_type" text NOT NULL,
	"source" text NOT NULL,
	"facts_release_id" text,
	"job_snapshot_id" text,
	"operation_id" text NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "content_revisions_source_check" CHECK ("source" in ('ai', 'human', 'ai_adjustment', 'migration')),
	CONSTRAINT "content_revisions_revision_number_check" CHECK ("revision_number" >= 1),
	CONSTRAINT "content_revisions_byte_length_check" CHECK ("byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE "cv_links" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"content_entry_id" text NOT NULL,
	"current_revision_id" text NOT NULL,
	"token" text NOT NULL,
	"preview_token" text NOT NULL,
	"public_url" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"disabled_reason" text,
	"disabled_at" timestamp(3) with time zone,
	"publication_version" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "cv_links_publication_version_check" CHECK ("publication_version" >= 1),
	CONSTRAINT "cv_links_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "job_posting_snapshots" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"requested_url" text NOT NULL,
	"final_url" text,
	"status" text NOT NULL,
	"fetched_at" timestamp(3) with time zone NOT NULL,
	"fetcher_version" text NOT NULL,
	"raw_object_key" text,
	"raw_sha256" text,
	"raw_byte_length" integer,
	"raw_media_type" text,
	"normalized_object_key" text,
	"normalized_sha256" text,
	"normalized_byte_length" integer,
	"normalized_media_type" text,
	"error_code" text,
	"error_message" text,
	CONSTRAINT "job_posting_snapshots_status_check" CHECK ("status" in ('fetched', 'provided', 'failed')),
	CONSTRAINT "job_posting_snapshots_raw_byte_length_check" CHECK ("raw_byte_length" is null or "raw_byte_length" >= 0),
	CONSTRAINT "job_posting_snapshots_normalized_byte_length_check" CHECK ("normalized_byte_length" is null or "normalized_byte_length" >= 0)
);
--> statement-breakpoint
CREATE TABLE "application_listing_check_schedules" (
	"application_id" text PRIMARY KEY,
	"due_at" timestamp(3) with time zone NOT NULL,
	"lease_token" text,
	"lease_until" timestamp(3) with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "listing_check_schedules_attempt_count_check" CHECK ("attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "application_listing_checks" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"run_id" text,
	"operation_id" text NOT NULL,
	"requested_url" text NOT NULL,
	"final_url" text,
	"provider" text NOT NULL,
	"outcome" text NOT NULL,
	"confidence" text NOT NULL,
	"recommended_action" text NOT NULL,
	"reason_code" text NOT NULL,
	"http_status" integer,
	"evidence" jsonb NOT NULL,
	"content_hash" text,
	"checker_version" text NOT NULL,
	"checked_at" timestamp(3) with time zone NOT NULL,
	"received_at" timestamp(3) with time zone NOT NULL,
	"next_check_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "application_listing_checks_outcome_check" CHECK ("outcome" in ('open', 'closed', 'unknown')),
	CONSTRAINT "application_listing_checks_confidence_check" CHECK ("confidence" in ('low', 'medium', 'high', 'confirmed')),
	CONSTRAINT "application_listing_checks_action_check" CHECK ("recommended_action" in ('keep', 'recheck', 'review', 'archive')),
	CONSTRAINT "application_listing_checks_reason_check" CHECK ("reason_code" in ('http_404', 'http_410', 'provider_open', 'provider_closed', 'valid_through_expired', 'explicit_closed_text', 'working_application_path', 'identity_mismatch', 'redirected_to_listing_page', 'access_forbidden', 'rate_limited', 'server_error', 'network_error', 'unclassified_page')),
	CONSTRAINT "application_listing_checks_http_status_check" CHECK ("http_status" is null or ("http_status" >= 100 and "http_status" <= 599))
);
--> statement-breakpoint
CREATE TABLE "listing_check_runs" (
	"id" text PRIMARY KEY,
	"trigger" text NOT NULL,
	"mode" text NOT NULL,
	"state" text NOT NULL,
	"selected_count" integer DEFAULT 0 NOT NULL,
	"checked_count" integer DEFAULT 0 NOT NULL,
	"open_count" integer DEFAULT 0 NOT NULL,
	"closed_count" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp(3) with time zone NOT NULL,
	"completed_at" timestamp(3) with time zone,
	"failed_at" timestamp(3) with time zone,
	"failure_code" text,
	"failure_message" text,
	CONSTRAINT "listing_check_runs_trigger_check" CHECK ("trigger" in ('cli', 'scheduled')),
	CONSTRAINT "listing_check_runs_mode_check" CHECK ("mode" in ('report', 'archive_eligible')),
	CONSTRAINT "listing_check_runs_state_check" CHECK ("state" in ('running', 'completed', 'failed')),
	CONSTRAINT "listing_check_runs_counts_check" CHECK ("selected_count" >= 0 and "checked_count" >= 0 and "open_count" >= 0 and "closed_count" >= 0 and "review_count" >= 0 and "error_count" >= 0),
	CONSTRAINT "listing_check_runs_terminal_state_check" CHECK (("state" = 'running' and "completed_at" is null and "failed_at" is null and "failure_code" is null and "failure_message" is null) or ("state" = 'completed' and "completed_at" is not null and "failed_at" is null and "failure_code" is null and "failure_message" is null) or ("state" = 'failed' and "completed_at" is null and "failed_at" is not null and "failure_code" is not null and "failure_message" is not null))
);
--> statement-breakpoint
CREATE TABLE "idempotency_receipts" (
	"idempotency_key" text PRIMARY KEY,
	"request_hash" text NOT NULL,
	"scope" text NOT NULL,
	"application_id" text NOT NULL,
	"resource_id" text,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "idempotency_receipts_scope_check" CHECK ("scope" in ('application_update', 'application_note', 'listing_check'))
);
--> statement-breakpoint
CREATE TABLE "registry_sequence" (
	"id" integer PRIMARY KEY,
	"revision" integer NOT NULL,
	CONSTRAINT "registry_sequence_singleton_check" CHECK ("id" = 1),
	CONSTRAINT "registry_sequence_revision_check" CHECK ("revision" >= 1)
);
--> statement-breakpoint
CREATE INDEX "application_activities_application_occurred_idx" ON "application_activities" ("application_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "application_activities_application_revision_idx" ON "application_activities" ("application_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "application_activities_revision_unique" ON "application_activities" ("revision");--> statement-breakpoint
CREATE INDEX "application_labels_label_idx" ON "application_labels" ("label","application_id");--> statement-breakpoint
CREATE INDEX "application_notes_application_created_idx" ON "application_notes" ("application_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_posting_fingerprint_unique" ON "applications" ("posting_fingerprint");--> statement-breakpoint
CREATE INDEX "applications_posting_url_normalized_idx" ON "applications" ("posting_url_normalized");--> statement-breakpoint
CREATE INDEX "applications_company_idx" ON "applications" ("company");--> statement-breakpoint
CREATE INDEX "applications_status_updated_revision_idx" ON "applications" ("application_status","updated_revision");--> statement-breakpoint
CREATE INDEX "applications_target_stage_updated_revision_idx" ON "applications" ("target_stage","updated_revision");--> statement-breakpoint
CREATE INDEX "applications_listing_availability_idx" ON "applications" ("listing_availability");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_updated_revision_unique" ON "applications" ("updated_revision");--> statement-breakpoint
CREATE UNIQUE INDEX "generated_artifacts_request_unique" ON "generated_artifacts" ("request_id");--> statement-breakpoint
CREATE INDEX "generated_artifacts_publication_status_idx" ON "generated_artifacts" ("cv_link_id","content_revision_id","renderer_version","publication_version","status","updated_at");--> statement-breakpoint
CREATE INDEX "generated_artifacts_link_status_idx" ON "generated_artifacts" ("cv_link_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "application_compensations_application_idx" ON "application_compensations" ("application_id","kind","id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_entries_application_kind_locale_unique" ON "content_entries" ("application_id","kind","locale");--> statement-breakpoint
CREATE INDEX "content_entries_application_updated_idx" ON "content_entries" ("application_id","updated_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_entry_number_unique" ON "content_revisions" ("content_entry_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "content_revisions_operation_unique" ON "content_revisions" ("operation_id");--> statement-breakpoint
CREATE INDEX "content_revisions_entry_created_idx" ON "content_revisions" ("content_entry_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "cv_links_token_unique" ON "cv_links" ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "cv_links_preview_token_unique" ON "cv_links" ("preview_token");--> statement-breakpoint
CREATE UNIQUE INDEX "cv_links_content_entry_unique" ON "cv_links" ("content_entry_id");--> statement-breakpoint
CREATE INDEX "cv_links_application_enabled_idx" ON "cv_links" ("application_id","enabled");--> statement-breakpoint
CREATE INDEX "job_posting_snapshots_application_fetched_idx" ON "job_posting_snapshots" ("application_id","fetched_at","id");--> statement-breakpoint
CREATE INDEX "listing_check_schedules_due_lease_idx" ON "application_listing_check_schedules" ("due_at","lease_until");--> statement-breakpoint
CREATE UNIQUE INDEX "application_listing_checks_operation_unique" ON "application_listing_checks" ("operation_id");--> statement-breakpoint
CREATE INDEX "application_listing_checks_application_checked_idx" ON "application_listing_checks" ("application_id","checked_at","id");--> statement-breakpoint
CREATE INDEX "application_listing_checks_run_idx" ON "application_listing_checks" ("run_id","id");--> statement-breakpoint
CREATE INDEX "listing_check_runs_started_idx" ON "listing_check_runs" ("started_at","id");--> statement-breakpoint
ALTER TABLE "application_activities" ADD CONSTRAINT "application_activities_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_labels" ADD CONSTRAINT "application_labels_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_cv_link_id_cv_links_id_fkey" FOREIGN KEY ("cv_link_id") REFERENCES "cv_links"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "generated_artifacts" ADD CONSTRAINT "generated_artifacts_dlJnOBskmw6I_fkey" FOREIGN KEY ("content_revision_id") REFERENCES "content_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_compensations" ADD CONSTRAINT "application_compensations_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_content_entry_id_content_entries_id_fkey" FOREIGN KEY ("content_entry_id") REFERENCES "content_entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_job_snapshot_id_job_posting_snapshots_id_fkey" FOREIGN KEY ("job_snapshot_id") REFERENCES "job_posting_snapshots"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cv_links" ADD CONSTRAINT "cv_links_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cv_links" ADD CONSTRAINT "cv_links_content_entry_id_content_entries_id_fkey" FOREIGN KEY ("content_entry_id") REFERENCES "content_entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cv_links" ADD CONSTRAINT "cv_links_current_revision_id_content_revisions_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "content_revisions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_posting_snapshots" ADD CONSTRAINT "job_posting_snapshots_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_listing_check_schedules" ADD CONSTRAINT "application_listing_check_schedules_w60F9b0GyS3i_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_listing_checks" ADD CONSTRAINT "application_listing_checks_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_listing_checks" ADD CONSTRAINT "application_listing_checks_run_id_listing_check_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "listing_check_runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "idempotency_receipts" ADD CONSTRAINT "idempotency_receipts_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;