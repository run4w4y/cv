CREATE TABLE "application_artifacts" (
	"id" text PRIMARY KEY,
	"application_id" text NOT NULL,
	"category" text NOT NULL,
	"filename" text NOT NULL,
	"media_type" text NOT NULL,
	"object_key" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_length" integer NOT NULL,
	"source" text NOT NULL,
	"locale" text,
	"content_revision_id" text,
	"generated_artifact_id" text,
	"created_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "application_artifacts_category_check" CHECK ("category" in ('resume', 'cover_letter', 'supporting_document', 'other')),
	CONSTRAINT "application_artifacts_source_check" CHECK ("source" in ('generated', 'uploaded', 'imported')),
	CONSTRAINT "application_artifacts_filename_check" CHECK (length(btrim("filename")) > 0),
	CONSTRAINT "application_artifacts_media_type_check" CHECK (length(btrim("media_type")) > 0),
	CONSTRAINT "application_artifacts_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "application_artifacts_object_key_check" CHECK ("object_key" = 'sha256/' || "sha256"),
	CONSTRAINT "application_artifacts_byte_length_check" CHECK ("byte_length" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "application_artifacts_generated_unique" ON "application_artifacts" ("generated_artifact_id");--> statement-breakpoint
CREATE INDEX "application_artifacts_application_created_idx" ON "application_artifacts" ("application_id","created_at","id");--> statement-breakpoint
ALTER TABLE "application_artifacts" ADD CONSTRAINT "application_artifacts_application_id_applications_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "application_artifacts" ADD CONSTRAINT "application_artifacts_RDjBErfOf8Vn_fkey" FOREIGN KEY ("content_revision_id") REFERENCES "content_revisions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "application_artifacts" ADD CONSTRAINT "application_artifacts_hR8X4Ongb9sT_fkey" FOREIGN KEY ("generated_artifact_id") REFERENCES "generated_artifacts"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "idempotency_receipts" DROP CONSTRAINT "idempotency_receipts_scope_check", ADD CONSTRAINT "idempotency_receipts_scope_check" CHECK ("scope" in ('application_update', 'application_note', 'application_artifact', 'listing_check'));--> statement-breakpoint
INSERT INTO "application_artifacts" (
	"id",
	"application_id",
	"category",
	"filename",
	"media_type",
	"object_key",
	"sha256",
	"byte_length",
	"source",
	"locale",
	"content_revision_id",
	"generated_artifact_id",
	"created_at"
)
SELECT
	artifact."id",
	link."application_id",
	'resume',
	'resume-' || entry."locale" || '.pdf',
	artifact."media_type",
	artifact."object_key",
	artifact."sha256",
	artifact."byte_length",
	'generated',
	entry."locale",
	artifact."content_revision_id",
	artifact."id",
	coalesce(artifact."generated_at", artifact."updated_at")
FROM "generated_artifacts" artifact
INNER JOIN "cv_links" link
	ON link."id" = artifact."cv_link_id"
INNER JOIN "content_entries" entry
	ON entry."id" = link."content_entry_id"
WHERE artifact."status" = 'ready'
	AND artifact."kind" = 'pdf'
	AND artifact."media_type" = 'application/pdf'
	AND artifact."sha256" ~ '^[0-9a-f]{64}$'
	AND artifact."object_key" = 'sha256/' || artifact."sha256"
	AND artifact."byte_length" IS NOT NULL
	AND artifact."byte_length" >= 0;
