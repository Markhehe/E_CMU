CREATE TABLE public.clearance_submissions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_data text NOT NULL,
    original_name varchar(255) NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted', 'needs_update', 'verified')),
    comment text,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    reviewed_by bigint REFERENCES public.users(id),
    reviewed_at timestamptz
);

CREATE INDEX clearance_submissions_user_idx
    ON public.clearance_submissions(user_id, submitted_at DESC);
