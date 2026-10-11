ALTER TABLE public.email_verification_tokens
    RENAME COLUMN token_hash TO code_hash;

ALTER TABLE public.email_verification_tokens
    ADD COLUMN attempts smallint NOT NULL DEFAULT 0
        CHECK (attempts BETWEEN 0 AND 5);
