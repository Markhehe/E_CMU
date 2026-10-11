CREATE SEQUENCE public.request_display_code_seq
    AS integer
    MINVALUE 1
    MAXVALUE 16777215
    START WITH 1
    NO CYCLE;

ALTER TABLE public.requests
    ADD COLUMN display_code varchar(6);

WITH numbered_requests AS (
    SELECT
        id,
        row_number() OVER (ORDER BY submitted_at, id) AS code_number
    FROM public.requests
)
UPDATE public.requests AS request
SET display_code = upper(lpad(to_hex(numbered_requests.code_number::integer), 6, '0'))
FROM numbered_requests
WHERE request.id = numbered_requests.id;

SELECT setval(
    'public.request_display_code_seq',
    GREATEST((SELECT count(*) FROM public.requests), 1),
    (SELECT count(*) > 0 FROM public.requests)
);

ALTER SEQUENCE public.request_display_code_seq
    OWNED BY public.requests.display_code;

ALTER TABLE public.requests
    ALTER COLUMN display_code SET DEFAULT
        upper(lpad(to_hex(nextval('public.request_display_code_seq')), 6, '0')),
    ALTER COLUMN display_code SET NOT NULL,
    ADD CONSTRAINT requests_display_code_hex_chk
        CHECK (display_code ~ '^[0-9A-F]{6}$');

CREATE UNIQUE INDEX requests_display_code_unique
    ON public.requests USING btree (display_code);
