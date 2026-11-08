ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'overdue';

ALTER TABLE public.requests
    ADD COLUMN IF NOT EXISTS eta_at timestamptz,
    ADD COLUMN IF NOT EXISTS eta_update_requested_at timestamptz;
