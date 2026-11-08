INSERT INTO public.roles (name)
VALUES ('admin')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT account.id, admin_role.id
FROM public.users AS account
INNER JOIN public.roles AS admin_role
    ON admin_role.name = 'admin'
WHERE lower(account.email) = 'seed.registrar@ecmu.test'
ON CONFLICT (user_id, role_id) DO NOTHING;
