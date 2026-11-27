-- Adicionar novas colunas na tabela 'events'
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'blue';

-- Comentário: A coluna color armazena a cor de destaque (ex: 'red', 'blue', 'green', 'amber', 'slate')
