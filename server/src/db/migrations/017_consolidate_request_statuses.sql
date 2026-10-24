ALTER TABLE public.requests
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.request_status_history
    ALTER COLUMN from_status TYPE text USING from_status::text,
    ALTER COLUMN to_status TYPE text USING to_status::text;

UPDATE public.request_status_history
SET from_status = CASE from_status
        WHEN 'submitted' THEN 'pending_review'
        WHEN 'registrar_review' THEN 'pending_review'
        WHEN 'needs_information' THEN 'on_hold'
        WHEN 'approved' THEN 'pending_payment'
        WHEN 'awaiting_payment' THEN 'pending_payment'
        WHEN 'payment_review' THEN 'pending_payment'
        WHEN 'saso_cleared' THEN 'pending_payment'
        WHEN 'registrar_approved' THEN 'clearance_review'
        WHEN 'saso_review' THEN 'clearance_review'
        WHEN 'paid' THEN 'paid'
        WHEN 'processing' THEN 'processing'
        WHEN 'ready' THEN 'ready_for_pickup'
        WHEN 'ready_for_retrieval' THEN 'ready_for_pickup'
        WHEN 'fulfilled' THEN 'fulfilled'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'cancelled' THEN 'rejected'
        WHEN 'registrar_rejected' THEN 'rejected'
        WHEN 'saso_rejected' THEN 'rejected'
        ELSE from_status
    END,
    to_status = CASE to_status
        WHEN 'submitted' THEN 'pending_review'
        WHEN 'registrar_review' THEN 'pending_review'
        WHEN 'needs_information' THEN 'on_hold'
        WHEN 'approved' THEN 'pending_payment'
        WHEN 'awaiting_payment' THEN 'pending_payment'
        WHEN 'payment_review' THEN 'pending_payment'
        WHEN 'saso_cleared' THEN 'pending_payment'
        WHEN 'registrar_approved' THEN 'clearance_review'
        WHEN 'saso_review' THEN 'clearance_review'
        WHEN 'paid' THEN 'paid'
        WHEN 'processing' THEN 'processing'
        WHEN 'ready' THEN 'ready_for_pickup'
        WHEN 'ready_for_retrieval' THEN 'ready_for_pickup'
        WHEN 'fulfilled' THEN 'fulfilled'
        WHEN 'rejected' THEN 'rejected'
        WHEN 'cancelled' THEN 'rejected'
        WHEN 'registrar_rejected' THEN 'rejected'
        WHEN 'saso_rejected' THEN 'rejected'
        ELSE to_status
    END;

CREATE TYPE public.request_status_canonical AS ENUM (
    'pending_review',
    'on_hold',
    'pending_payment',
    'clearance_review',
    'paid',
    'processing',
    'ready_for_pickup',
    'fulfilled',
    'rejected'
);

ALTER TABLE public.requests
    ALTER COLUMN status TYPE public.request_status_canonical
    USING (
        CASE status::text
            WHEN 'submitted' THEN 'pending_review'
            WHEN 'registrar_review' THEN 'pending_review'
            WHEN 'needs_information' THEN 'on_hold'
            WHEN 'approved' THEN 'pending_payment'
            WHEN 'awaiting_payment' THEN 'pending_payment'
            WHEN 'payment_review' THEN 'pending_payment'
            WHEN 'saso_cleared' THEN 'pending_payment'
            WHEN 'registrar_approved' THEN 'clearance_review'
            WHEN 'saso_review' THEN 'clearance_review'
            WHEN 'paid' THEN 'paid'
            WHEN 'processing' THEN 'processing'
            WHEN 'ready' THEN 'ready_for_pickup'
            WHEN 'ready_for_retrieval' THEN 'ready_for_pickup'
            WHEN 'fulfilled' THEN 'fulfilled'
            WHEN 'rejected' THEN 'rejected'
            WHEN 'cancelled' THEN 'rejected'
            WHEN 'registrar_rejected' THEN 'rejected'
            WHEN 'saso_rejected' THEN 'rejected'
        END
    )::public.request_status_canonical;

DROP TYPE public.request_status;

ALTER TYPE public.request_status_canonical RENAME TO request_status;

ALTER TABLE public.requests
    ALTER COLUMN status SET DEFAULT 'pending_review'::public.request_status;
