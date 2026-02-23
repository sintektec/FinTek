
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';
import { Search, Download, PlusCircle, Edit3, Trash2, CheckCircle, Hourglass, AlertCircle, X, Sparkles } from 'lucide-react';
import { suggestTransactionDetails } from '../lib/gemini';
import ExportPayableModal from '../components/ExportPayableModal';
import EditPayableModal from '../components/EditPayableModal';

interface Company { id: string; name: string; }
interface Supplier { id: string; name: string; }
interface Bank { id: string; name: string; type: string; account_number: string; agency: string; owner_name?: string; owner_document?: string; company?: { name: string } }
interface PayableRecord {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  supplier_id: string;
  company_id: string;
  bank_id: string;
  supplier?: { name: string };
  company?: { name: string };
  bank?: { name: string };
}

interface SupplierExtended extends Supplier { trade_name?: string; }

const Payable: React.FC<{ user: User }> = ({ user }) => {
  const isReadOnly = user.role === 'USER';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Modals state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'delete'>('edit');
  const [selectedRecord, setSelectedRecord] = useState<PayableRecord | null>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);

  // Form State
  const [description, setDescription] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

  // Data Lists
  const [companies, setCompanies] = useState<Company[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [records, setRecords] = useState<PayableRecord[]>([]);

  useEffect(() => {
    fetchInitialData();
    fetchRecords();
  }, []);

  const fetchInitialData = async () => {
    const [compRes, suppRes, bankRes, peopleRes] = await Promise.all([
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('suppliers').select('id, name, trade_name').order('name'),
      supabase.from('banks').select('id, name, type, agency, account_number, owner_name, owner_document, company:companies(name)').order('name'),
      supabase.from('people').select('name, nickname, cpf')
    ]);

    if (compRes.data) setCompanies(compRes.data);
    if (suppRes.data) setSuppliers(suppRes.data as any);
    if (bankRes.data) setBanks(bankRes.data as any);
    if (peopleRes.data) setPeople(peopleRes.data as any);
  };

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payables')
      .select(`
                id, description, amount, due_date, status, supplier_id, company_id, bank_id,
                supplier:suppliers(name),
                company:companies(name),
                bank:banks(name)
            `)
      .order('due_date', { ascending: false });

    if (error) {
      console.error('Error fetching records:', error);
    } else {
      setRecords(data as any);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !supplierId || !companyId || !bankId) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('payables').insert([{
      description,
      supplier_id: supplierId,
      company_id: companyId,
      bank_id: bankId,
      amount: parseFloat(amount.toString().replace(',', '.')),
      due_date: dueDate,
      status: 'PENDING',
      user_id: user.id
    }]);

    if (error) {
      alert('Erro ao salvar lançamento: ' + error.message);
    } else {
      setDescription('');
      setAmount('');
      setSupplierId('');
      setCompanyId('');
      setBankId('');
      fetchRecords();
    }
    setSaving(false);
  };

  const handleAISuggest = async () => {
    if (!description || isSuggesting) return;
    setIsSuggesting(true);

    const supplierNames = suppliers.map(s => (s as SupplierExtended).trade_name || s.name);
    const companyNames = companies.map(c => c.name);

    const suggestion = await suggestTransactionDetails(description, supplierNames, companyNames);

    if (suggestion) {
      if (suggestion.supplier) {
        const foundSupp = suppliers.find(s => ((s as SupplierExtended).trade_name || s.name) === suggestion.supplier);
        if (foundSupp) setSupplierId(foundSupp.id);
      }
      if (suggestion.company) {
        const foundComp = companies.find(c => c.name === suggestion.company);
        if (foundComp) setCompanyId(foundComp.id);
      }
    }
    setIsSuggesting(false);
  };

  const calculateOverdueDays = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    if (due < today) {
      const diffTime = Math.abs(today.getTime() - due.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
  };

  const filteredRecords = records.filter(rec => {
    const matchesSearch = rec.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!filterStatus) return matchesSearch;

    if (filterStatus === 'OVERDUE') {
      return matchesSearch && (rec.status === 'OVERDUE' || (new Date(rec.due_date) < new Date() && rec.status === 'PENDING'));
    }

    return matchesSearch && rec.status === filterStatus;
  });

  // KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const paidToday = records
    .filter(r => r.status === 'PAID' && r.due_date === todayStr)
    .reduce((acc, r) => acc + Number(r.amount), 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const pendingMonth = records
    .filter(r => r.status === 'PENDING' && new Date(r.due_date) >= startOfMonth)
    .reduce((acc, r) => acc + Number(r.amount), 0);

  const overdueTotal = records
    .filter(r => r.status === 'OVERDUE' || (new Date(r.due_date) < new Date() && r.status === 'PENDING'))
    .reduce((acc, r) => acc + Number(r.amount), 0);

  const toggleFilter = (status: string) => {
    if (filterStatus === status) {
      setFilterStatus(null);
      setIsDrillDownOpen(false);
    } else {
      setFilterStatus(status);
      setIsDrillDownOpen(true);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10 w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 dark:text-white text-4xl font-black tracking-tight">Contas a Pagar</h1>
          <p className="text-slate-600 dark:text-text-secondary text-base font-medium">Gerencie seus compromissos financeiros e mantenha o caixa em dia.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar lançamento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 h-12 rounded-xl border border-slate-200 dark:border-surface-highlight bg-white dark:bg-surface-dark text-slate-900 dark:text-white text-sm font-bold w-64 focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-2 px-6 h-12 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-xl text-slate-700 dark:text-white text-sm font-black hover:bg-slate-50 dark:hover:bg-surface-highlight transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            {!isReadOnly && (
              <button
                onClick={() => setShowForm(!showForm)}
                className={`flex items-center gap-2 px-6 h-12 rounded-xl transition-all text-sm font-black shadow-lg ${showForm ? 'bg-slate-200 dark:bg-surface-highlight text-slate-700 dark:text-white' : 'bg-primary hover:bg-primary-hover text-background-dark shadow-primary/20'}`}
              >
                {showForm ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                {showForm ? 'Fechar Lançamento' : 'Incluir Novo Lançamento'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => toggleFilter('PAID')}
          className={`bg-white dark:bg-surface-dark rounded-2xl border p-6 relative overflow-hidden group cursor-pointer transition-all ${filterStatus === 'PAID' ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 dark:border-surface-highlight hover:border-primary/50'}`}
        >
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-text-secondary text-xs font-bold uppercase tracking-widest text-primary">Pagos Hoje</span>
            <div className="size-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight relative z-10">
            {paidToday.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="mt-2 text-xs font-bold text-text-secondary">Clique para filtrar</p>
        </div>

        <div
          onClick={() => toggleFilter('PENDING')}
          className={`bg-white dark:bg-surface-dark rounded-2xl border p-6 relative overflow-hidden group cursor-pointer transition-all ${filterStatus === 'PENDING' ? 'border-yellow-500 ring-2 ring-yellow-500/20' : 'border-slate-200 dark:border-surface-highlight hover:border-yellow-500/50'}`}
        >
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-text-secondary text-xs font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-500">Pendente (Mês)</span>
            <div className="size-10 rounded-xl flex items-center justify-center bg-yellow-500/10 text-yellow-600 dark:text-yellow-500">
              <Hourglass className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight relative z-10">
            {pendingMonth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="mt-2 text-xs font-bold text-text-secondary">Clique para filtrar</p>
        </div>

        <div
          onClick={() => toggleFilter('OVERDUE')}
          className={`bg-white dark:bg-surface-dark rounded-2xl border p-6 relative overflow-hidden group cursor-pointer transition-all ${filterStatus === 'OVERDUE' ? 'border-danger ring-2 ring-danger/20' : 'border-slate-200 dark:border-surface-highlight hover:border-danger/50'}`}
        >
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="text-text-secondary text-xs font-bold uppercase tracking-widest text-danger">Vencidos</span>
            <div className="size-10 rounded-xl flex items-center justify-center bg-danger/10 text-danger">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight relative z-10">
            {overdueTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="mt-2 text-xs font-bold text-danger">Ação necessária</p>
        </div>
      </div>

      {showForm && !isReadOnly && (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl p-8 shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-8 border-b border-slate-200 dark:border-surface-highlight pb-6">
            <PlusCircle className="text-primary w-8 h-8" />
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Novo Lançamento</h3>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-12 flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-[0.2em]">Descrição do Lançamento</label>
              <div className="relative group">
                <input
                  required
                  className="w-full bg-slate-50 dark:bg-[#111813] border border-slate-200 dark:border-surface-highlight rounded-xl h-12 pl-4 pr-12 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary font-bold transition-all"
                  placeholder="Ex: Aluguel, Internet, Fornecedor X..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
                {description && (
                  <button
                    type="button"
                    onClick={handleAISuggest}
                    disabled={isSuggesting}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
                    title="Sugerir Fornecedor/Empresa com IA"
                  >
                    <Sparkles className={`w-4 h-4 ${isSuggesting ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-[0.2em]">Fornecedor</label>
              <select
                required
                className="w-full bg-slate-50 dark:bg-[#111813] border border-slate-200 dark:border-surface-highlight rounded-xl h-12 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary font-bold appearance-none"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                title="Selecione o fornecedor"
              >
                <option value="" disabled>Selecione o fornecedor...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{(s as SupplierExtended).trade_name || s.name}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-[0.2em]">Empresa / Destino</label>
              <select
                required
                className="w-full bg-slate-50 dark:bg-[#111813] border border-slate-200 dark:border-surface-highlight rounded-xl h-12 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary font-bold appearance-none"
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                title="Selecione a empresa"
              >
                <option value="" disabled>Selecione a empresa...</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-[0.2em]">Banco / Conta para Débito</label>
              <select
                required
                className="w-full bg-slate-50 dark:bg-[#111813] border border-slate-200 dark:border-surface-highlight rounded-xl h-12 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary font-bold appearance-none"
                value={bankId}
                onChange={e => setBankId(e.target.value)}
                title="Selecione o banco"
              >
                <option value="" disabled>Selecione a conta bancária...</option>
                {banks.map(b => {
                  const ownerDisplay = b.company?.name || (people.find(p => p.cpf === b.owner_document)?.nickname || b.owner_name);
                  return (
                    <option key={b.id} value={b.id}>
                      {ownerDisplay ? `${ownerDisplay} - ` : ''}{b.name} (Ag: {b.agency} Ct: {b.account_number})
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="lg:col-span-3 flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-[0.2em]">Data de Vencimento</label>
              <input
                type="date"
                className="w-full bg-slate-50 dark:bg-[#111813] border border-slate-200 dark:border-surface-highlight rounded-xl h-12 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary font-bold"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
            <div className="lg:col-span-2 flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-[10px] font-black uppercase tracking-[0.2em]">Valor (R$)</label>
              <input
                required
                className="w-full bg-slate-50 dark:bg-[#111813] border border-slate-200 dark:border-surface-highlight rounded-xl h-12 px-4 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary text-right font-black"
                placeholder="0,00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div className="lg:col-span-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 h-12 rounded-xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-10 h-12 bg-primary hover:bg-primary-hover text-background-dark font-black rounded-xl transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className={`w-5 h-5 ${saving ? 'animate-spin' : ''}`} />
                {saving ? 'SALVANDO...' : 'CONFIRMAR LANÇAMENTO'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-surface-highlight flex flex-wrap justify-between items-center gap-6 bg-slate-50 dark:bg-surface-darker">
          <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Contas Cadastradas</h3>
          <div className="flex gap-4 items-center">
            {filterStatus && (
              <button
                onClick={() => setFilterStatus(null)}
                className="text-[10px] font-black bg-danger/10 text-danger border border-danger/20 px-3 py-1 rounded-lg uppercase transition-all hover:bg-danger hover:text-white"
              >
                Limpar Filtro
              </button>
            )}
            <span className="bg-slate-200 dark:bg-surface-highlight px-4 py-1.5 rounded-xl text-xs font-black text-slate-800 dark:text-text-secondary border border-black/5 dark:border-white/5 uppercase">
              Exibindo: {filteredRecords.length} lançamentos
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center text-text-secondary font-bold uppercase tracking-widest">Carregando lançamentos...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-20 text-center text-text-secondary font-bold uppercase tracking-widest">Nenhum lançamento encontrado.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-surface-highlight/30 text-[10px] uppercase font-black tracking-[0.15em] text-slate-500 dark:text-text-secondary border-b border-slate-200 dark:border-surface-highlight">
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Descrição</th>
                  <th className="px-8 py-5">Fornecedor</th>
                  <th className="px-8 py-5">Empresa</th>
                  <th className="px-8 py-5 text-right">Valor</th>
                  <th className="px-8 py-5">Vencimento</th>
                  <th className="px-8 py-5 text-center">Atraso</th>
                  {!isReadOnly && <th className="px-8 py-5 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-highlight text-sm font-bold">
                {filteredRecords.map((row) => {
                  const overdueDays = (row.status === 'PENDING' || row.status === 'OVERDUE') ? calculateOverdueDays(row.due_date) : 0;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-surface-highlight/20 transition-all group">
                      <td className="px-8 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${row.status === 'PAID' ? 'bg-primary/10 text-primary border-primary/20' :
                          (overdueDays > 0 || row.status === 'OVERDUE') ? 'bg-danger/10 text-danger border-danger/20' :
                            'bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-500/20'
                          }`}>
                          {row.status === 'PAID' ? 'PAGO' : overdueDays > 0 ? 'ATRASADO' : 'PENDENTE'}
                        </span>
                      </td>
                      <td className="px-8 py-4 font-black text-slate-900 dark:text-white capitalize">{row.description}</td>
                      <td className="px-8 py-4 text-slate-600 dark:text-text-secondary">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {suppliers.find(s => s.id === row.supplier_id)?.trade_name || row.supplier?.name}
                          </span>
                          {suppliers.find(s => s.id === row.supplier_id)?.trade_name && (
                            <span className="text-[10px] text-slate-400 font-medium uppercase">{row.supplier?.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-4 text-slate-500 dark:text-text-secondary text-[10px] font-black uppercase tracking-wider">
                        {companies.find(c => c.id === row.company_id)?.name}
                      </td>
                      <td className="px-8 py-4 text-right font-black text-slate-900 dark:text-white">
                        {Number(row.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-8 py-4 text-slate-900 dark:text-white whitespace-nowrap">
                        {new Date(row.due_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-8 py-4 text-center">
                        {overdueDays > 0 ? (
                          <span className="text-danger font-black text-xs">{overdueDays}d</span>
                        ) : (
                          <span className="text-slate-300 dark:text-surface-highlight">-</span>
                        )}
                      </td>
                      {!isReadOnly && (
                        <td className="px-8 py-4">
                          <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button
                              className="p-2 hover:bg-slate-200 dark:hover:bg-surface-highlight rounded-lg text-slate-900 dark:text-white transition-colors"
                              onClick={() => {
                                setSelectedRecord(row);
                                setModalMode('edit');
                                setIsEditOpen(true);
                              }}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 hover:bg-danger/10 rounded-lg text-danger transition-colors"
                              onClick={() => {
                                setSelectedRecord(row);
                                setModalMode('delete');
                                setIsEditOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ExportPayableModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        data={records}
        companies={companies}
        suppliers={suppliers}
        banks={banks}
      />

      <EditPayableModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        companies={companies}
        suppliers={suppliers}
        banks={banks}
        onSuccess={fetchRecords}
        mode={modalMode}
      />

      {/* KPI Drill Down Modal */}
      {isDrillDownOpen && filterStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl p-8 shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-surface-highlight pb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Detalhes: {filterStatus === 'PAID' ? 'Pagos Hoje' : filterStatus === 'OVERDUE' ? 'Vencidos' : 'Pendentes no Mês'}
                </h3>
                <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">
                  Total: {filteredRecords.reduce((acc, r) => acc + Number(r.amount), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <button
                onClick={() => setIsDrillDownOpen(false)}
                className="text-slate-400 hover:text-danger transition-colors"
                title="Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto pr-2 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase font-black tracking-widest text-slate-400 border-b border-slate-100 dark:border-surface-highlight">
                    <th className="px-4 py-3">Vencimento</th>
                    <th className="px-4 py-3">Fornecedor (Nome Fantasia)</th>
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-surface-highlight">
                  {filteredRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-4 text-xs font-bold text-slate-900 dark:text-white">
                        {new Date(r.due_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {suppliers.find(s => s.id === r.supplier_id)?.trade_name || r.supplier?.name}
                          </span>
                          <span className="text-[9px] text-slate-400 uppercase font-medium">{r.supplier?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase">
                        {companies.find(c => c.id === r.company_id)?.name}
                      </td>
                      <td className="px-4 py-4 text-right text-xs font-black text-slate-900 dark:text-white">
                        {Number(r.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-surface-highlight flex justify-end">
              <button
                onClick={() => setIsDrillDownOpen(false)}
                className="px-8 h-12 bg-slate-900 dark:bg-white text-white dark:text-background-dark font-black rounded-xl text-xs tracking-widest hover:scale-[1.02] transition-all"
                title="Fechar"
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payable;
