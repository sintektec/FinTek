-- CRM Enhancements v2
-- Adiciona campos para o novo workflow de aprovações

-- 1. Novas colunas em crm_deals
ALTER TABLE crm_deals 
ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50) DEFAULT 'pending' CHECK (workflow_status IN ('pending', 'approved', 'rejected', 'proposal_sent')),
ADD COLUMN IF NOT EXISTS justification TEXT,
ADD COLUMN IF NOT EXISTS proposal_url TEXT,
ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Garantir restrição de unicidade no nome do estágio para o ON CONFLICT funcionar
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'crm_stages_name_key'
    ) THEN 
        ALTER TABLE crm_stages ADD CONSTRAINT crm_stages_name_key UNIQUE (name);
    END IF;
END $$;

-- 3. Garantir estágios padrão
INSERT INTO crm_stages (id, name, order_index, color)
VALUES 
  (gen_random_uuid(), 'Prospecção', 1, '#94a3b8'), -- slate-400
  (gen_random_uuid(), 'Qualificação', 2, '#fbbf24'), -- amber-400
  (gen_random_uuid(), 'Proposta', 3, '#3b82f6'), -- blue-500
  (gen_random_uuid(), 'Negociação', 4, '#8b5cf6'), -- violet-500
  (gen_random_uuid(), 'Contrato', 5, '#10b981') -- emerald-500
ON CONFLICT (name) DO UPDATE SET order_index = EXCLUDED.order_index, color = EXCLUDED.color;
