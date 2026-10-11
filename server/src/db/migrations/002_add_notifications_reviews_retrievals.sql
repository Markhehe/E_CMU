DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'notification_channel'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'review_stage'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.review_stage AS ENUM ('registrar', 'saso');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'review_decision'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.review_decision AS ENUM (
            'approved',
            'rejected',
            'needs_information'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'retrieval_method'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.retrieval_method AS ENUM (
            'download',
            'in_person',
            'authorized_representative',
            'other'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'retrieval_status'
          AND typnamespace = 'public'::regnamespace
    ) THEN
        CREATE TYPE public.retrieval_status AS ENUM (
            'pending',
            'released',
            'completed'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL,
    request_id uuid,
    channel public.notification_channel NOT NULL DEFAULT 'in_app',
    type varchar(100) NOT NULL,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    read_at timestamptz,
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT notifications_user_id_users_id_fk
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT notifications_request_id_requests_id_fk
        FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.request_reviews (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id uuid NOT NULL,
    stage public.review_stage NOT NULL,
    decision public.review_decision NOT NULL,
    reviewer_id bigint NOT NULL,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT request_reviews_request_id_requests_id_fk
        FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE,
    CONSTRAINT request_reviews_reviewer_id_users_id_fk
        FOREIGN KEY (reviewer_id) REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.retrievals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL,
    method public.retrieval_method NOT NULL,
    status public.retrieval_status NOT NULL DEFAULT 'pending',
    released_by bigint,
    recipient_name varchar(255),
    recipient_id_type varchar(100),
    recipient_id_reference varchar(255),
    notes text,
    released_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT retrievals_request_id_requests_id_fk
        FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE,
    CONSTRAINT retrievals_released_by_users_id_fk
        FOREIGN KEY (released_by) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
    ON public.notifications USING btree (user_id);

CREATE INDEX IF NOT EXISTS request_reviews_request_idx
    ON public.request_reviews USING btree (request_id);

CREATE UNIQUE INDEX IF NOT EXISTS retrievals_request_unique
    ON public.retrievals USING btree (request_id);
