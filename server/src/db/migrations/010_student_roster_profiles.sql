CREATE TABLE public.student_directory (
    student_id varchar(64) PRIMARY KEY,
    first_name varchar(120) NOT NULL,
    last_name varchar(120) NOT NULL,
    middle_name varchar(120),
    birthdate date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users
    ADD COLUMN student_id varchar(64)
        REFERENCES public.student_directory(student_id),
    ADD COLUMN contact_phone varchar(40),
    ADD COLUMN contact_address text;

CREATE UNIQUE INDEX users_student_id_unique
    ON public.users(student_id)
    WHERE student_id IS NOT NULL;

INSERT INTO public.roles (name)
VALUES ('registrar')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT assignments.user_id, registrar.id
FROM public.user_roles AS assignments
INNER JOIN public.roles AS finance
    ON finance.id = assignments.role_id AND finance.name = 'finance'
INNER JOIN public.roles AS registrar
    ON registrar.name = 'registrar'
ON CONFLICT (user_id, role_id) DO NOTHING;

DELETE FROM public.user_roles
WHERE role_id IN (SELECT id FROM public.roles WHERE name = 'finance');

DELETE FROM public.roles
WHERE name = 'finance';
