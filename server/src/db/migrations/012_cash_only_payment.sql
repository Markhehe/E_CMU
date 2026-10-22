UPDATE public.requests
SET additional_details =
    COALESCE(additional_details, '{}'::jsonb) ||
    jsonb_build_object('paymentMethod', 'Pay at the Office')
WHERE lower(COALESCE(
    additional_details->>'paymentMethod',
    additional_details->>'payment_method',
    ''
)) ~ 'online|gcash';
