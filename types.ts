
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
