-- Atribuir role admin aos usuários existentes que não têm role
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM public.profiles p
WHERE p.email IN ('comercial@floripasquare.com.br', 'leticia@spr.net.br')
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id
);