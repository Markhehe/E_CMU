CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'gcash');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending_review', 'on_hold', 'pending_payment', 'clearance_review', 'paid', 'processing', 'ready_for_pickup', 'fulfilled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."retrieval_method" AS ENUM('download', 'in_person', 'authorized_representative', 'other');--> statement-breakpoint
CREATE TYPE "public"."retrieval_status" AS ENUM('pending', 'released', 'completed');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approved', 'rejected', 'needs_information');--> statement-breakpoint
CREATE TYPE "public"."review_stage" AS ENUM('registrar', 'saso');--> statement-breakpoint
CREATE TYPE "public"."stakeholder_type" AS ENUM('student', 'professor', 'other');--> statement-breakpoint
CREATE SEQUENCE "public"."request_display_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 16777215 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" bigint,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clearance_submissions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clearance_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"file_data" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'submitted' NOT NULL,
	"comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" bigint,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "clearance_submissions_status_check" CHECK ("clearance_submissions"."status" in ('submitted', 'needs_update', 'verified'))
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"processing_days" integer DEFAULT 5 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_name_unique" UNIQUE("name"),
	CONSTRAINT "document_types_base_fee_check" CHECK ("document_types"."base_fee" >= 0),
	CONSTRAINT "document_types_processing_days_check" CHECK ("document_types"."processing_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"code_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "email_verification_tokens_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "email_verification_tokens_attempts_check" CHECK ("email_verification_tokens"."attempts" between 0 and 5)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"request_id" uuid,
	"comment_id" bigint,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" char(3) NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider" text NOT NULL,
	"provider_reference" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmed_by" bigint,
	"notes" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_reference_unique" UNIQUE("provider_reference"),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" >= 0),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" in ('pending', 'succeeded', 'failed', 'ref'))
);
--> statement-breakpoint
CREATE TABLE "request_comment_reads" (
	"comment_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_comment_reads_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "request_comments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_comments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"request_id" uuid NOT NULL,
	"author_id" bigint NOT NULL,
	"visibility" varchar(20) NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_comments_visibility_check" CHECK ("request_comments"."visibility" in ('requester', 'staff')),
	CONSTRAINT "request_comments_comment_check" CHECK (char_length("request_comments"."comment") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "request_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"uploaded_by" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"file_kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_files_file_kind_check" CHECK ("request_files"."file_kind" in ('supporting', 'fulfilled'))
);
--> statement-breakpoint
CREATE TABLE "request_reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "request_reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"request_id" uuid NOT NULL,
	"stage" "review_stage" NOT NULL,
	"decision" "review_decision" NOT NULL,
	"reviewer_id" bigint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_status_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" bigint,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_code" varchar(6) DEFAULT upper(lpad(to_hex(nextval('public.request_display_code_seq')), 6, '0')) NOT NULL,
	"requester_id" bigint NOT NULL,
	"document_type_id" bigint NOT NULL,
	"status" "request_status" DEFAULT 'pending_review' NOT NULL,
	"purpose" text,
	"additional_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fee_amount" numeric(12, 2),
	"fee_currency" char(3),
	"assigned_to" bigint,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_display_code_unique" UNIQUE("display_code"),
	CONSTRAINT "requests_display_code_hex_chk" CHECK ("requests"."display_code" ~ '^[0-9A-F]{6}$'),
	CONSTRAINT "requests_fee_amount_check" CHECK ("requests"."fee_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "retrievals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"method" "retrieval_method" NOT NULL,
	"status" "retrieval_status" DEFAULT 'pending' NOT NULL,
	"released_by" bigint,
	"recipient_name" varchar(255),
	"recipient_id_type" varchar(100),
	"recipient_id_reference" varchar(255),
	"notes" text,
	"released_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "student_directory" (
	"student_id" varchar(64) PRIMARY KEY NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) NOT NULL,
	"middle_name" varchar(120),
	"birthdate" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" bigint NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"student_id" varchar(64),
	"contact_phone" varchar(40),
	"contact_address" text,
	"stakeholder_type" "stakeholder_type" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clearance_submissions" ADD CONSTRAINT "clearance_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clearance_submissions" ADD CONSTRAINT "clearance_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_request_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."request_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comment_reads" ADD CONSTRAINT "request_comment_reads_comment_id_request_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."request_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comment_reads" ADD CONSTRAINT "request_comment_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comments" ADD CONSTRAINT "request_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_files" ADD CONSTRAINT "request_files_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_files" ADD CONSTRAINT "request_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_reviews" ADD CONSTRAINT "request_reviews_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_reviews" ADD CONSTRAINT "request_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_history" ADD CONSTRAINT "request_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrievals" ADD CONSTRAINT "retrievals_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrievals" ADD CONSTRAINT "retrievals_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_student_id_student_directory_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_directory"("student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "clearance_submissions_user_idx" ON "clearance_submissions" USING btree ("user_id","submitted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_request_idx" ON "payments" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_comment_reads_user_idx" ON "request_comment_reads" USING btree ("user_id","comment_id");--> statement-breakpoint
CREATE INDEX "request_comments_request_idx" ON "request_comments" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "request_files_request_idx" ON "request_files" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_reviews_request_idx" ON "request_reviews" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "request_history_request_idx" ON "request_status_history" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "requests_requester_idx" ON "requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "retrievals_request_unique" ON "retrievals" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "student_directory_first_name_trgm_idx" ON "student_directory" USING gin (lower("first_name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "student_directory_middle_name_trgm_idx" ON "student_directory" USING gin (lower("middle_name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "student_directory_last_name_trgm_idx" ON "student_directory" USING gin (lower("last_name") gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "users_student_id_unique" ON "users" USING btree ("student_id") WHERE "users"."student_id" is not null;--> statement-breakpoint
CREATE INDEX "users_full_name_trgm_idx" ON "users" USING gin (lower("full_name") gin_trgm_ops);