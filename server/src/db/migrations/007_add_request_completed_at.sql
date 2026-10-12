ALTER TABLE public.requests
    ADD COLUMN IF NOT EXISTS completed_at timestamptz;
