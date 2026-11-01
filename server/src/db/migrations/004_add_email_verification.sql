ALTER TABLE public.users
    ADD COLUMN email_verified boolean NOT NULL DEFAULT true;

CREATE TABLE public.email_verification_tokens (
    user_id bigint PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash char(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL
);
