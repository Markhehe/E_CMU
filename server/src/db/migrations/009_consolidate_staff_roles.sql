INSERT INTO public.roles (name)
VALUES ('student'), ('registrar'), ('finance')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT assignments.user_id, registrar.id
FROM public.user_roles AS assignments
INNER JOIN public.roles AS old_role
    ON old_role.id = assignments.role_id
INNER JOIN public.roles AS registrar
    ON registrar.name = CASE
        WHEN old_role.name = 'requester' THEN 'student'
        ELSE 'registrar'
    END
WHERE old_role.name IN ('requester', 'administrator', 'admin', 'saso')
ON CONFLICT (user_id, role_id) DO NOTHING;

DELETE FROM public.user_roles
WHERE role_id IN (
    SELECT id
    FROM public.roles
    WHERE name IN ('requester', 'administrator', 'admin', 'saso')
);

DELETE FROM public.roles
WHERE name IN ('requester', 'administrator', 'admin', 'saso');
