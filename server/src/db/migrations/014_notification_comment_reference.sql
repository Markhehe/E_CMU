ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS comment_id bigint;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'notifications_comment_id_request_comments_id_fk'
    ) THEN
        ALTER TABLE public.notifications
            ADD CONSTRAINT notifications_comment_id_request_comments_id_fk
            FOREIGN KEY (comment_id)
            REFERENCES public.request_comments(id)
            ON DELETE CASCADE;
    END IF;
END
$$;
