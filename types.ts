
export enum TransactionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: TransactionStatus;
  entity: string;
  bank?: string;
}

export interface Investment {
  id: string;
  institution: string;
  type: string;
  investedAmount: number;
  currentAmount: number;
  yield: number;
}

export type UserRole = 'MASTER_ADMIN' | 'ADMIN' | 'USER';

export interface User {
  id: string;
  nome: string;
  email: string;
  celular: string;
  funcao: string;
  role: UserRole;
  password?: string;
  isFirstAccess: boolean;
  status?: 'ACTIVE' | 'BLOCKED';
  failed_attempts?: number;
}

export interface Partner {
  id: string;
  company_id: string;
  name: string;
  cpf: string;
  participation_percentage: number;
  created_at?: string;
}

export interface Company {
  id: string;
  name: string; // Nome Fantasia
  cnpj: string;
  razao_social: string;
  email: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  created_at?: string;
  partners?: Partner[];
}

// ===== CONTRATOS =====

export type ContractType = 'service' | 'license' | 'nda' | 'partnership' | 'purchase' | 'other';
export type ContractStatus = 'draft' | 'review' | 'approved' | 'signed' | 'active' | 'expired' | 'terminated' | 'archived';
export type SignatoryRole = 'signer' | 'approver' | 'witness';
export type SignatoryStatus = 'pending' | 'signed' | 'declined';
export type AlertType = 'expiration' | 'renewal' | 'custom';

export interface Contract {
  id: string;
  contract_number: string;
  title: string;
  type: ContractType;
  status: ContractStatus;
  crm_deal_id?: string | null;
  company_id?: string | null;
  customer_id?: string | null;
  supplier_id?: string | null;
  party_name?: string | null;
  party_doc?: string | null;
  value: number;
  currency: string;
  effective_date?: string | null;
  expiration_date?: string | null;
  auto_renew: boolean;
  renewal_months: number;
  content?: string | null;
  notes?: string | null;
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
  // joins
  company?: { id: string; name: string } | null;
  customer?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  crm_deal?: { id: string; title: string } | null;
  signatories?: ContractSignatory[];
  activities?: ContractActivity[];
  alerts?: ContractAlert[];
}

export interface ContractSignatory {
  id: string;
  contract_id: string;
  name: string;
  email: string;
  role: SignatoryRole;
  signing_order: number;
  status: SignatoryStatus;
  signed_at?: string | null;
  created_at: string;
}

export interface ContractActivity {
  id: string;
  contract_id: string;
  user_id?: string | null;
  action: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

export interface ContractAlert {
  id: string;
  contract_id: string;
  type: AlertType;
  title: string;
  message?: string | null;
  trigger_date: string;
  triggered_at?: string | null;
  status: 'pending' | 'triggered' | 'dismissed';
  created_at: string;
}

// ===== CRM =====

export type DealWorkflowStatus = 'pending' | 'approved' | 'rejected' | 'proposal_sent';

export interface CRMDeal {
  id: string;
  title: string;
  description?: string | null;
  value: number;
  stage_id: string;
  expected_close_date?: string | null;
  company_id?: string | null;
  customer_id?: string | null;
  user_id?: string | null;
  workflow_status: DealWorkflowStatus;
  justification?: string | null;
  proposal_url?: string | null;
  created_at: string;
  updated_at: string;
  // joins
  company?: { name: string } | null;
  customer?: { name: string } | null;
  stage?: { name: string; color: string } | null;
}
