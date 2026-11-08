INSERT INTO public.roles (name)
VALUES ('registrar_staff'), ('admin')
ON CONFLICT (name) DO NOTHING;
