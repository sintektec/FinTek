
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';
import { formatDocument, validateCPF, validateCNPJ } from '../../utils/helpers';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Loader2,
  Landmark,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Bitcoin,
  Building2,
  CreditCard,
  User as UserIcon
} from 'lucide-react';

const BankReg: React.FC<{ user: User }> = ({ user }) => {
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'PF' | 'PJ'>('ALL');

  const [formData, setFormData] = useState({
    name: '',
    account_type: 'BANK', // BANK, BROKER, EXCHANGE
    agency: '',
    account_number: '',
    owner_document: '',
    owner_name: '',
    company_id: '' as string | null
  });

  const [docError, setDocError] = useState('');

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('banks')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setBanks(data);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      ...formData,
      is_active: true
    };

    let result;
    if (editingId) {
      result = await supabase
        .from('banks')
        .update(payload)
        .eq('id', editingId);
    } else {
      result = await supabase
        .from('banks')
        .insert([payload]);
    }

    if (result.error) {
      alert('Erro ao salvar: ' + result.error.message);
    } else {
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', account_type: 'BANK', agency: '', account_number: '', owner_document: '', owner_name: '', company_id: null });
      setDocError('');
      fetchBanks();
    }
    setSaving(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('banks')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      alert('Erro ao atualizar status: ' + error.message);
    } else {
      fetchBanks();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Deseja realmente EXCLUIR a conta "${name}"?`)) {
      const { error } = await supabase
        .from('banks')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao excluir: ' + error.message);
      } else {
        fetchBanks();
      }
    }
  };

  const handleOwnerDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatDocument(e.target.value);
    setFormData(prev => ({ ...prev, owner_document: value, company_id: null }));
    setDocError('');

    const clean = value.replace(/\D/g, '');
    if (clean.length === 11) {
      if (!validateCPF(clean)) {
        setDocError('CPF Inválido');
        return;
      }
      // Look for Person
      const { data } = await supabase
        .from('people')
        .select('name, nickname')
        .eq('cpf', value)
        .maybeSingle();
      if (data) setFormData(prev => ({ ...prev, owner_name: data.nickname || data.name }));
    } else if (clean.length === 14) {
      if (!validateCNPJ(clean)) {
        setDocError('CNPJ Inválido');
        return;
      }
      // Look for Company
      const { data } = await supabase
        .from('companies')
        .select('id, name, razao_social')
        .eq('cnpj', value)
        .maybeSingle();
      if (data) setFormData(prev => ({ ...prev, owner_name: data.name || data.razao_social, company_id: data.id }));
    }
  };

  const openEdit = (bank: any) => {
    setEditingId(bank.id);
    setFormData({
      name: bank.name || '',
      account_type: bank.account_type || 'BANK',
      agency: bank.agency || '',
      account_number: bank.account_number || '',
      owner_document: bank.owner_document || '',
      owner_name: bank.owner_name || '',
      company_id: bank.company_id || null
    });
    setShowForm(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EXCHANGE': return <Bitcoin className="w-5 h-5 text-warning" />;
      case 'BROKER': return <Wallet className="w-5 h-5 text-primary" />;
      default: return <Landmark className="w-5 h-5 text-primary" />;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'EXCHANGE': return 'Exchange';
      case 'BROKER': return 'Corretora';
      default: return 'Banco';
    }
  };

  const filteredBanks = banks.filter(b => {
    const matchesSearch = b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getTypeText(b.account_type).toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'PF') {
      return b.owner_document && b.owner_document.replace(/\D/g, '').length === 11;
    }
    if (filterType === 'PJ') {
      return b.owner_document && b.owner_document.replace(/\D/g, '').length === 14;
    }

    return true;
  });

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Contas e Bancos</h1>
          <p className="text-slate-600 dark:text-text-secondary text-base font-medium">Gestão de bancos, corretoras e exchanges.</p>
        </div>
        {(user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && (
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', account_type: 'BANK', agency: '', account_number: '', owner_document: '', owner_name: '', company_id: null });
              setDocError('');
              setShowForm(true);
            }}
            className="px-8 h-12 rounded-xl bg-primary text-background-dark font-black shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-5 h-5" /> Nova Conta
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="relative group w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Buscar por nome ou tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${filterType === 'ALL' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-surface-highlight'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('PF')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${filterType === 'PF' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-surface-highlight'}`}
          >
            Pessoa Física
          </button>
          <button
            onClick={() => setFilterType('PJ')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${filterType === 'PJ' ? 'bg-primary text-white shadow-md' : 'bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-surface-highlight'}`}
          >
            Pessoa Jurídica
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-surface-highlight/30 border-b border-slate-100 dark:border-surface-highlight">
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Instituição</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Titular / Documento</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Tipo</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Agência / Conta</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-500 dark:text-text-secondary uppercase tracking-[0.2em] text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-surface-highlight">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : filteredBanks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-500">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                filteredBanks.map((b) => (
                  <tr key={b.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-slate-100 dark:bg-surface-highlight/20 flex items-center justify-center">
                          {getTypeIcon(b.account_type)}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white capitalize text-sm">{b.name}</span>
                      </div>
                    </td>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-white capitalize text-sm">{b.owner_name || '-'}</span>
                      <span className="text-[10px] text-slate-400 font-medium tracking-wider">{b.owner_document || '-'}</span>
                      {b.company_id && <span className="text-[9px] text-primary font-bold uppercase tracking-tighter">Vinculada à Empresa</span>}
                    </div>
                    <td className="px-6 py-5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${b.account_type === 'EXCHANGE' ? 'bg-warning/10 text-warning' : b.account_type === 'BROKER' ? 'bg-primary/10 text-primary' : 'bg-slate-400/10 text-slate-400'}`}>
                        {getTypeText(b.account_type)}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col text-sm font-medium text-slate-600 dark:text-text-secondary">
                        <span>Ag: {b.agency || '-'}</span>
                        <span>Ct: {b.account_number || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <button
                        onClick={() => (user.role === 'MASTER_ADMIN' || user.role === 'ADMIN') && handleToggleActive(b.id, b.is_active)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${b.is_active ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-danger/10 text-danger hover:bg-danger/20'}`}
                        disabled={user.role !== 'MASTER_ADMIN' && user.role !== 'ADMIN'}
                      >
                        {b.is_active ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                        {b.is_active ? 'Ativo' : 'Bloqueado'}
                      </button>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(b)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(b.id, b.name)}
                          className="p-2 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-highlight rounded-3xl p-8 shadow-2xl w-full max-w-xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex justify-between items-center mb-10 border-b border-slate-100 dark:border-surface-highlight pb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editingId ? 'Editar Conta' : 'Nova Conta Bancária'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-danger transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Documento (CPF ou CNPJ)</label>
                  <input
                    required
                    value={formData.owner_document}
                    onChange={handleOwnerDocChange}
                    className={`h-12 w-full rounded-xl border ${docError ? 'border-danger' : 'border-slate-200 dark:border-surface-highlight'} bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all`}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  />
                  {docError && <p className="text-[10px] text-danger font-black uppercase tracking-wider">{docError}</p>}
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome do Titular</label>
                  <input
                    required
                    value={formData.owner_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="Nome ou Razão Social"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo de Instituição</label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'BANK', icon: Landmark, label: 'Banco' },
                    { id: 'BROKER', icon: Wallet, label: 'Corretora' },
                    { id: 'EXCHANGE', icon: Bitcoin, label: 'Exchange' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, account_type: t.id })}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${formData.account_type === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-surface-highlight text-slate-400 hover:border-slate-200'}`}
                    >
                      <t.icon className="w-5 h-5 mb-2" />
                      <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome da Instituição</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="Ex: Banco Itau, Binance, XP Investimentos"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agência</label>
                  <input
                    value={formData.agency}
                    onChange={(e) => setFormData(prev => ({ ...prev, agency: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="0000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Número da Conta</label>
                  <input
                    value={formData.account_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-surface-highlight bg-slate-50 dark:bg-surface-darker px-4 text-slate-900 dark:text-white focus:ring-1 focus:ring-primary font-bold transition-all"
                    placeholder="000000-0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6 border-t border-slate-100 dark:border-surface-highlight">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 h-12 border border-slate-200 dark:border-surface-highlight text-slate-600 dark:text-text-secondary font-black rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-xs tracking-widest"
                >
                  CANCELAR
                </button>
                <button
                  disabled={saving}
                  className="px-10 h-12 bg-primary text-background-dark font-black rounded-xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'SALVAR REGISTRO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankReg;
