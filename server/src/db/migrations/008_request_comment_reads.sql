CREATE TABLE public.request_comment_reads (
    comment_id bigint NOT NULL REFERENCES public.request_comments(id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX request_comment_reads_user_idx
    ON public.request_comment_reads USING btree (user_id, comment_id);
