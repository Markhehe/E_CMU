CREATE TABLE "student_login_verification_tokens" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"code_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_login_verification_tokens_attempts_check" CHECK ("student_login_verification_tokens"."attempts" between 0 and 5),
	CONSTRAINT "student_login_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
