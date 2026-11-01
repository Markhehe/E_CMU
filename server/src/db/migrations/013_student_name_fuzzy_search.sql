CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX IF NOT EXISTS student_directory_first_name_trgm_idx
    ON public.student_directory USING gin (lower(first_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS student_directory_middle_name_trgm_idx
    ON public.student_directory USING gin (lower(middle_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS student_directory_last_name_trgm_idx
    ON public.student_directory USING gin (lower(last_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_full_name_trgm_idx
    ON public.users USING gin (lower(full_name) gin_trgm_ops);
