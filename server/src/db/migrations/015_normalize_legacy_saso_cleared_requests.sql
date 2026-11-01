WITH normalized_requests AS (
    UPDATE public.requests
    SET status = 'awaiting_payment',
        updated_at = NOW()
    WHERE status = 'saso_cleared'
    RETURNING id
)
INSERT INTO public.request_status_history
    (request_id, from_status, to_status, changed_by, comment)
SELECT id,
       'saso_cleared',
       'awaiting_payment',
       NULL,
       'Legacy SASO-cleared request status normalized to pending payment'
FROM normalized_requests;
