-- ============================================================
-- FINTEK - MÓDULO DE CONTRATOS
-- Executar no SQL Editor do Supabase Dashboard
-- ============================================================

-- Tabela principal de contratos
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('service', 'license', 'nda', 'partnership', 'purchase', 'other')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'signed', 'active', 'expired', 'terminated', 'archived')),

    -- Vínculo com dados existentes (sem duplicar)
    crm_deal_id UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
    company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

    -- Contraparte livre (quando não cadastrada)
    party_name  VARCHAR(200),
    party_doc   VARCHAR(20),

    -- Dados financeiros
    value        DECIMAL(15,2) DEFAULT 0,
    currency     VARCHAR(3) DEFAULT 'BRL',

    -- Vigência
    effective_date    DATE,
    expiration_date   DATE,
    auto_renew        BOOLEAN DEFAULT false,
    renewal_months    INTEGER DEFAULT 12,

    -- Conteúdo
    content  TEXT,  -- escopo, cláusulas
    notes    TEXT,  -- observações internas

    -- Responsável
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_status   ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_type     ON contracts(type);
CREATE INDEX IF NOT EXISTS idx_contracts_owner    ON contracts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contracts_deal     ON contracts(crm_deal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_dates    ON contracts(effective_date, expiration_date);
CREATE INDEX IF NOT EXISTS idx_contracts_company  ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_id);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage contracts"
    ON contracts FOR ALL
    USING (auth.role() = 'authenticated');

-- ============================================================
-- Signatários
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_signatories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id  UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    name         VARCHAR(150) NOT NULL,
    email        VARCHAR(255) NOT NULL,
    role         VARCHAR(50) DEFAULT 'signer' CHECK (role IN ('signer', 'approver', 'witness')),
    signing_order INTEGER DEFAULT 1,
    status       VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'declined')),
    signed_at    TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signatories_contract ON contract_signatories(contract_id);
ALTER TABLE contract_signatories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage signatories"
    ON contract_signatories FOR ALL
    USING (auth.role() = 'authenticated');

-- ============================================================
-- Log de Atividades
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_activities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    description TEXT,
    metadata    JSONB,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_contract ON contract_activities(contract_id);
CREATE INDEX IF NOT EXISTS idx_activities_created  ON contract_activities(created_at DESC);
ALTER TABLE contract_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage activities"
    ON contract_activities FOR ALL
    USING (auth.role() = 'authenticated');

-- ============================================================
-- Alertas de Vencimento e Renovação
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    type        VARCHAR(50) DEFAULT 'expiration' CHECK (type IN ('expiration', 'renewal', 'custom')),
    title       VARCHAR(200) NOT NULL,
    message     TEXT,
    trigger_date DATE NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE,
    status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'triggered', 'dismissed')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_contract     ON contract_alerts(contract_id);
CREATE INDEX IF NOT EXISTS idx_alerts_trigger_date ON contract_alerts(trigger_date);
CREATE INDEX IF NOT EXISTS idx_alerts_status       ON contract_alerts(status);
ALTER TABLE contract_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage alerts"
    ON contract_alerts FOR ALL
    USING (auth.role() = 'authenticated');

-- ============================================================
-- Trigger para atualizar updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contracts_updated_at ON contracts;
CREATE TRIGGER trg_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();

-- ============================================================
-- Função para gerar número sequencial de contrato
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'CNT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('contract_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
