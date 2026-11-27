-- Dados de exemplo para o banco LOCAL (aplicados por `npm run db:reset`).
-- Nunca roda em produção.
insert into public.churches (id, name, is_active) values
  ('5eed0000-0000-0000-0000-000000000001', 'Igreja Exemplo Central', true),
  ('5eed0000-0000-0000-0000-000000000002', 'Igreja Exemplo Norte', true)
on conflict (id) do nothing;

-- Para ter um pastor local: cadastre-se pela tela de login e rode no Studio
-- (http://localhost:54323 → SQL Editor):
--   update public.profiles set role = 'pastor' where email = 'seu@email.com';
