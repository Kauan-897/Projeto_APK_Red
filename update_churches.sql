-- Adiciona a coluna is_active para podermos Pausar/Ativar as Sedes caso não exista
ALTER TABLE public.churches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
