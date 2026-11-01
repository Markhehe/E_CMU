ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'registrar_review';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'registrar_approved';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'registrar_rejected';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'saso_review';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'saso_cleared';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'saso_rejected';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'payment_review';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'ready_for_retrieval';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'payment_method'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.payment_method AS ENUM ('cash', 'gcash');
    END IF;
END
$$;

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS method public.payment_method;

UPDATE public.payments
SET method = CASE
    WHEN lower(provider) LIKE '%gcash%' THEN 'gcash'::public.payment_method
    ELSE 'cash'::public.payment_method
END
WHERE method IS NULL;

ALTER TABLE public.payments
    ALTER COLUMN method SET DEFAULT 'cash',
    ALTER COLUMN method SET NOT NULL,
    ADD COLUMN IF NOT EXISTS confirmed_by bigint REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE TABLE public.request_comments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    author_id bigint NOT NULL REFERENCES public.users(id),
    visibility varchar(20) NOT NULL CHECK (visibility IN ('requester', 'staff')),
    comment text NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX request_comments_request_idx
    ON public.request_comments USING btree (request_id, created_at);
